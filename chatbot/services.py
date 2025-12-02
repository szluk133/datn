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
from bson import ObjectId  # Import ObjectId để xử lý MongoDB ID

from config import settings
from database import get_mongo_db
from models import ChatRequest, ChatResponse, ChatHistory, SourcedAnswer, ChatContext

logger = logging.getLogger(__name__)

# --- SYSTEM PROMPTS NÂNG CẤP (ROUTER V4.1) ---
SYSTEM_PROMPT_ROUTER = """
Bạn là chuyên gia phân tích câu hỏi (Query Analyzer).
Nhiệm vụ: Phân tích câu hỏi để xác định Ý ĐỊNH (Intent) và trích xuất BỘ LỌC (Filters).

1. PHÂN LOẠI Ý ĐỊNH (intent):
   - "contextual_summary": Hỏi tóm tắt, ý chính về nội dung bài báo đang xem.
   - "specific_detail": Hỏi thông tin cụ thể (ngày xuất bản, tác giả, số liệu, sự kiện) trong bài báo đang xem.
   - "general_search": Tìm kiếm bài báo khác, hỏi về chủ đề rộng, hoặc lọc theo thời gian/nguồn.

   QUY TẮC PHÂN LOẠI:
   - Nếu Context Page = "detail_page" VÀ câu hỏi liên quan đến bài hiện tại (VD: "khi nào", "ngày nào", "tác giả", "chi tiết") -> "specific_detail".
   - Chỉ chọn "general_search" nếu câu hỏi muốn tìm bài KHÁC.

2. TRÍCH XUẤT BỘ LỌC (filters):
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
    "LƯU Ý VỀ DỮ LIỆU:\n"
    "- Nếu thông tin là danh sách các ý chính (summary points), hãy nối chúng lại thành đoạn văn mạch lạc.\n"
    "- Luôn trích dẫn nguồn: (Nguồn: [Tên báo] - [Tiêu đề])."
)

class ChatService:
    def __init__(self):
        try:
            genai.configure(api_key=settings.google_api_key)
            self.llm = genai.GenerativeModel('gemini-2.0-flash', system_instruction=SYSTEM_PROMPT_CHAT)
            self.router_llm = genai.GenerativeModel('gemini-2.0-flash', generation_config={"response_mime_type": "application/json"})
            self.embedding_model = 'models/text-embedding-004'
            
            # GIỮ NGUYÊN VECTOR SIZE 384
            self.vector_size = 384
            
            self.db = get_mongo_db()
            self.chat_histories_collection = self.db['chat_histories']
            
            # --- NEW: Thêm collection articles để tra cứu ID ---
            self.articles_collection = self.db['articles'] 
            
            self.qdrant_client = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key)
            self.qdrant_collection_name = settings.qdrant_collection_name
            logger.info(f"ChatService Ready (Vector Size: {self.vector_size}).")
        except Exception as e:
            logger.error(f"Init Error: {e}")
            raise

    async def _get_chat_history(self, user_id: str, conversation_id: str) -> List[ChatHistory]:
        cursor = self.chat_histories_collection.find({
            "user_id": user_id, "conversation_id": conversation_id
        }).sort("created_at", -1).limit(5)
        history = await cursor.to_list(length=5)
        return [ChatHistory(query=h['query'], answer=h['answer']) for h in reversed(history)]

    async def _save_chat_history(self, user_id: str, conversation_id: str, query: str, answer: str):
        await self.chat_histories_collection.insert_one({
            "user_id": user_id, "conversation_id": conversation_id,
            "query": query, "answer": answer, "created_at": datetime.utcnow()
        })

    async def _analyze_query(self, query: str, history: List[ChatHistory], context: ChatContext) -> Dict[str, Any]:
        try:
            history_txt = "\n".join([f"Q: {h.query}" for h in history[-2:]])
            prompt = (
                f"{SYSTEM_PROMPT_ROUTER}\n\n--- INPUT ---\n"
                f"Context Page: {context.current_page}\n"
                f"Current Query: {query}\n"
            )
            response = await self.router_llm.generate_content_async(prompt)
            return json.loads(response.text)
        except Exception:
            return {"intent": "general_search", "filters": {}}

    def _build_qdrant_filters(self, base_filters: dict, extracted_filters: dict) -> Optional[rest.Filter]:
        conditions = []

        # 1. Base Filters (Root Level)
        for key, value in base_filters.items():
            if value:
                conditions.append(rest.FieldCondition(key=key, match=rest.MatchValue(value=value)))

        # 2. Extracted Filters (Root Level)
        ai_filters = extracted_filters.get("filters", {})
        
        if ai_filters.get("website"):
            logger.info(f"--> Filter Website: {ai_filters['website']}")
            conditions.append(rest.FieldCondition(key="website", match=rest.MatchValue(value=ai_filters['website'])))

        if ai_filters.get("topic"):
            topic_val = ai_filters['topic']
            logger.info(f"--> Filter Topic: {topic_val}")
            conditions.append(rest.FieldCondition(key="topic", match=rest.MatchValue(value=topic_val)))

        if ai_filters.get("sentiment"):
            sentiment_val = ai_filters['sentiment']
            logger.info(f"--> Filter Sentiment: {sentiment_val}")
            if sentiment_val == "positive":
                conditions.append(rest.FieldCondition(key="sentiment", range=rest.Range(gte=0.25)))
            elif sentiment_val == "negative":
                conditions.append(rest.FieldCondition(key="sentiment", range=rest.Range(lte=-0.25)))

        if ai_filters.get("days_ago") and isinstance(ai_filters["days_ago"], int):
            cutoff_date = datetime.utcnow() - timedelta(days=ai_filters["days_ago"])
            cutoff_iso = cutoff_date.isoformat()
            logger.info(f"--> Filter Date >= {cutoff_iso}")
            conditions.append(rest.FieldCondition(key="publish_date", range=rest.DatetimeRange(gte=cutoff_iso)))

        return rest.Filter(must=conditions) if conditions else None

    async def _search_qdrant(self, query: str, qdrant_filter: Optional[rest.Filter], limit: int = 5) -> List[rest.ScoredPoint]:
        try:
            embedding_result = genai.embed_content(
                model=self.embedding_model,
                content=query,
                task_type="retrieval_query",
                output_dimensionality=self.vector_size
            )
            query_vector = embedding_result['embedding']
            
            return self.qdrant_client.search(
                collection_name=self.qdrant_collection_name,
                query_vector=query_vector,
                query_filter=qdrant_filter,
                limit=limit
            )
        except Exception as e:
            logger.error(f"Search Error: {e}")
            return []

    # --- NEW: Hàm helper để lấy article_id thật từ _id ---
    async def _resolve_article_id(self, input_id: str) -> str:
        """
        Nếu input_id là Mongo ObjectID (24 hex), tìm trong DB để lấy article_id (UUID).
        Nếu không phải hoặc không tìm thấy, trả về chính nó.
        """
        if not input_id:
            return input_id
            
        try:
            # Chỉ thử query nếu định dạng giống ObjectId (24 ký tự)
            if len(input_id) == 24:
                try:
                    oid = ObjectId(input_id)
                    doc = await self.articles_collection.find_one({"_id": oid}, {"article_id": 1})
                    if doc and "article_id" in doc:
                        logger.info(f"--> Resolved MongoID '{input_id}' to ArticleID '{doc['article_id']}'")
                        return doc["article_id"]
                except Exception:
                    pass # Không phải ObjectId hợp lệ, bỏ qua
            
            return input_id
        except Exception as e:
            logger.warning(f"Error resolving article_id: {e}")
            return input_id

    async def handle_chat(self, request: ChatRequest) -> ChatResponse:
        conversation_id = request.conversation_id or str(uuid.uuid4())
        
        # --- BƯỚC 0: Resolve Article ID nếu đang ở trang Detail ---
        if request.context.current_page == "detail_page" and request.context.article_id:
            # Tự động thay thế _id bằng article_id thật trước khi đi tiếp
            real_id = await self._resolve_article_id(request.context.article_id)
            request.context.article_id = real_id

        history = await self._get_chat_history(request.user_id, conversation_id)
        
        analysis = await self._analyze_query(request.query, history, request.context)
        intent = analysis.get("intent", "general_search")
        extracted_filters = analysis.get("filters", {})
        logger.info(f"Intent: {intent} | Filters: {extracted_filters}")

        # Routing Strategy
        base_filters = {}
        strategy = "Global Search"

        has_global_filters = any([
            extracted_filters.get("website"),
            extracted_filters.get("days_ago"),
            extracted_filters.get("sentiment"),
            extracted_filters.get("topic")
        ])

        # Priority Check: Detail Page
        if request.context.current_page == "detail_page" and request.context.article_id:
            # Xóa các filter thời gian nếu có để tránh conflict khi hỏi về ngày
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
            strategy = "Global Search (Forced by Filters)"
            intent = "general_search"
            
        elif request.context.current_page == "list_page" and intent == "contextual_summary" and request.context.search_id:
            base_filters = {"search_id": request.context.search_id, "type": "ai_summary"}
            strategy = "List Summary"
        else:
            base_filters = {"type": "ai_summary"}

        final_filter = self._build_qdrant_filters(base_filters, {"filters": extracted_filters})
        results = await self._search_qdrant(request.query, final_filter)

        context_parts = []
        sources = []
        seen = set()

        if not results:
            final_answer = "Không tìm thấy thông tin phù hợp (Kiểm tra lại ID bài báo hoặc bộ lọc)."
        else:
            for pt in results:
                payload = pt.payload or {}
                
                # --- Xử lý nội dung hiển thị ---
                content_text = ""
                p_type = payload.get("type", "unknown")
                
                if p_type == "ai_summary":
                    summary_arr = payload.get("summary_text", [])
                    raw_text = "\n- ".join(summary_arr) if isinstance(summary_arr, list) else str(summary_arr)
                    content_text = f"[SUMMARY CONTENT]: {raw_text}"
                else:
                    content_text = f"[CHUNK CONTENT]: {payload.get('text', '')}"

                title = payload.get("title", "Tài liệu không tên")
                
                aid = payload.get("article_id", "unknown")
                senti = payload.get("sentiment", "N/A")
                pub_date = payload.get("publish_date", "N/A")
                web = payload.get("website", "N/A")

                context_parts.append(
                    f"--- Bài: {title} (ID: {aid}) ---\n"
                    f"Metadata: [Date: {pub_date}, Web: {web}, Senti: {senti}, Type: {p_type}]\n"
                    f"{content_text}"
                )
                
                if title not in seen:
                    sources.append(SourcedAnswer(article_id=str(aid), title=title))
                    seen.add(title)

            prompt = (
                f"Câu hỏi: {request.query}\n\n"
                f"Thông tin tìm được ({strategy}):\n{chr(10).join(context_parts)}\n\n"
                f"Hãy trả lời câu hỏi trên."
            )
            resp = await self.llm.generate_content_async(prompt)
            final_answer = resp.text

        await self._save_chat_history(request.user_id, conversation_id, request.query, final_answer)
        
        return ChatResponse(
            answer=final_answer,
            conversation_id=conversation_id,
            sources=sources,
            intent_detected=intent,
            strategy_used=f"{strategy} {extracted_filters}"
        )


# import logging
# import uuid
# import asyncio
# from datetime import datetime, timedelta
# from typing import List, Dict, Optional, Tuple, Any
# from collections import defaultdict
# import json

# import google.generativeai as genai
# from qdrant_client import QdrantClient
# from qdrant_client.http import models as rest

# from config import settings
# from database import get_mongo_db
# from models import ChatRequest, ChatResponse, ChatHistory, SourcedAnswer, ChatContext

# logger = logging.getLogger(__name__)

# # --- SYSTEM PROMPTS NÂNG CẤP (ROUTER V3) ---
# SYSTEM_PROMPT_ROUTER = """
# Bạn là chuyên gia phân tích câu hỏi (Query Analyzer).
# Nhiệm vụ: Phân tích câu hỏi để xác định Ý ĐỊNH (Intent) và trích xuất BỘ LỌC (Filters).

