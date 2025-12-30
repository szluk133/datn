import logging
import uuid
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple, Any
from collections import defaultdict
import json
import re

import google.generativeai as genai
from qdrant_client import QdrantClient
from qdrant_client.http import models as rest
from bson import ObjectId
from pymongo import DESCENDING, ASCENDING

from config import settings
from database import get_mongo_db
from models import ChatRequest, ChatResponse, ChatHistory, SourcedAnswer, ChatContext

logger = logging.getLogger(__name__)

# --- SYSTEM PROMPT ROUTER ---
SYSTEM_PROMPT_ROUTER = """
Bạn là AI Query Router. Nhiệm vụ: Phân tích ngữ cảnh và câu hỏi để định tuyến.

--- INPUT DATA ---
1. Context Page: "home_page" | "list_page" | "detail_page" | "my_page"
2. Query: Câu hỏi user.
3. Chat History: Lịch sử.

--- PHÂN TÍCH ---
1. XÁC ĐỊNH DEPENDENCY (Sự phụ thuộc):
    - "main": Câu hỏi ĐỘC LẬP, đầy đủ chủ ngữ/vị ngữ hoặc mở ra chủ đề mới.
    - "sub": Câu hỏi PHỤ THUỘC (Follow-up). Dấu hiệu: 
        + Đại từ thay thế ("nó", "ông ấy", "bài này", "danh sách đó", ...).
        + Câu hỏi ngắn/cụt ("thế còn tác giả?", "còn ngày mai?", "tại sao?", ...).
        + Bắt đầu bằng từ nối ("vậy thì", "nếu thế", ...).
        + Tham chiếu thứ tự ("bài 1", "cái thứ 2", "phần đầu"...).
        + Tham chiếu nội dung ("bài về giá vàng", "tin lạm phát"...).

2. INTENT:
    - "contextual_summary": Tóm tắt, tổng hợp thông tin từ Context hiện tại.
    - "specific_detail": Hỏi chi tiết về 1 đối tượng cụ thể.
    - "general_search": Tìm kiếm mở rộng, kiến thức chung.

3. TRÍCH XUẤT FILTERS & QUANTITY:
    - website: "vneconomy.vn" | "vnexpress.net"
    - days_ago: int (VD: "3 ngày qua" -> 3)
    - topic: string (Chủ đề bài báo).
    - sentiment: "positive" | "negative" | "neutral"
    - quantity: int (Số lượng bài báo user muốn xử lý. VD: "5 bài đầu", "top 3" -> 5, 3. Mặc định null).

--- LOGIC MATRIX ---
| Page | Query keywords | -> Intent |
| :--- | :--- | :--- |
| **list_page** | Từ khóa số nhiều ("các bài", "danh sách", "những tin này") HOẶC từ khóa tóm tắt ("tổng hợp", "điểm tin") | -> **contextual_summary** |
| **my_page** | Từ khóa sở hữu/tổng hợp ("bài của tôi", "tài liệu vừa up", "tóm tắt") | -> **contextual_summary** |
| **my_page** | Hỏi chi tiết trong tài liệu đã up | -> **specific_detail** |
| **detail_page** | Hỏi tóm tắt, nội dung chính, đại ý | -> **contextual_summary** |
| **detail_page** | Hỏi ai, cái gì, ở đâu, khi nào (của bài báo này) | -> **specific_detail** |
| **home_page** | Bất kỳ câu hỏi nào | -> **general_search** |

OUTPUT JSON:
{
    "intent": "string",
    "dependency": "string",
    "filters": {
        "website": "string | null",
        "days_ago": "integer | null",
        "topic": "string | null",
        "sentiment": "string | null",
        "quantity": "integer | null"
    }
}
"""

SYSTEM_PROMPT_CHAT = (
    "Bạn là trợ lý AI thông minh. Trả lời dựa trên thông tin cung cấp.\n"
    "LƯU Ý QUAN TRỌNG:\n"
    "- Nếu câu hỏi là câu phụ (Sub-question) hoặc tham chiếu số thứ tự (ví dụ: 'bài 1', 'tin đầu tiên', 'phần 1'), hãy CĂN CỨ VÀO LỊCH SỬ CHAT (câu trả lời trước của Bot) để xác định chính xác bài báo đang được nhắc đến.\n"
    "- Luôn trích dẫn nguồn (Source) cho mọi thông tin đưa ra, mỗi bài báo chỉ trích dẫn nguồn 1 lần duy nhất."
)

