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
1. Context Page: "home_page" | "list_page" | "detail_page"
2. Query: Câu hỏi user.
3. Chat History: Lịch sử.

--- PHÂN TÍCH ---
1. XÁC ĐỊNH DEPENDENCY (Sự phụ thuộc):
    - "main": Câu hỏi ĐỘC LẬP, đầy đủ chủ ngữ/vị ngữ hoặc mở ra chủ đề mới.
    - "sub": Câu hỏi PHỤ THUỘC (Follow-up). Dấu hiệu: 
        + Đại từ thay thế ("nó", "ông ấy", "bài này", "danh sách đó", ...).
        + Câu hỏi ngắn/cụt ("thế còn tác giả?", "còn ngày mai?", "tại sao?", ...).
        + Bắt đầu bằng từ nối ("vậy thì", "nếu thế", ...).

2. INTENT:
    - "contextual_summary": Tóm tắt, tổng hợp thông tin từ Context hiện tại (List hoặc Detail).
    - "specific_detail": Hỏi chi tiết về 1 đối tượng cụ thể.
    - "general_search": Tìm kiếm mở rộng, kiến thức chung.

3. TRÍCH XUẤT FILTERS & QUANTITY:
    - website: "vneconomy.vn" | "vnexpress.net"
    - days_ago: int (VD: "3 ngày qua" -> 3)
    - topic: string (Chủ đề bài báo.)
    - sentiment: "positive" | "negative"
    - quantity: int (Số lượng bài báo user muốn xử lý. VD: "5 bài đầu", "top 3" -> 5, 3. Mặc định null).