# 1. PHÂN LOẠI Ý ĐỊNH (intent):
#    - "contextual_summary": Hỏi tóm tắt về nội dung đang xem.
#    - "specific_detail": Hỏi con số, dữ liệu chi tiết trong bài đang xem.
#    - "general_search": Hỏi rộng, tìm kiếm bài báo khác, tra cứu kiến thức.
   
#    QUY TẮC ƯU TIÊN:
#    - Nếu câu hỏi chứa Nguồn báo (VD: "báo Vneconomy") HOẶC Thời gian (VD: "tháng này") -> Luôn là "general_search".
#    - Nếu câu hỏi chứa Sentiment (VD: "tin tiêu cực", "biến động xấu") -> Luôn là "general_search".

# 2. TRÍCH XUẤT BỘ LỌC (filters):
#    - website (string): "vneconomy.vn" hoặc "vnexpress.net".
#    - days_ago (integer): Số ngày tính lùi từ hiện tại.
#    - topic (string): Chủ đề bài báo (VD: "Bất động sản", "Chứng khoán").
#    - sentiment (string): "positive" | "negative" | null.

# OUTPUT JSON FORMAT:
# {
#   "intent": "string",
#   "filters": {
#     "website": "string | null",
#     "days_ago": "integer | null",
#     "topic": "string | null",
#     "sentiment": "string | null"
#   }
# }
# """