class ChatService:
    def __init__(self):
        try:
            genai.configure(api_key=settings.google_api_key)
            self.llm = genai.GenerativeModel('gemini-2.5-flash', system_instruction=SYSTEM_PROMPT_CHAT)
            self.router_llm = genai.GenerativeModel('gemini-2.5-flash', generation_config={"response_mime_type": "application/json"})
            self.embedding_model = 'models/text-embedding-004'
            self.vector_size = 384
            
            self.db = get_mongo_db()
            self.chat_histories_collection = self.db['chat_histories']
            self.articles_collection = self.db['articles'] 
            
            self.qdrant_client = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key)
            self.qdrant_collection_name = settings.qdrant_collection_name
            logger.info(f"ChatService V18.1 Ready (Updated: Added Fallback Layer 4 - Filter Relaxation).")
        except Exception as e:
            logger.error(f"Init Error: {e}")
            raise

    async def _get_chat_history(self, user_id: str, conversation_id: str) -> List[ChatHistory]:
        cursor = self.chat_histories_collection.find({
            "user_id": user_id, "conversation_id": conversation_id
        }).sort("created_at", -1).limit(5)
        history = await cursor.to_list(length=5)
        return [ChatHistory(**h) for h in history]

    async def _save_chat_history(self, user_id: str, conversation_id: str, query: str, answer: str, intent: str, dependency: str, sources: List[SourcedAnswer]):
        await self.chat_histories_collection.insert_one({
            "user_id": user_id, "conversation_id": conversation_id,
            "query": query, "answer": answer, 
            "intent": intent, "dependency": dependency,
            "sources": [s.dict() for s in sources],
            "created_at": datetime.utcnow()
        })

    async def _analyze_query(self, query: str, history: List[ChatHistory], context: ChatContext) -> Dict[str, Any]:
        try:
            chronological_history = list(reversed(history))
            history_txt = "\n".join([f"User: {h.query}\nBot: {h.answer}" for h in chronological_history])
            
            prompt = (
                f"{SYSTEM_PROMPT_ROUTER}\n\n"
                f"--- RUNTIME DATA ---\n"
                f"Context Page: {context.current_page}\n"
                f"Chat History:\n{history_txt}\n"
                f"Current Query: {query}\n"
            )
            response = await self.router_llm.generate_content_async(prompt)
            return json.loads(response.text)
        except Exception as e:
            logger.error(f"Router Error: {e}")
            return {"dependency": "main", "intent": "general_search", "filters": {}}

    async def _get_top_article_ids_from_mongo(self, search_id: str, sort_by: str, sort_order: str, limit: int) -> List[str]:
        if not search_id:
            return []
        
        sort_field = "publish_date"
        if sort_by == "sentiment":
            sort_field = "sentiment" 
        elif sort_by == "publish_date":
            sort_field = "publish_date"
            
        direction = DESCENDING if sort_order == "desc" else ASCENDING
        
        logger.info(f"🔍 Mongo Sort: search_id={search_id} | field={sort_field} | dir={direction} | limit={limit}")
        
        cursor = self.articles_collection.find(
            {"search_id": search_id},
            {"article_id": 1}
        ).sort(sort_field, direction).limit(limit)
        
        docs = await cursor.to_list(length=limit)
        return [doc["article_id"] for doc in docs if "article_id" in doc]

    def _build_qdrant_filters(self, base_filters: dict, extracted_filters: dict) -> Optional[rest.Filter]:
        conditions = []
        
        for key, value in base_filters.items():
            if value:
                if key == "article_id":
                    if isinstance(value, list):
                        conditions.append(rest.FieldCondition(key="article_id", match=rest.MatchAny(any=value)))
                    else:
                        conditions.append(rest.FieldCondition(key="article_id", match=rest.MatchValue(value=value)))
                elif key == "search_id":
                    conditions.append(rest.FieldCondition(key="search_id", match=rest.MatchValue(value=value)))
                elif key == "update_id":
                    conditions.append(rest.FieldCondition(key="update_id", match=rest.MatchValue(value=value)))
                else:
                    conditions.append(rest.FieldCondition(key=key, match=rest.MatchValue(value=value)))

        ai_filters = extracted_filters.get("filters", {})
        
        if ai_filters.get("website"):
            conditions.append(rest.FieldCondition(key="website", match=rest.MatchValue(value=ai_filters['website'])))
        
        if ai_filters.get("topic"):
            raw_topic = ai_filters['topic'].strip()
            topic_variations = list(set([
                raw_topic, raw_topic.lower(), raw_topic.capitalize(), raw_topic.title(), raw_topic.upper()
            ]))
            conditions.append(rest.FieldCondition(key="topic", match=rest.MatchAny(any=topic_variations)))
        
        if ai_filters.get("sentiment"):
            val = ai_filters['sentiment']
            sentiment_map = {
                "positive": "Tích cực",
                "negative": "Tiêu cực",
                "neutral": "Trung tính"
            }
            mapped_label = sentiment_map.get(val)
            if mapped_label:
                conditions.append(rest.FieldCondition(key="ai_sentiment_label", match=rest.MatchValue(value=mapped_label)))
            else:
                if val == "positive": 
                    conditions.append(rest.FieldCondition(key="sentiment", range=rest.Range(gte=0.25)))
                elif val == "negative": 
                    conditions.append(rest.FieldCondition(key="sentiment", range=rest.Range(lte=-0.25)))
        
        if ai_filters.get("days_ago") and isinstance(ai_filters["days_ago"], int):
            cutoff_date = datetime.utcnow() - timedelta(days=ai_filters["days_ago"])
            conditions.append(rest.FieldCondition(key="publish_date", range=rest.DatetimeRange(gte=cutoff_date.isoformat())))

        return rest.Filter(must=conditions) if conditions else None

    async def _search_qdrant(self, query: str, qdrant_filter: Optional[rest.Filter], limit: int = 5) -> List[rest.ScoredPoint]:
        try:
            logger.info(f"🔍 Qdrant Search | Limit: {limit} | Filter: {qdrant_filter}")
            embedding_result = genai.embed_content(
                model=self.embedding_model, content=query, task_type="retrieval_query", output_dimensionality=self.vector_size
            )
            
            results = self.qdrant_client.search(
                collection_name=self.qdrant_collection_name,
                query_vector=embedding_result['embedding'],
                query_filter=qdrant_filter,
                limit=limit
            )
            return results
        except Exception as e:
            logger.error(f"❌ Qdrant Search Error: {e}")
            return []

    async def _resolve_article_id(self, input_id: str) -> str:
        if not input_id or len(input_id) != 24: return input_id
        try:
            doc = await self.articles_collection.find_one({"_id": ObjectId(input_id)}, {"article_id": 1})
            return doc["article_id"] if doc else input_id
        except: return input_id
    
    def _smart_resolve_article(self, query: str, sources: List[SourcedAnswer]) -> Optional[Tuple[str, str]]:
        if not sources:
            return None

        # 1. Check Ordinal 
        match = re.search(r'(?:bài|tin|phần|số|mục)\s+(?:thứ\s+)?(\d+)', query.lower())
        if match:
            try:
                val = int(match.group(1))
                idx = val - 1 if val > 0 else 0
                if 0 <= idx < len(sources):
                    logger.info(f"🔗 Detected Ordinal Ref: Index {idx} -> {sources[idx].title}")
                    return sources[idx].article_id, sources[idx].title
            except:
                pass
        
        # Check text ordinal
        lower_q = query.lower()
        if "đầu tiên" in lower_q or "thứ nhất" in lower_q: return sources[0].article_id, sources[0].title
        if ("thứ hai" in lower_q or "thứ 2" in lower_q) and len(sources) > 1: return sources[1].article_id, sources[1].title
        
        # 2. Check Semantic Keyword Matching
        best_match = None
        max_score = 0
        query_tokens = set(lower_q.split())
        
        for src in sources:
            title_tokens = set(src.title.lower().split())
            intersection = query_tokens.intersection(title_tokens)
            score = len(intersection)
            
            valid_match = False
            if score >= 2:
                valid_match = True
            elif score == 1:
                matched_word = list(intersection)[0]
                if len(matched_word) > 4: 
                    valid_match = True
            
            if valid_match and score > max_score:
                max_score = score
                best_match = src
        
        if best_match:
            return best_match.article_id, best_match.title

        return None

    async def handle_chat(self, request: ChatRequest) -> ChatResponse:
        conversation_id = request.conversation_id or str(uuid.uuid4())
        
        if request.context.current_page == "detail_page" and request.context.article_id:
            request.context.article_id = await self._resolve_article_id(request.context.article_id)

        history = await self._get_chat_history(request.user_id, conversation_id)
        
        analysis = await self._analyze_query(request.query, history, request.context)
        intent = analysis.get("intent", "general_search")
        dependency = analysis.get("dependency", "main")
        extracted_filters = analysis.get("filters", {})
        
        requested_quantity = extracted_filters.get("quantity")
        limit = requested_quantity if requested_quantity else 5
        
        logger.info(f"Analysis -> Intent: {intent} | Quantity: {requested_quantity}")

        search_query = request.query
        context_query_append = ""
        
        target_article_id = None
        target_article_title = None

        # [FIX 1] Logic Smart Reference chỉ chạy khi không phải yêu cầu số lượng nhiều
        # Nếu user hỏi "3 bài", ta cần list, không phải 1 bài cụ thể.
        is_plural_request = requested_quantity and requested_quantity > 1

        if dependency == "sub" and not is_plural_request:
            last_bot_sources = history[0].sources if history else []
            resolved = self._smart_resolve_article(search_query, last_bot_sources)
            
            if resolved:
                target_article_id, target_article_title = resolved
                context_query_append = f"(Người dùng đang hỏi về bài: '{target_article_title}')"
            
            last_main_query = next((h.query for h in history if getattr(h, 'dependency', 'main') == 'main'), None)
            if last_main_query:
                search_query = f"{last_main_query} {search_query}"
                if not context_query_append:
                    context_query_append = f"(Ngữ cảnh cũ: '{last_main_query}')"

        base_filters = {}
        strategy = "Global Search"
        should_fallback_to_global = False

        is_list_sort_context = (
            request.context.current_page == "list_page" and 
            request.context.search_id and 
            request.context.sort_by and 
            request.context.sort_by != "relevance"
        )
        
        has_content_filters = any(
            extracted_filters.get(k) is not None
            for k in ["topic", "website", "sentiment", "days_ago"]
        )

        top_sorted_ids = []

        # --- LOGIC CHIẾN LƯỢC TÌM KIẾM ---
        if target_article_id:
            base_filters = {"article_id": target_article_id}
            base_filters["type"] = "chunk" 
            strategy = f"Smart Reference (Target: {target_article_title})"
            
            if "topic" in extracted_filters: 
                del extracted_filters["topic"]
            if "website" in extracted_filters: del extracted_filters["website"]
            if "days_ago" in extracted_filters: del extracted_filters["days_ago"]
        
        elif request.context.current_page == "detail_page" and request.context.article_id:
            base_filters = {"article_id": request.context.article_id}
            strategy = "Single Page Context"

        elif request.context.current_page == "list_page" and request.context.search_id:
            if has_content_filters:
                base_filters = {"search_id": request.context.search_id}
                strategy = "Scoped Search (With Filters)"
                should_fallback_to_global = True
            elif is_list_sort_context:
                if intent == "contextual_summary" or (dependency == "sub" and intent == "specific_detail"):
                    top_sorted_ids = await self._get_top_article_ids_from_mongo(
                        request.context.search_id,
                        request.context.sort_by,
                        request.context.sort_order or "desc",
                        limit
                    )
                    if top_sorted_ids:
                        base_filters = {"article_id": top_sorted_ids}
                        strategy = f"List Sort ({request.context.sort_by}) [Sub/Summary]"
                        limit = len(top_sorted_ids) 
                    else:
                        base_filters = {"search_id": request.context.search_id}
                        strategy = "Session Context (Fallback)"
                else:
                    base_filters = {"search_id": request.context.search_id}
                    strategy = "Session Context (Filtered)"
            elif intent == "contextual_summary":
                base_filters = {"search_id": request.context.search_id}
                strategy = "Session Context (Summary)"
            elif intent == "general_search" or intent == "specific_detail":
                base_filters = {"search_id": request.context.search_id}
                strategy = "Session Context (Search)"
                should_fallback_to_global = True 
        
        elif request.context.current_page == "my_page":
            base_filters["type"] = "my-page"
            strategy = "My Page Search"
            if request.context.update_id:
                base_filters["update_id"] = request.context.update_id
                strategy = f"My Page (UpdateID: {request.context.update_id})"
            else:
                strategy = "My Page (All User Uploads)"
                
        if target_article_id:
            pass 
        elif intent == "contextual_summary" and request.context.current_page != "my_page":
            base_filters["type"] = "ai_summary"
        elif "type" not in base_filters:
            if request.context.current_page != "my_page":
                base_filters["type"] = "chunk"

        # --- THỰC HIỆN TÌM KIẾM ---
        # Tầng 1: Initial Search
        final_filter = self._build_qdrant_filters(base_filters, {"filters": extracted_filters})
        results = await self._search_qdrant(search_query, final_filter, limit=limit)

        # Tầng 2: Fallback 0 (Global Search)
        if not results and should_fallback_to_global:
            logger.info("⚠️ Scoped Search empty. Fallback to Global Search...")
            if "search_id" in base_filters: del base_filters["search_id"]
            if base_filters.get("type") == "chunk": pass 
            
            final_filter = self._build_qdrant_filters(base_filters, {"filters": extracted_filters})
            results = await self._search_qdrant(search_query, final_filter, limit=limit)
            if results: strategy = "Global Search (Fallback from Scoped)"

        # Tầng 3: Fallback A (Type Relaxation)
        if not results and base_filters.get("type") == "ai_summary":
            logger.info("⚠️ No pre-computed summaries found. Fallback to full text search...")
            if "type" in base_filters: 
                del base_filters["type"]
                if request.context.current_page == "my_page": base_filters["type"] = "my-page"
            
            final_filter = self._build_qdrant_filters(base_filters, {"filters": extracted_filters})
            results = await self._search_qdrant(search_query, final_filter, limit=limit)

        # [NEW LOGIC] Tầng 4: Fallback B (Filter Relaxation)
        if not results and has_content_filters and not target_article_id:
            logger.info("⚠️ All strict filters failed. Executing Fallback B: Filter Relaxation (Semantic Only)...")
            
            # 1. Giữ lại các bộ lọc bắt buộc (System filters)
            relaxed_filters = {}
            if "search_id" in base_filters:
                relaxed_filters["search_id"] = base_filters["search_id"]
            if "update_id" in base_filters:
                relaxed_filters["update_id"] = base_filters["update_id"]
            if "type" in base_filters:
                relaxed_filters["type"] = base_filters["type"]

            # 2. Loại bỏ các bộ lọc nội dung từ người dùng (chỉ giữ quantity nếu cần)
            relaxed_ai_filters = {} 
            if "quantity" in extracted_filters:
                relaxed_ai_filters["quantity"] = extracted_filters["quantity"]

            # 3. Thực hiện tìm kiếm lại
            final_filter_relaxed = self._build_qdrant_filters(relaxed_filters, {"filters": relaxed_ai_filters})
            results = await self._search_qdrant(search_query, final_filter_relaxed, limit=limit)
            
            if results:
                strategy = "Semantic Fallback (Filters Relaxed)"

        # --- RE-SORT RESULTS ---
        if results:
            def get_id(point):
                return point.payload.get("article_id") or point.payload.get("metadata", {}).get("article_id")
            
            if top_sorted_ids:
                id_map = {str(aid): i for i, aid in enumerate(top_sorted_ids)}
                results.sort(key=lambda x: id_map.get(str(get_id(x)), 999))
                logger.info("✅ Re-sorted results match Mongo ID list (Sync Sources).")
            elif intent == "contextual_summary" and not target_article_id:
                results.sort(key=lambda x: x.payload.get("publish_date", ""), reverse=True)
                logger.info("✅ Re-sorted results by Date Desc for Summary (Sync Sources).")

        context_parts = []
        sources = []
        seen = set()

        if not results:
            if intent == "contextual_summary":
                final_answer = "Hiện không tìm thấy nội dung phù hợp để tóm tắt."
            else:
                final_answer = "Không tìm thấy thông tin phù hợp trong danh sách này."
        else:
            for pt in results:
                payload = pt.payload or {}
                
                content = payload.get("summary_text") if payload.get("type") == "ai_summary" else payload.get("text", "")
                content = "\n- ".join(content) if isinstance(content, list) else str(content)
                
                title = payload.get("title", "No Title")
                aid = payload.get("article_id") or payload.get("metadata", {}).get("article_id", "unknown")
                
                publish_date = payload.get("publish_date", "N/A")
                site_categories = payload.get("site_categories", payload.get("topic", "N/A"))
                
                sentiment_label = payload.get("ai_sentiment_label", "N/A")
                sentiment_confidence = payload.get("ai_sentiment_score", "N/A")
                
                if sentiment_label == "N/A" and "sentiment" in payload:
                    sentiment_confidence = payload["sentiment"] 
                    sentiment_label = "Positive" if sentiment_confidence > 0 else "Negative"
                
                context_parts.append(
                    f"--- Bài: {title} ---\n"
                    f"Ngày đăng: {publish_date}\n"
                    f"Cảm xúc AI: {sentiment_label} (Độ tin cậy: {sentiment_confidence})\n"
                    f"Chủ đề: {site_categories}\n"
                    f"Nội dung:\n{content}"
                )
                
                if title not in seen:
                    sources.append(SourcedAnswer(article_id=str(aid), title=title))
                    seen.add(title)

            chat_history_str = chr(10).join([
                f"- User: {h.query}\n  Bot: {h.answer}" 
                for h in reversed(history[:2])
            ])

            # [FIX 2] Prompt Engineering: Inject Dependency & Force Data Priority
            prompt_instruction = ""
            if dependency == "main":
                prompt_instruction = (
                    "CHÚ Ý: Đây là câu hỏi chính (Main Question). "
                    "Hãy ưu tiên sử dụng dữ liệu trong phần 'Dữ liệu tìm được' bên dưới để trả lời. "
                    "Chỉ tham khảo lịch sử chat nếu cần biết phong cách trả lời, KHÔNG dùng dữ liệu cũ nếu nó không liên quan."
                )
            else:
                prompt_instruction = "Lưu ý: Đây là câu hỏi phụ (Sub-question), hãy kết hợp ngữ cảnh lịch sử chat để trả lời mạch lạc."

            prompt = (
                f"Câu hỏi người dùng: {request.query} {context_query_append}\n"
                f"Loại câu hỏi: {dependency.upper()}\n"
                f"{prompt_instruction}\n\n"
                f"Lịch sử hội thoại (để tham khảo ngữ cảnh):\n"
                f"{chat_history_str}\n\n"
                f"Dữ liệu tìm được ({strategy}):\n{chr(10).join(context_parts)}\n\n"
                f"YÊU CẦU: Trả lời câu hỏi trên dựa trên dữ liệu cung cấp. Trích dẫn nguồn rõ ràng."
            )
            resp = await self.llm.generate_content_async(prompt)
            final_answer = resp.text

        await self._save_chat_history(request.user_id, conversation_id, request.query, final_answer, intent, dependency, sources)
        
        return ChatResponse(
            answer=final_answer, conversation_id=conversation_id, sources=sources,
            intent_detected=intent, dependency_label=dependency, strategy_used=strategy
        )




