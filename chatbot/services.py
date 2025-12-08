import logging
import uuid
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple, Any
from collections import defaultdict
import json

import google.generativeai as genai
from qdrant_client import QdrantClient
from qdrant_client.http import models as rest
from bson import ObjectId

from config import settings
from database import get_mongo_db
from models import ChatRequest, ChatResponse, ChatHistory, SourcedAnswer, ChatContext

logger = logging.getLogger(__name__)

# --- SYSTEM PROMPTS NÂNG CẤP (ROUTER V5 - Dual Classification) ---
SYSTEM_PROMPT_ROUTER = """
Bạn là chuyên gia phân tích câu hỏi (Query Analyzer).
Nhiệm vụ: Phân tích câu hỏi để xác định Ý ĐỊNH (Intent), NHÃN CÂU HỎI(dependency) và trích xuất BỘ LỌC (Filters).
1. NHÃN CÂU HỎI (dependency): 
    - "main": Câu hỏi ĐỘC LẬP, mở ra chủ đề mới. Người nghe không cần biết hội thoại trước đó vẫn hiểu được trọn vẹn ý nghĩa.
        (VD: "Giá vàng hôm nay?", "Tóm tắt bài báo về anh Trung", "Ai là người giàu nhất VN?").
        
    - "sub": Câu hỏi PHỤ THUỘC (Follow-up). Dấu hiệu nhận biết:
        + Chứa đại từ nhân xưng thay thế cho đối tượng ở câu trước ("anh ấy", "cô ta", "họ", "nó", "người này", "vị này", "anh", "chị").
        + Ám chỉ hành động hoặc sự kiện vừa nhắc đến ("tại sao lại làm thế?", "kết quả ra sao?", "như vậy có đúng không?").
        + Câu hỏi cụt hoặc thiếu chủ ngữ ("còn tác giả?", "ngày nào?", "ở đâu?").
        + Bắt đầu bằng từ nối ("vậy thì...", "thế còn...", "tại sao...").

2. PHÂN LOẠI Ý ĐỊNH (intent):
    - "contextual_summary": Hỏi tóm tắt, ý chính về nội dung bài báo đang xem.
    - "specific_detail": Hỏi thông tin cụ thể (ngày xuất bản, tác giả, số liệu, sự kiện) trong bài báo đang xem.
    - "general_search": Tìm kiếm bài báo khác, hỏi về chủ đề rộng, hoặc lọc theo thời gian/nguồn.

    QUY TẮC PHÂN LOẠI:
    - Nếu Context Page = "detail_page" VÀ câu hỏi liên quan đến bài hiện tại (VD: "khi nào", "ngày nào", "tác giả", "chi tiết") -> "specific_detail".
    - Chỉ chọn "general_search" nếu câu hỏi muốn tìm bài KHÁC.

3. TRÍCH XUẤT BỘ LỌC (filters):
    - website (string): "vneconomy.vn" hoặc "vnexpress.net".
    - days_ago (integer): Lọc theo khoảng thời gian lùi (VD: "3 ngày qua"). KHÔNG dùng cho câu hỏi ngày xuất bản cụ thể.
    - topic (string): Chủ đề bài báo.
    - sentiment (string): "positive" | "negative" | null.

OUTPUT JSON FORMAT:
{
    "intent": "string",
    "filters": {
        "website": "string | null",
        "days_ago": "integer | null",
        "topic": "string | null",
        "sentiment": "string | null"
    }
}
"""

SYSTEM_PROMPT_CHAT = (
    "Bạn là trợ lý AI thông minh. Trả lời dựa trên thông tin cung cấp.\n"
    "LƯU Ý:\n"
    "- Nếu câu hỏi là câu phụ (Sub-question), hãy trả lời trong ngữ cảnh của câu hỏi chính trước đó.\n"
    "- Luôn trích dẫn nguồn (Source) cho mọi thông tin đưa ra."
)