# SYSTEM_PROMPT_CHAT = (
#     "Bạn là trợ lý AI thông minh. Trả lời dựa trên thông tin cung cấp.\n"
#     "LƯU Ý VỀ DỮ LIỆU:\n"
#     "- Nếu thông tin là danh sách các ý chính (summary points), hãy nối chúng lại thành đoạn văn mạch lạc.\n"
#     "- Luôn trích dẫn nguồn: (Nguồn: [Tên báo] - [Tiêu đề])."
# )

# class ChatService:
#     def __init__(self):
#         try:
#             genai.configure(api_key=settings.google_api_key)
#             self.llm = genai.GenerativeModel('gemini-2.0-flash', system_instruction=SYSTEM_PROMPT_CHAT)
#             self.router_llm = genai.GenerativeModel('gemini-2.0-flash', generation_config={"response_mime_type": "application/json"})
#             self.embedding_model = 'models/text-embedding-004'
            
#             # Cấu hình Vector Size
#             self.vector_size = 384
            
#             self.db = get_mongo_db()
#             self.chat_histories_collection = self.db['chat_histories']
#             self.qdrant_client = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key)
#             self.qdrant_collection_name = settings.qdrant_collection_name
#             logger.info(f"ChatService Ready (Vector Size: {self.vector_size}).")
#         except Exception as e:
#             logger.error(f"Init Error: {e}")
#             raise