# import logging
# import uuid
# import asyncio
# from datetime import datetime, timedelta
# from typing import List, Dict, Optional, Tuple, Any
# from collections import defaultdict
# import json
# import re

# import google.generativeai as genai
# from qdrant_client import QdrantClient
# from qdrant_client.http import models as rest
# from bson import ObjectId
# from pymongo import DESCENDING, ASCENDING

# from config import settings
# from database import get_mongo_db
# from models import ChatRequest, ChatResponse, ChatHistory, SourcedAnswer, ChatContext

# logger = logging.getLogger(__name__)

# # --- SYSTEM PROMPT ROUTER ---
# SYSTEM_PROMPT_ROUTER = """
# Bạn là AI Query Router. Nhiệm vụ: Phân tích ngữ cảnh và câu hỏi để định tuyến.

# --- INPUT DATA ---
# 1. Context Page: "home_page" | "list_page" | "detail_page" | "my_page"
# 2. Query: Câu hỏi user.
# 3. Chat History: Lịch sử.

# --- PHÂN TÍCH ---
# 1. XÁC ĐỊNH DEPENDENCY (Sự phụ thuộc):
#     - "main": Câu hỏi ĐỘC LẬP, đầy đủ chủ ngữ/vị ngữ hoặc mở ra chủ đề mới.
#     - "sub": Câu hỏi PHỤ THUỘC (Follow-up). Dấu hiệu: 
#         + Đại từ thay thế ("nó", "ông ấy", "bài này", "danh sách đó", ...).
#         + Câu hỏi ngắn/cụt ("thế còn tác giả?", "còn ngày mai?", "tại sao?", ...).
#         + Bắt đầu bằng từ nối ("vậy thì", "nếu thế", ...).
#         + Tham chiếu thứ tự ("bài 1", "cái thứ 2", "phần đầu"...).
#         + Tham chiếu nội dung ("bài về giá vàng", "tin lạm phát"...).