class ChatService:
    def __init__(self):
        try:
            genai.configure(api_key=settings.google_api_key)
            self.llm = genai.GenerativeModel('gemini-2.0-flash', system_instruction=SYSTEM_PROMPT_CHAT)
            self.router_llm = genai.GenerativeModel('gemini-2.0-flash', generation_config={"response_mime_type": "application/json"})
            self.embedding_model = 'models/text-embedding-004'
            self.vector_size = 384
            
            self.db = get_mongo_db()
            self.chat_histories_collection = self.db['chat_histories']
            self.articles_collection = self.db['articles'] 
            
            self.qdrant_client = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key)
            self.qdrant_collection_name = settings.qdrant_collection_name
            logger.info(f"ChatService V5 Ready (Dual Classification).")
        except Exception as e:
            logger.error(f"Init Error: {e}")
            raise

    async def _get_chat_history(self, user_id: str, conversation_id: str) -> List[ChatHistory]:
        # Lấy 5 câu gần nhất
        cursor = self.chat_histories_collection.find({
            "user_id": user_id, "conversation_id": conversation_id
        }).sort("created_at", -1).limit(5)
        history = await cursor.to_list(length=5)
        # Convert về object
        return [ChatHistory(**h) for h in history]

    async def _save_chat_history(self, user_id: str, conversation_id: str, query: str, answer: str, intent: str, dependency: str):
        # Lưu thêm intent và dependency vào MongoDB
        await self.chat_histories_collection.insert_one({
            "user_id": user_id, "conversation_id": conversation_id,
            "query": query, "answer": answer, 
            "intent": intent, "dependency": dependency,
            "created_at": datetime.utcnow()
        })

    async def _analyze_query(self, query: str, history: List[ChatHistory], context: ChatContext) -> Dict[str, Any]:
        try:
            # Đảo ngược history để Prompt đọc theo thứ tự thời gian: Cũ -> Mới
            chronological_history = list(reversed(history))
            # --- CÓ SỬ DỤNG ANSWER Ở ĐÂY ---
            history_txt = "\n".join([f"User: {h.query}\nBot: {h.answer}" for h in chronological_history])
            
            prompt = (
                f"{SYSTEM_PROMPT_ROUTER}\n\n"
                f"--- CONTEXT DATA ---\n"
                f"Context Page: {context.current_page}\n"
                f"Chat History:\n{history_txt}\n"
                f"Current Query: {query}\n"
            )
            response = await self.router_llm.generate_content_async(prompt)
            return json.loads(response.text)
        except Exception as e:
            logger.error(f"Router Error: {e}")
            return {"dependency": "main", "intent": "general_search", "filters": {}}

    def _build_qdrant_filters(self, base_filters: dict, extracted_filters: dict) -> Optional[rest.Filter]:
        conditions = []
        for key, value in base_filters.items():
            if value:
                conditions.append(rest.FieldCondition(key=key, match=rest.MatchValue(value=value)))

        ai_filters = extracted_filters.get("filters", {})
        if ai_filters.get("website"):
            conditions.append(rest.FieldCondition(key="website", match=rest.MatchValue(value=ai_filters['website'])))
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
            embedding_result = genai.embed_content(
                model=self.embedding_model, content=query, task_type="retrieval_query", output_dimensionality=self.vector_size
            )
            return self.qdrant_client.search(
                collection_name=self.qdrant_collection_name,
                query_vector=embedding_result['embedding'],
                query_filter=qdrant_filter,
                limit=limit
            )
        except Exception:
            return []

    async def _resolve_article_id(self, input_id: str) -> str:
        if not input_id or len(input_id) != 24: return input_id
        try:
            doc = await self.articles_collection.find_one({"_id": ObjectId(input_id)}, {"article_id": 1})
            return doc["article_id"] if doc else input_id
        except: return input_id

    async def handle_chat(self, request: ChatRequest) -> ChatResponse:
        conversation_id = request.conversation_id or str(uuid.uuid4())
        
        # 1. Resolve ID (Mongo -> UUID)
        if request.context.current_page == "detail_page" and request.context.article_id:
            request.context.article_id = await self._resolve_article_id(request.context.article_id)

        # 2. Get History
        history = await self._get_chat_history(request.user_id, conversation_id)
        
        # 3. Analyze (Router V5)
        analysis = await self._analyze_query(request.query, history, request.context)
        intent = analysis.get("intent", "general_search")
        dependency = analysis.get("dependency", "main")
        extracted_filters = analysis.get("filters", {})
        
        logger.info(f"Analysis -> Dependency: {dependency} | Intent: {intent}")

        # 4. Handle Dependency (Xử lý ngữ cảnh)
        search_query = request.query
        context_query_append = ""
        
        if dependency == "sub":
            # Nếu là câu phụ, tìm câu "main" gần nhất để ghép vào
            last_main_query = None
            for h in history:
                dep = getattr(h, 'dependency', 'main') 
                if dep == 'main':
                    last_main_query = h.query
                    break # Lấy câu main gần nhất
            
            if last_main_query:
                # Rewrite query để Search vector tốt hơn
                search_query = f"{last_main_query} {request.query}"
                # Chỉ hiển thị câu hỏi main cho AI biết ngữ cảnh, không cần answer ở đây
                context_query_append = f"(Ngữ cảnh từ câu hỏi chính: '{last_main_query}')"
                logger.info(f"--> Rewrite Query: {search_query}")

        # 5. Routing Strategy
        base_filters = {}
        strategy = "Global Search"
        
        has_global_filters = any(extracted_filters.values())

        if request.context.current_page == "detail_page" and request.context.article_id:
            if intent == "specific_detail" and "days_ago" in extracted_filters:
                del extracted_filters["days_ago"]
            
            if intent == "contextual_summary":
                 base_filters = {"article_id": request.context.article_id, "type": "ai_summary"}
                 strategy = "Single Summary"
            else:
                 base_filters = {"article_id": request.context.article_id}
                 strategy = "Deep Dive (Mixed Types)"

        elif has_global_filters:
            base_filters = {"type": "ai_summary"}
            strategy = "Global Search (Filters)"
            intent = "general_search"
            
        elif request.context.current_page == "list_page" and intent == "contextual_summary" and request.context.search_id:
            base_filters = {"search_id": request.context.search_id, "type": "ai_summary"}
            strategy = "List Summary"
        else:
            base_filters = {"type": "ai_summary"}

        # 6. Search Qdrant
        final_filter = self._build_qdrant_filters(base_filters, {"filters": extracted_filters})
        results = await self._search_qdrant(search_query, final_filter)

        # 7. Generate Answer
        context_parts = []
        sources = []
        seen = set()

        if not results:
            final_answer = "Không tìm thấy thông tin phù hợp."
        else:
            for pt in results:
                payload = pt.payload or {}
                content = ""
                if payload.get("type") == "ai_summary":
                     summary_data = payload.get("summary_text")
                     content = "\n- ".join(summary_data) if isinstance(summary_data, list) else str(summary_data)
                else:
                     content = payload.get("text", "")
                
                title = payload.get("title", "No Title")
                aid = payload.get("article_id", "unknown")
                
                context_parts.append(f"--- Bài: {title} ---\n{content}")
                if title not in seen:
                    sources.append(SourcedAnswer(article_id=str(aid), title=title))
                    seen.add(title)

            # --- UPDATE: Thêm Bot Answer vào lịch sử để tạo ngữ cảnh đầy đủ ---
            # Chỉ lấy 2 cặp gần nhất để tiết kiệm token
            chat_history_str = chr(10).join([
                f"- User: {h.query}\n  Bot: {h.answer}" 
                for h in reversed(history[:2])
            ])

            prompt = (
                f"Câu hỏi người dùng: {request.query} {context_query_append}\n"
                f"Lịch sử hội thoại (để tham khảo ngữ cảnh):\n"
                f"{chat_history_str}\n\n"
                f"Dữ liệu tìm được ({strategy}):\n{chr(10).join(context_parts)}\n\n"
                f"YÊU CẦU: Trả lời câu hỏi trên. Nếu là câu hỏi phụ (sub), hãy kết hợp ngữ cảnh câu trước."
            )
            resp = await self.llm.generate_content_async(prompt)
            final_answer = resp.text

        # 8. Save History
        await self._save_chat_history(
            request.user_id, conversation_id, 
            request.query, final_answer, 
            intent, dependency
        )
        
        return ChatResponse(
            answer=final_answer,
            conversation_id=conversation_id,
            sources=sources,
            intent_detected=intent,
            dependency_label=dependency,
            strategy_used=f"{strategy}"
        )