#     async def _get_chat_history(self, user_id: str, conversation_id: str) -> List[ChatHistory]:
#         cursor = self.chat_histories_collection.find({
#             "user_id": user_id, "conversation_id": conversation_id
#         }).sort("created_at", -1).limit(5)
#         history = await cursor.to_list(length=5)
#         return [ChatHistory(query=h['query'], answer=h['answer']) for h in reversed(history)]

#     async def _save_chat_history(self, user_id: str, conversation_id: str, query: str, answer: str):
#         await self.chat_histories_collection.insert_one({
#             "user_id": user_id, "conversation_id": conversation_id,
#             "query": query, "answer": answer, "created_at": datetime.utcnow()
#         })

#     async def _analyze_query(self, query: str, history: List[ChatHistory], context: ChatContext) -> Dict[str, Any]:
#         try:
#             history_txt = "\n".join([f"Q: {h.query}" for h in history[-2:]])
#             prompt = (
#                 f"{SYSTEM_PROMPT_ROUTER}\n\n--- INPUT ---\n"
#                 f"Context Page: {context.current_page}\n"
#                 f"Current Query: {query}\n"
#             )
#             response = await self.router_llm.generate_content_async(prompt)
#             return json.loads(response.text)
#         except Exception:
#             return {"intent": "general_search", "filters": {}}

#     def _build_qdrant_filters(self, base_filters: dict, extracted_filters: dict) -> Optional[rest.Filter]:
#         conditions = []

#         # 1. Base Filters
#         for key, value in base_filters.items():
#             if value:
#                 conditions.append(rest.FieldCondition(key=key, match=rest.MatchValue(value=value)))

#         # 2. Extracted Filters
#         ai_filters = extracted_filters.get("filters", {})
        
#         if ai_filters.get("website"):
#             logger.info(f"--> Filter Website: {ai_filters['website']}")
#             conditions.append(rest.FieldCondition(key="website", match=rest.MatchValue(value=ai_filters['website'])))

#         if ai_filters.get("topic"):
#             topic_val = ai_filters['topic']
#             logger.info(f"--> Filter Topic: {topic_val}")
#             conditions.append(rest.FieldCondition(key="topic", match=rest.MatchValue(value=topic_val)))

#         if ai_filters.get("sentiment"):
#             sentiment_val = ai_filters['sentiment']
#             logger.info(f"--> Filter Sentiment: {sentiment_val}")
#             if sentiment_val == "positive":
#                 conditions.append(rest.FieldCondition(key="sentiment", range=rest.Range(gte=0.25)))
#             elif sentiment_val == "negative":
#                 conditions.append(rest.FieldCondition(key="sentiment", range=rest.Range(lte=-0.25)))

#         if ai_filters.get("days_ago") and isinstance(ai_filters["days_ago"], int):
#             cutoff_date = datetime.utcnow() - timedelta(days=ai_filters["days_ago"])
#             cutoff_iso = cutoff_date.isoformat()
#             logger.info(f"--> Filter Date >= {cutoff_iso}")
#             conditions.append(rest.FieldCondition(key="publish_date", range=rest.DatetimeRange(gte=cutoff_iso)))