# 2. INTENT:
#     - "contextual_summary": Tóm tắt, tổng hợp thông tin từ Context hiện tại.
#     - "specific_detail": Hỏi chi tiết về 1 đối tượng cụ thể.
#     - "general_search": Tìm kiếm mở rộng, kiến thức chung.

# 3. TRÍCH XUẤT FILTERS & QUANTITY:
#     - website: "vneconomy.vn" | "vnexpress.net"
#     - days_ago: int (VD: "3 ngày qua" -> 3)
#     - topic: string (Chủ đề bài báo).
#     - sentiment: "positive" | "negative" | "neutral"
#     - quantity: int (Số lượng bài báo user muốn xử lý. VD: "5 bài đầu", "top 3" -> 5, 3. Mặc định null).

# --- LOGIC MATRIX ---
# | Page | Query keywords | -> Intent |
# | :--- | :--- | :--- |
# | **list_page** | Từ khóa số nhiều ("các bài", "danh sách", "những tin này") HOẶC từ khóa tóm tắt ("tổng hợp", "điểm tin") | -> **contextual_summary** |
# | **my_page** | Từ khóa sở hữu/tổng hợp ("bài của tôi", "tài liệu vừa up", "tóm tắt") | -> **contextual_summary** |
# | **my_page** | Hỏi chi tiết trong tài liệu đã up | -> **specific_detail** |
# | **detail_page** | Hỏi tóm tắt, nội dung chính, đại ý | -> **contextual_summary** |
# | **detail_page** | Hỏi ai, cái gì, ở đâu, khi nào (của bài báo này) | -> **specific_detail** |
# | **home_page** | Bất kỳ câu hỏi nào | -> **general_search** |

