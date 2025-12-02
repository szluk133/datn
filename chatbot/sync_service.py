# import asyncio
# import uuid
# from typing import List, Dict
# import google.generativeai as genai
# from qdrant_client import QdrantClient, models
# from qdrant_client.http.models import Distance, VectorParams
# from langchain_text_splitters import RecursiveCharacterTextSplitter

# from config import settings
# from database import get_mongo_db

# class SyncService:
#     """
#     Lớp chứa logic để đồng bộ dữ liệu từ MongoDB sang Qdrant.
#     """
#     def __init__(self):
#         """
#         Khởi tạo các client cần thiết.
#         """
#         self.db = get_mongo_db()
#         self.articles_collection = self.db['articles']

#         self.embedding_model = 'models/text-embedding-004'

#         self.qdrant_client = QdrantClient(
#             url=settings.qdrant_url,
#             api_key=settings.qdrant_api_key,
            
#         )
#         self.qdrant_collection_name = settings.qdrant_collection_name

#         # Sử dụng text splitter để chia văn bản thành các chunk nhỏ
#         self.text_splitter = RecursiveCharacterTextSplitter(
#             chunk_size=1000,  # Kích thước mỗi chunk (ký tự)
#             chunk_overlap=100, # Số ký tự chồng lấn giữa các chunk
#         )
#         print("SyncService initialized.")

#     async def setup_qdrant(self):
#         """
#         Đảm bảo collection trên Qdrant tồn tại và có các payload index cần thiết.
#         Đây là một hoạt động idempotent (có thể chạy nhiều lần mà không gây lỗi).
#         """
#         try:
#             self.qdrant_client.get_collection(collection_name=self.qdrant_collection_name)
#             print(f"Collection '{self.qdrant_collection_name}' đã tồn tại.")
#         except Exception:
#             print(f"Collection '{self.qdrant_collection_name}' không tồn tại. Đang tạo mới...")
#             # Kích thước vector cho model 'models/text-embedding-004' là 768
#             vector_size = 768
#             self.qdrant_client.recreate_collection(
#                 collection_name=self.qdrant_collection_name,
#                 vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
#             )
#             print(f"Collection '{self.qdrant_collection_name}' đã được tạo.")

#         print("Đang tạo/xác nhận các payload index...")
#         try:
#             self.qdrant_client.create_payload_index(
#                 collection_name=self.qdrant_collection_name,
#                 field_name="metadata.article_id",
#                 field_schema=models.PayloadSchemaType.KEYWORD,
#                 wait=True
#             )
#             print(" -> Index cho 'metadata.article_id' đã được tạo/xác nhận.")

#             self.qdrant_client.create_payload_index(
#                 collection_name=self.qdrant_collection_name,
#                 field_name="metadata.search_id",
#                 field_schema=models.PayloadSchemaType.KEYWORD,
#                 wait=True
#             )
#             print(" -> Index cho 'metadata.search_id' đã được tạo/xác nhận.")
#         except Exception as e:
#             print(f"Lỗi khi tạo payload index (có thể đã tồn tại từ trước): {e}")

#     def _split_text_into_chunks(self, text: str) -> List[str]:
#         """
#         Sử dụng text splitter để chia văn bản thành các chunk.
#         """
#         if not text:
#             return []
#         return self.text_splitter.split_text(text)

#     async def sync_mongo_to_qdrant(self) -> Dict:
#         """
#         Tìm các bài báo trong MongoDB chưa được đồng bộ,
#         tạo embedding và đẩy chúng lên Qdrant.
#         """
#         print("Bắt đầu quá trình đồng bộ từ MongoDB sang Qdrant...")
#         # Tìm các bài báo chưa được đồng bộ
#         articles_to_sync_cursor = self.articles_collection.find({
#             "$or": [
#                 {"synced_to_qdrant": {"$exists": False}},
#                 {"synced_to_qdrant": False}
#             ]
#         })
        
#         articles_to_sync = await articles_to_sync_cursor.to_list(length=None)
#         if not articles_to_sync:
#             print("Không có bài báo mới nào để đồng bộ.")
#             return {"status": "success", "synced_count": 0, "message": "No new articles to sync."}

#         print(f"Tìm thấy {len(articles_to_sync)} bài báo cần đồng bộ.")

#         all_qdrant_points = []
#         synced_article_ids = []
#         skipped_count = 0

#         for article in articles_to_sync:
#             content = article.get('content')
#             article_id = article.get('article_id')
            
#             if not content or not article_id:
#                 skipped_count += 1
#                 print(f"Bỏ qua bài báo với _id: {article.get('_id')} do thiếu content hoặc article_id.")
#                 continue

#             search_id = article.get('search_id')
            
#             # 1. Chia văn bản thành chunks
#             chunks = self._split_text_into_chunks(content)
            
#             if not chunks:
#                 continue

#             # 2. Tạo embeddings cho các chunks (batching)
#             try:
#                 embedding_result = genai.embed_content(
#                     model=self.embedding_model,
#                     content=chunks,
#                     task_type="retrieval_document"
#                 )
#                 embeddings = embedding_result['embedding']
#             except Exception as e:
#                 print(f"Lỗi khi tạo embedding cho article {article_id}: {e}")
#                 continue
            
#             for i, chunk_text in enumerate(chunks):
#                 chunk_id = f"{article_id}#{i}"
#                 point = models.PointStruct(
#                     id=str(uuid.uuid4()),
#                     vector=embeddings[i],
#                     payload={
#                         "chunk_id": chunk_id,
#                         "text": chunk_text,
#                         "metadata": {
#                             "article_id": str(article_id),
#                             "search_id": search_id
#                         }
#                     }
#                 )
#                 all_qdrant_points.append(point)
            
#             synced_article_ids.append(article['_id'])

#         # 4. Upsert tất cả các points lên Qdrant trong một lần gọi
#         if all_qdrant_points:
#             print(f"Đang upsert {len(all_qdrant_points)} điểm vector lên Qdrant...")
#             try:
#                 self.qdrant_client.upsert(
#                     collection_name=self.qdrant_collection_name,
#                     points=all_qdrant_points,
#                     wait=True
#                 )
#             except Exception as e:
#                 print(f"Lỗi khi upsert lên Qdrant: {e}")
#                 return {"status": "error", "message": f"Failed to upsert to Qdrant: {e}"}

#             # 5. Cập nhật trạng thái trong MongoDB
#             print(f"Cập nhật trạng thái đồng bộ cho {len(synced_article_ids)} bài báo trong MongoDB...")
#             await self.articles_collection.update_many(
#                 {"_id": {"$in": synced_article_ids}},
#                 {"$set": {"synced_to_qdrant": True}}
#             )
#             print("Quá trình đồng bộ hoàn tất.")
        
#         return {
#             "status": "success", 
#             "synced_article_count": len(synced_article_ids),
#             "synced_point_count": len(all_qdrant_points),
#             "skipped_article_count": skipped_count
#         }