#         return rest.Filter(must=conditions) if conditions else None

#     async def _search_qdrant(self, query: str, qdrant_filter: Optional[rest.Filter], limit: int = 5) -> List[rest.ScoredPoint]:
#         try:
#             # --- TẠO EMBEDDING 384 CHIỀU ---
#             embedding_result = genai.embed_content(
#                 model=self.embedding_model,
#                 content=query,
#                 task_type="retrieval_query",
#                 output_dimensionality=self.vector_size # <--- QUAN TRỌNG: Nén vector xuống 384
#             )
#             query_vector = embedding_result['embedding']
            
#             return self.qdrant_client.search(
#                 collection_name=self.qdrant_collection_name,
#                 query_vector=query_vector,
#                 query_filter=qdrant_filter,
#                 limit=limit
#             )
#         except Exception as e:
#             logger.error(f"Search Error: {e}")
#             return []

#     async def handle_chat(self, request: ChatRequest) -> ChatResponse:
#         conversation_id = request.conversation_id or str(uuid.uuid4())
#         history = await self._get_chat_history(request.user_id, conversation_id)
        
#         analysis = await self._analyze_query(request.query, history, request.context)
#         intent = analysis.get("intent", "general_search")
#         extracted_filters = analysis.get("filters", {})
#         logger.info(f"Intent: {intent} | Filters: {extracted_filters}")

#         # Routing Strategy
#         base_filters = {}
#         strategy = "Global Search"

#         has_global_filters = any([
#             extracted_filters.get("website"),
#             extracted_filters.get("days_ago"),
#             extracted_filters.get("sentiment"),
#             extracted_filters.get("topic")
#         ])

#         if has_global_filters:
#             base_filters = {"type": "ai_summary"}
#             strategy = "Global Search (Forced by Filters)"
#             intent = "general_search"
#         elif request.context.current_page == "list_page" and intent == "contextual_summary" and request.context.search_id:
#             base_filters = {"search_id": request.context.search_id, "type": "ai_summary"}
#             strategy = "List Summary"
#         elif request.context.current_page == "detail_page" and intent == "contextual_summary" and request.context.article_id:
#             base_filters = {"article_id": request.context.article_id, "type": "ai_summary"}
#             strategy = "Single Summary"
#         elif request.context.current_page == "detail_page" and intent == "specific_detail" and request.context.article_id:
#             base_filters = {"article_id": request.context.article_id, "type": "chunk"}
#             strategy = "Deep Dive"
#         else:
#             base_filters = {"type": "ai_summary"}

#         final_filter = self._build_qdrant_filters(base_filters, {"filters": extracted_filters})
#         results = await self._search_qdrant(request.query, final_filter)

#         context_parts = []
#         sources = []
#         seen = set()

#         if not results:
#             final_answer = "Không tìm thấy thông tin phù hợp với tiêu chí lọc (Chủ đề/Cảm xúc/Thời gian)."
#         else:
#             for pt in results:
#                 payload = pt.payload or {}
                
#                 content_text = ""
#                 if payload.get("type") == "ai_summary":
#                     summary_arr = payload.get("summary_text", [])
#                     content_text = "\n- ".join(summary_arr) if isinstance(summary_arr, list) else str(summary_arr)
#                 else:
#                     content_text = payload.get("text", "")

#                 title = payload.get("title", "Tài liệu không tên")
#                 aid = payload.get("article_id") or payload.get("metadata", {}).get("article_id", "unknown")
#                 senti = payload.get("sentiment")

#                 context_parts.append(f"--- Bài: {title} (Sentiment: {senti}) ---\n{content_text}")
                
#                 if title not in seen:
#                     sources.append(SourcedAnswer(article_id=str(aid), title=title))
#                     seen.add(title)

#             prompt = (
#                 f"Câu hỏi: {request.query}\n\n"
#                 f"Thông tin tìm được ({strategy}):\n{chr(10).join(context_parts)}\n\n"
#                 f"Hãy trả lời câu hỏi trên."
#             )
#             resp = await self.llm.generate_content_async(prompt)
#             final_answer = resp.text

#         await self._save_chat_history(request.user_id, conversation_id, request.query, final_answer)
        
#         return ChatResponse(
#             answer=final_answer,
#             conversation_id=conversation_id,
#             sources=sources,
#             intent_detected=intent,
#             strategy_used=f"{strategy} {extracted_filters}"
#         )