# OUTPUT JSON:
# {
#     "intent": "string",
#     "dependency": "string",
#     "filters": {
#         "website": "string | null",
#         "days_ago": "integer | null",
#         "topic": "string | null",
#         "sentiment": "string | null",
#         "quantity": "integer | null"
#     }
# }
# """

# SYSTEM_PROMPT_CHAT = (
#     "Bạn là trợ lý AI thông minh. Trả lời dựa trên thông tin cung cấp.\n"
#     "LƯU Ý QUAN TRỌNG:\n"
#     "- Nếu câu hỏi là câu phụ (Sub-question) hoặc tham chiếu số thứ tự (ví dụ: 'bài 1', 'tin đầu tiên', 'phần 1'), hãy CĂN CỨ VÀO LỊCH SỬ CHAT (câu trả lời trước của Bot) để xác định chính xác bài báo đang được nhắc đến.\n"
#     "- Luôn trích dẫn nguồn (Source) cho mọi thông tin đưa ra, mỗi bài báo chỉ trích dẫn nguồn 1 lần duy nhất."
# )

# class ChatService:
#     def __init__(self):
#         try:
#             genai.configure(api_key=settings.google_api_key)
#             self.llm = genai.GenerativeModel('gemini-2.5-flash', system_instruction=SYSTEM_PROMPT_CHAT)
#             self.router_llm = genai.GenerativeModel('gemini-2.5-flash', generation_config={"response_mime_type": "application/json"})
#             self.embedding_model = 'models/text-embedding-004'
#             self.vector_size = 384
            
#             self.db = get_mongo_db()
#             self.chat_histories_collection = self.db['chat_histories']
#             self.articles_collection = self.db['articles'] 
            
#             self.qdrant_client = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key)
#             self.qdrant_collection_name = settings.qdrant_collection_name
#             logger.info(f"ChatService V18.0 Ready (Updated: Fix Quantity Logic & Prompt Injection).")
#         except Exception as e:
#             logger.error(f"Init Error: {e}")
#             raise

#     async def _get_chat_history(self, user_id: str, conversation_id: str) -> List[ChatHistory]:
#         cursor = self.chat_histories_collection.find({
#             "user_id": user_id, "conversation_id": conversation_id
#         }).sort("created_at", -1).limit(5)
#         history = await cursor.to_list(length=5)
#         return [ChatHistory(**h) for h in history]