--- LOGIC MATRIX ---
| Page | Query keywords | -> Intent |
| :--- | :--- | :--- |
| **list_page** | Từ khóa số nhiều ("các bài", "danh sách", "những tin này") HOẶC từ khóa tóm tắt ("tổng hợp", "điểm tin") | -> **contextual_summary** |
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
    "- Luôn trích dẫn nguồn (Source) cho mọi thông tin đưa ra."
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
            logger.info(f"ChatService V12 Ready (Sub-question Context Fix).")
        except Exception as e:
            logger.error(f"Init Error: {e}")
            raise

    async def _get_chat_history(self, user_id: str, conversation_id: str) -> List[ChatHistory]:
        cursor = self.chat_histories_collection.find({
            "user_id": user_id, "conversation_id": conversation_id
        }).sort("created_at", -1).limit(5)
        history = await cursor.to_list(length=5)
        return [ChatHistory(**h) for h in history]

    async def _save_chat_history(self, user_id: str, conversation_id: str, query: str, answer: str, intent: str, dependency: str):
        await self.chat_histories_collection.insert_one({
            "user_id": user_id, "conversation_id": conversation_id,
            "query": query, "answer": answer, 
            "intent": intent, "dependency": dependency,
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
        """
        Truy vấn MongoDB để lấy danh sách Article ID đã được sắp xếp chính xác.
        """
        if not search_id:
            return []
        
        # Mapping sort key
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
                else:
                    conditions.append(rest.FieldCondition(key=key, match=rest.MatchValue(value=value)))

        ai_filters = extracted_filters.get("filters", {})
        
        if ai_filters.get("website"):
            conditions.append(rest.FieldCondition(key="metadata.website", match=rest.MatchValue(value=ai_filters['website'])))
        if ai_filters.get("topic"):
            conditions.append(rest.FieldCondition(key="topic", match=rest.MatchValue(value=ai_filters['topic'])))
        if ai_filters.get("sentiment"):
            val = ai_filters['sentiment']
            if val == "positive": conditions.append(rest.FieldCondition(key="sentiment", range=rest.Range(gte=0.25)))
            elif val == "negative": conditions.append(rest.FieldCondition(key="sentiment", range=rest.Range(lte=-0.25)))
        
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
        if dependency == "sub":
            last_main_query = next((h.query for h in history if getattr(h, 'dependency', 'main') == 'main'), None)
            if last_main_query:
                search_query = f"{last_main_query} {search_query}"
                context_query_append = f"(Ngữ cảnh cũ: '{last_main_query}')"

        base_filters = {}
        strategy = "Global Search"

        is_list_sort_context = (
            request.context.current_page == "list_page" and 
            request.context.search_id and 
            request.context.sort_by and 
            request.context.sort_by != "relevance"
        )
        
        if is_list_sort_context:
            if intent == "contextual_summary" or (dependency == "sub" and intent == "specific_detail"):
                top_ids = await self._get_top_article_ids_from_mongo(
                    request.context.search_id,
                    request.context.sort_by,
                    request.context.sort_order or "desc",
                    limit
                )
                if top_ids:
                    base_filters = {"article_id": top_ids}
                    strategy = f"List Sort ({request.context.sort_by}) [Sub/Summary]"
                    limit = len(top_ids) 
                else:
                    base_filters = {"search_id": request.context.search_id}
                    strategy = "Session Context (Fallback)"

        elif request.context.current_page == "detail_page" and request.context.article_id:
            base_filters = {"article_id": request.context.article_id}
            strategy = "Single Page Context"

        elif request.context.current_page == "list_page" and request.context.search_id:
            if intent == "contextual_summary" or intent == "general_search":
                base_filters = {"search_id": request.context.search_id}
                strategy = "Session Context (Relevance)"
        
        if intent == "contextual_summary":
            base_filters["type"] = "ai_summary"
        elif "type" not in base_filters:
            base_filters["type"] = "ai_summary"

        final_filter = self._build_qdrant_filters(base_filters, {"filters": extracted_filters})
        results = await self._search_qdrant(search_query, final_filter, limit=limit)

        if not results and base_filters.get("type") == "ai_summary" and intent != "contextual_summary":
            logger.info("⚠️ No summaries found. Fallback to full text search (Non-summary intent)...")
            if "type" in base_filters: del base_filters["type"]
            final_filter = self._build_qdrant_filters(base_filters, {"filters": extracted_filters})
            results = await self._search_qdrant(search_query, final_filter, limit=limit)

        context_parts = []
        sources = []
        seen = set()

        if not results:
            if intent == "contextual_summary":
                final_answer = "Hiện chưa có bản tóm tắt tự động nào cho các bài báo này."
            else:
                final_answer = "Không tìm thấy thông tin phù hợp trong danh sách này."
        else:
            for pt in results:
                payload = pt.payload or {}
                content = payload.get("summary_text") if payload.get("type") == "ai_summary" else payload.get("text", "")
                content = "\n- ".join(content) if isinstance(content, list) else str(content)
                
                title = payload.get("title", "No Title")
                aid = payload.get("article_id") or payload.get("metadata", {}).get("article_id", "unknown")
                
                context_parts.append(f"--- Bài: {title} ---\n{content}")
                if title not in seen:
                    sources.append(SourcedAnswer(article_id=str(aid), title=title))
                    seen.add(title)

            chat_history_str = chr(10).join([
                f"- User: {h.query}\n  Bot: {h.answer}" 
                for h in reversed(history[:2])
            ])

            prompt = (
                f"Câu hỏi người dùng: {request.query} {context_query_append}\n"
                f"Lịch sử hội thoại (để tham khảo ngữ cảnh):\n"
                f"{chat_history_str}\n\n"
                f"Dữ liệu tìm được ({strategy}):\n{chr(10).join(context_parts)}\n\n"
                f"YÊU CẦU: Trả lời câu hỏi trên. Nếu là câu hỏi phụ (sub) hoặc tham chiếu số thứ tự, hãy kết hợp ngữ cảnh câu trước."
            )
            resp = await self.llm.generate_content_async(prompt)
            final_answer = resp.text

        await self._save_chat_history(request.user_id, conversation_id, request.query, final_answer, intent, dependency)
        
        return ChatResponse(
            answer=final_answer, conversation_id=conversation_id, sources=sources,
            intent_detected=intent, dependency_label=dependency, strategy_used=strategy
        )