#     async def _save_chat_history(self, user_id: str, conversation_id: str, query: str, answer: str, intent: str, dependency: str, sources: List[SourcedAnswer]):
#         await self.chat_histories_collection.insert_one({
#             "user_id": user_id, "conversation_id": conversation_id,
#             "query": query, "answer": answer, 
#             "intent": intent, "dependency": dependency,
#             "sources": [s.dict() for s in sources],
#             "created_at": datetime.utcnow()
#         })

#     async def _analyze_query(self, query: str, history: List[ChatHistory], context: ChatContext) -> Dict[str, Any]:
#         try:
#             chronological_history = list(reversed(history))
#             history_txt = "\n".join([f"User: {h.query}\nBot: {h.answer}" for h in chronological_history])
            
#             prompt = (
#                 f"{SYSTEM_PROMPT_ROUTER}\n\n"
#                 f"--- RUNTIME DATA ---\n"
#                 f"Context Page: {context.current_page}\n"
#                 f"Chat History:\n{history_txt}\n"
#                 f"Current Query: {query}\n"
#             )
#             response = await self.router_llm.generate_content_async(prompt)
#             return json.loads(response.text)
#         except Exception as e:
#             logger.error(f"Router Error: {e}")
#             return {"dependency": "main", "intent": "general_search", "filters": {}}

#     async def _get_top_article_ids_from_mongo(self, search_id: str, sort_by: str, sort_order: str, limit: int) -> List[str]:
#         if not search_id:
#             return []
        
#         sort_field = "publish_date"
#         if sort_by == "sentiment":
#             sort_field = "sentiment" 
#         elif sort_by == "publish_date":
#             sort_field = "publish_date"
            
#         direction = DESCENDING if sort_order == "desc" else ASCENDING
        
#         logger.info(f"🔍 Mongo Sort: search_id={search_id} | field={sort_field} | dir={direction} | limit={limit}")
        
#         cursor = self.articles_collection.find(
#             {"search_id": search_id},
#             {"article_id": 1}
#         ).sort(sort_field, direction).limit(limit)
        
#         docs = await cursor.to_list(length=limit)
#         return [doc["article_id"] for doc in docs if "article_id" in doc]

#     def _build_qdrant_filters(self, base_filters: dict, extracted_filters: dict) -> Optional[rest.Filter]:
#         conditions = []
        
#         for key, value in base_filters.items():
#             if value:
#                 if key == "article_id":
#                     if isinstance(value, list):
#                         conditions.append(rest.FieldCondition(key="article_id", match=rest.MatchAny(any=value)))
#                     else:
#                         conditions.append(rest.FieldCondition(key="article_id", match=rest.MatchValue(value=value)))
#                 elif key == "search_id":
#                     conditions.append(rest.FieldCondition(key="search_id", match=rest.MatchValue(value=value)))
#                 elif key == "update_id":
#                     conditions.append(rest.FieldCondition(key="update_id", match=rest.MatchValue(value=value)))
#                 else:
#                     conditions.append(rest.FieldCondition(key=key, match=rest.MatchValue(value=value)))

#         ai_filters = extracted_filters.get("filters", {})
        
#         if ai_filters.get("website"):
#             conditions.append(rest.FieldCondition(key="website", match=rest.MatchValue(value=ai_filters['website'])))
        
#         if ai_filters.get("topic"):
#             raw_topic = ai_filters['topic'].strip()
#             topic_variations = list(set([
#                 raw_topic, raw_topic.lower(), raw_topic.capitalize(), raw_topic.title(), raw_topic.upper()
#             ]))
#             conditions.append(rest.FieldCondition(key="topic", match=rest.MatchAny(any=topic_variations)))
        
#         if ai_filters.get("sentiment"):
#             val = ai_filters['sentiment']
#             sentiment_map = {
#                 "positive": "Tích cực",
#                 "negative": "Tiêu cực",
#                 "neutral": "Trung tính"
#             }
#             mapped_label = sentiment_map.get(val)
#             if mapped_label:
#                 conditions.append(rest.FieldCondition(key="ai_sentiment_label", match=rest.MatchValue(value=mapped_label)))
#             else:
#                 if val == "positive": 
#                     conditions.append(rest.FieldCondition(key="sentiment", range=rest.Range(gte=0.25)))
#                 elif val == "negative": 
#                     conditions.append(rest.FieldCondition(key="sentiment", range=rest.Range(lte=-0.25)))
        
#         if ai_filters.get("days_ago") and isinstance(ai_filters["days_ago"], int):
#             cutoff_date = datetime.utcnow() - timedelta(days=ai_filters["days_ago"])
#             conditions.append(rest.FieldCondition(key="publish_date", range=rest.DatetimeRange(gte=cutoff_date.isoformat())))

#         return rest.Filter(must=conditions) if conditions else None

#     async def _search_qdrant(self, query: str, qdrant_filter: Optional[rest.Filter], limit: int = 5) -> List[rest.ScoredPoint]:
#         try:
#             logger.info(f"🔍 Qdrant Search | Limit: {limit} | Filter: {qdrant_filter}")
#             embedding_result = genai.embed_content(
#                 model=self.embedding_model, content=query, task_type="retrieval_query", output_dimensionality=self.vector_size
#             )
            
#             results = self.qdrant_client.search(
#                 collection_name=self.qdrant_collection_name,
#                 query_vector=embedding_result['embedding'],
#                 query_filter=qdrant_filter,
#                 limit=limit
#             )
#             return results
#         except Exception as e:
#             logger.error(f"❌ Qdrant Search Error: {e}")
#             return []

#     async def _resolve_article_id(self, input_id: str) -> str:
#         if not input_id or len(input_id) != 24: return input_id
#         try:
#             doc = await self.articles_collection.find_one({"_id": ObjectId(input_id)}, {"article_id": 1})
#             return doc["article_id"] if doc else input_id
#         except: return input_id
    
#     def _smart_resolve_article(self, query: str, sources: List[SourcedAnswer]) -> Optional[Tuple[str, str]]:
#         if not sources:
#             return None

#         # 1. Check Ordinal 
#         match = re.search(r'(?:bài|tin|phần|số|mục)\s+(?:thứ\s+)?(\d+)', query.lower())
#         if match:
#             try:
#                 val = int(match.group(1))
#                 idx = val - 1 if val > 0 else 0
#                 if 0 <= idx < len(sources):
#                     logger.info(f"🔗 Detected Ordinal Ref: Index {idx} -> {sources[idx].title}")
#                     return sources[idx].article_id, sources[idx].title
#             except:
#                 pass
        
#         # Check text ordinal
#         lower_q = query.lower()
#         if "đầu tiên" in lower_q or "thứ nhất" in lower_q: return sources[0].article_id, sources[0].title
#         if ("thứ hai" in lower_q or "thứ 2" in lower_q) and len(sources) > 1: return sources[1].article_id, sources[1].title
        
#         # 2. Check Semantic Keyword Matching
#         best_match = None
#         max_score = 0
#         query_tokens = set(lower_q.split())
        
#         for src in sources:
#             title_tokens = set(src.title.lower().split())
#             intersection = query_tokens.intersection(title_tokens)
#             score = len(intersection)
            
#             valid_match = False
#             if score >= 2:
#                 valid_match = True
#             elif score == 1:
#                 matched_word = list(intersection)[0]
#                 if len(matched_word) > 4: 
#                     valid_match = True
            
#             if valid_match and score > max_score:
#                 max_score = score
#                 best_match = src
        
#         if best_match:
#             return best_match.article_id, best_match.title

#         return None

#     async def handle_chat(self, request: ChatRequest) -> ChatResponse:
#         conversation_id = request.conversation_id or str(uuid.uuid4())
        
#         if request.context.current_page == "detail_page" and request.context.article_id:
#             request.context.article_id = await self._resolve_article_id(request.context.article_id)

#         history = await self._get_chat_history(request.user_id, conversation_id)
        
#         analysis = await self._analyze_query(request.query, history, request.context)
#         intent = analysis.get("intent", "general_search")
#         dependency = analysis.get("dependency", "main")
#         extracted_filters = analysis.get("filters", {})
        
#         requested_quantity = extracted_filters.get("quantity")
#         limit = requested_quantity if requested_quantity else 5
        
#         logger.info(f"Analysis -> Intent: {intent} | Quantity: {requested_quantity}")

#         search_query = request.query
#         context_query_append = ""
        
#         target_article_id = None
#         target_article_title = None

#         # [FIX 1] Logic Smart Reference chỉ chạy khi không phải yêu cầu số lượng nhiều
#         # Nếu user hỏi "3 bài", ta cần list, không phải 1 bài cụ thể.
#         is_plural_request = requested_quantity and requested_quantity > 1

#         if dependency == "sub" and not is_plural_request:
#             last_bot_sources = history[0].sources if history else []
#             resolved = self._smart_resolve_article(search_query, last_bot_sources)
            
#             if resolved:
#                 target_article_id, target_article_title = resolved
#                 context_query_append = f"(Người dùng đang hỏi về bài: '{target_article_title}')"
            
#             last_main_query = next((h.query for h in history if getattr(h, 'dependency', 'main') == 'main'), None)
#             if last_main_query:
#                 search_query = f"{last_main_query} {search_query}"
#                 if not context_query_append:
#                     context_query_append = f"(Ngữ cảnh cũ: '{last_main_query}')"

#         base_filters = {}
#         strategy = "Global Search"
#         should_fallback_to_global = False

#         is_list_sort_context = (
#             request.context.current_page == "list_page" and 
#             request.context.search_id and 
#             request.context.sort_by and 
#             request.context.sort_by != "relevance"
#         )
        
#         has_content_filters = any(
#             extracted_filters.get(k) is not None
#             for k in ["topic", "website", "sentiment", "days_ago"]
#         )

#         top_sorted_ids = []

#         # --- LOGIC CHIẾN LƯỢC TÌM KIẾM ---
#         if target_article_id:
#             base_filters = {"article_id": target_article_id}
#             base_filters["type"] = "chunk" 
#             strategy = f"Smart Reference (Target: {target_article_title})"
#             if "topic" in extracted_filters: 
#                 del extracted_filters["topic"]
#             if "website" in extracted_filters: del extracted_filters["website"]
#             if "days_ago" in extracted_filters: del extracted_filters["days_ago"]
        
#         elif request.context.current_page == "detail_page" and request.context.article_id:
#             base_filters = {"article_id": request.context.article_id}
#             strategy = "Single Page Context"

#         elif request.context.current_page == "list_page" and request.context.search_id:
#             if has_content_filters:
#                 base_filters = {"search_id": request.context.search_id}
#                 strategy = "Scoped Search (With Filters)"
#                 should_fallback_to_global = True
#             elif is_list_sort_context:
#                 if intent == "contextual_summary" or (dependency == "sub" and intent == "specific_detail"):
#                     top_sorted_ids = await self._get_top_article_ids_from_mongo(
#                         request.context.search_id,
#                         request.context.sort_by,
#                         request.context.sort_order or "desc",
#                         limit
#                     )
#                     if top_sorted_ids:
#                         base_filters = {"article_id": top_sorted_ids}
#                         strategy = f"List Sort ({request.context.sort_by}) [Sub/Summary]"
#                         limit = len(top_sorted_ids) 
#                     else:
#                         base_filters = {"search_id": request.context.search_id}
#                         strategy = "Session Context (Fallback)"
#                 else:
#                     base_filters = {"search_id": request.context.search_id}
#                     strategy = "Session Context (Filtered)"
#             elif intent == "contextual_summary":
#                 base_filters = {"search_id": request.context.search_id}
#                 strategy = "Session Context (Summary)"
#             elif intent == "general_search" or intent == "specific_detail":
#                 base_filters = {"search_id": request.context.search_id}
#                 strategy = "Session Context (Search)"
#                 should_fallback_to_global = True 
        
#         elif request.context.current_page == "my_page":
#             base_filters["type"] = "my-page"
#             strategy = "My Page Search"
#             if request.context.update_id:
#                 base_filters["update_id"] = request.context.update_id
#                 strategy = f"My Page (UpdateID: {request.context.update_id})"
#             else:
#                 strategy = "My Page (All User Uploads)"
                
#         if target_article_id:
#             pass 
#         elif intent == "contextual_summary" and request.context.current_page != "my_page":
#             base_filters["type"] = "ai_summary"
#         elif "type" not in base_filters:
#             if request.context.current_page != "my_page":
#                 base_filters["type"] = "chunk"

#         # --- THỰC HIỆN TÌM KIẾM ---
#         final_filter = self._build_qdrant_filters(base_filters, {"filters": extracted_filters})
#         results = await self._search_qdrant(search_query, final_filter, limit=limit)

#         if not results and should_fallback_to_global:
#             logger.info("⚠️ Scoped Search empty. Fallback to Global Search...")
#             if "search_id" in base_filters: del base_filters["search_id"]
#             if base_filters.get("type") == "chunk": pass 
            
#             final_filter = self._build_qdrant_filters(base_filters, {"filters": extracted_filters})
#             results = await self._search_qdrant(search_query, final_filter, limit=limit)
#             if results: strategy = "Global Search (Fallback from Scoped)"

#         if not results and base_filters.get("type") == "ai_summary":
#             logger.info("⚠️ No pre-computed summaries found. Fallback to full text search...")
#             if "type" in base_filters: 
#                 del base_filters["type"]
#                 if request.context.current_page == "my_page": base_filters["type"] = "my-page"
            
#             final_filter = self._build_qdrant_filters(base_filters, {"filters": extracted_filters})
#             results = await self._search_qdrant(search_query, final_filter, limit=limit)

#         # --- RE-SORT RESULTS ---
#         if results:
#             def get_id(point):
#                 return point.payload.get("article_id") or point.payload.get("metadata", {}).get("article_id")
            
#             if top_sorted_ids:
#                 id_map = {str(aid): i for i, aid in enumerate(top_sorted_ids)}
#                 results.sort(key=lambda x: id_map.get(str(get_id(x)), 999))
#                 logger.info("✅ Re-sorted results match Mongo ID list (Sync Sources).")
#             elif intent == "contextual_summary" and not target_article_id:
#                 results.sort(key=lambda x: x.payload.get("publish_date", ""), reverse=True)
#                 logger.info("✅ Re-sorted results by Date Desc for Summary (Sync Sources).")

#         context_parts = []
#         sources = []
#         seen = set()

#         if not results:
#             if intent == "contextual_summary":
#                 final_answer = "Hiện không tìm thấy nội dung phù hợp để tóm tắt."
#             else:
#                 final_answer = "Không tìm thấy thông tin phù hợp trong danh sách này."
#         else:
#             for pt in results:
#                 payload = pt.payload or {}
                
#                 content = payload.get("summary_text") if payload.get("type") == "ai_summary" else payload.get("text", "")
#                 content = "\n- ".join(content) if isinstance(content, list) else str(content)
                
#                 title = payload.get("title", "No Title")
#                 aid = payload.get("article_id") or payload.get("metadata", {}).get("article_id", "unknown")
                
#                 publish_date = payload.get("publish_date", "N/A")
#                 site_categories = payload.get("site_categories", payload.get("topic", "N/A"))
                
#                 sentiment_label = payload.get("ai_sentiment_label", "N/A")
#                 sentiment_confidence = payload.get("ai_sentiment_score", "N/A")
                
#                 if sentiment_label == "N/A" and "sentiment" in payload:
#                     sentiment_confidence = payload["sentiment"] 
#                     sentiment_label = "Positive" if sentiment_confidence > 0 else "Negative"
                
#                 context_parts.append(
#                     f"--- Bài: {title} ---\n"
#                     f"Ngày đăng: {publish_date}\n"
#                     f"Cảm xúc AI: {sentiment_label} (Độ tin cậy: {sentiment_confidence})\n"
#                     f"Chủ đề: {site_categories}\n"
#                     f"Nội dung:\n{content}"
#                 )
                
#                 if title not in seen:
#                     sources.append(SourcedAnswer(article_id=str(aid), title=title))
#                     seen.add(title)

#             chat_history_str = chr(10).join([
#                 f"- User: {h.query}\n  Bot: {h.answer}" 
#                 for h in reversed(history[:2])
#             ])

#             # [FIX 2] Prompt Engineering: Inject Dependency & Force Data Priority
#             prompt_instruction = ""
#             if dependency == "main":
#                 prompt_instruction = (
#                     "CHÚ Ý: Đây là câu hỏi chính (Main Question). "
#                     "Hãy ưu tiên sử dụng dữ liệu trong phần 'Dữ liệu tìm được' bên dưới để trả lời. "
#                     "Chỉ tham khảo lịch sử chat nếu cần biết phong cách trả lời, KHÔNG dùng dữ liệu cũ nếu nó không liên quan."
#                 )
#             else:
#                 prompt_instruction = "Lưu ý: Đây là câu hỏi phụ (Sub-question), hãy kết hợp ngữ cảnh lịch sử chat để trả lời mạch lạc."

#             prompt = (
#                 f"Câu hỏi người dùng: {request.query} {context_query_append}\n"
#                 f"Loại câu hỏi: {dependency.upper()}\n"
#                 f"{prompt_instruction}\n\n"
#                 f"Lịch sử hội thoại (để tham khảo ngữ cảnh):\n"
#                 f"{chat_history_str}\n\n"
#                 f"Dữ liệu tìm được ({strategy}):\n{chr(10).join(context_parts)}\n\n"
#                 f"YÊU CẦU: Trả lời câu hỏi trên dựa trên dữ liệu cung cấp. Trích dẫn nguồn rõ ràng."
#             )
#             resp = await self.llm.generate_content_async(prompt)
#             final_answer = resp.text

#         await self._save_chat_history(request.user_id, conversation_id, request.query, final_answer, intent, dependency, sources)
        
#         return ChatResponse(
#             answer=final_answer, conversation_id=conversation_id, sources=sources,
#             intent_detected=intent, dependency_label=dependency, strategy_used=strategy
#         )