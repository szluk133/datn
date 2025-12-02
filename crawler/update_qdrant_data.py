import asyncio
import uuid
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import PointStruct
from config import QDRANT_URL, QDRANT_API_KEY, QDRANT_COLLECTION, COLLECTION_NAME, MONGO_URI, DATABASE_NAME
import motor.motor_asyncio
from services.embedding_service import get_embedding_service
from utils import split_text_into_chunks

async def update_qdrant_data():
    """
    Script Tái tạo dữ liệu (Re-index Full):
    1. Quét toàn bộ bài viết trong MongoDB.
    2. Cắt Chunk + Vector hóa nội dung -> Tạo mới Chunk Points.
    3. Vector hóa tóm tắt -> Tạo mới AI Summary Point.
    4. Lưu tất cả vào Qdrant.
    """
    print("[RE-INDEX] Bắt đầu nạp lại dữ liệu vào Qdrant...")
    
    # 1. Kết nối Database
    mongo_client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
    db = mongo_client[DATABASE_NAME]
    articles_col = db[COLLECTION_NAME]
    
    qdrant = AsyncQdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
    
    # Load model embedding
    embed_service = get_embedding_service()
    embed_service.load_model() 

    # 2. Lấy tất cả bài viết (ưu tiên bài đã enriched để có đủ AI data)
    # Nếu muốn index cả bài chưa có AI (raw), bỏ filter status
    cursor = articles_col.find({}) 
    total_processed = 0
    total_points = 0
    
    async for article in cursor:
        article_id = article.get('article_id')
        if not article_id: continue
        
        points_to_upsert = []
        
        # Thông tin chung
        title = article.get('title', '')
        url = article.get('url', '')
        website = article.get('website', '')
        topic = article.get('site_categories', [])
        publish_date = article.get('publish_date')
        if publish_date: publish_date = publish_date.isoformat()
        
        user_id = article.get('user_id', 'system')
        search_id = article.get('search_id', 'system_auto')
        sentiment = article.get('ai_sentiment_score', 0.0)
        
        # --- A. TẠO CHUNKS (Nội dung chi tiết) ---
        content_text = article.get('content', '')
        if not content_text: content_text = article.get('summary', '') # Fallback
        
        # Cắt chunk
        chunks = split_text_into_chunks(article_id, content_text)
        
        # Vector hóa từng chunk
        # (Có thể tối ưu bằng batch encode nếu muốn nhanh hơn nữa)
        for chunk in chunks:
            vector = await embed_service.get_embedding_async(chunk['text'])
            if not vector: continue
            
            # Tạo ID UUID chuẩn cho Chunk
            qdrant_chunk_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, chunk['chunk_id']))

            chunk_payload = {
                "type": "chunk",
                "article_id": article_id,
                "chunk_id": chunk['chunk_id'],
                "text": chunk['text'], 
                "title": title,
                "url": url,
                "website": website,
                "publish_date": publish_date,
                "topic": topic,
                "sentiment": sentiment,
                "user_id": user_id,
                "search_id": search_id
            }
            
            points_to_upsert.append(PointStruct(id=qdrant_chunk_id, vector=vector, payload=chunk_payload))

        # --- B. TẠO AI SUMMARY RECORD (Nếu có) ---
        ai_summary_list = article.get('ai_summary', [])
        if ai_summary_list:
            summary_text_joined = "\n".join(ai_summary_list)
            summary_vector = await embed_service.get_embedding_async(summary_text_joined)
            
            if summary_vector:
                summary_point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{article_id}_summary"))
                
                summary_payload = {
                    "type": "ai_summary",
                    "article_id": article_id,
                    "summary_text": ai_summary_list, # Mảng
                    "title": title,
                    "url": url,
                    "website": website,
                    "publish_date": publish_date,
                    "topic": topic,
                    "sentiment": sentiment,
                    "user_id": user_id,
                    "search_id": search_id
                }
                
                points_to_upsert.append(PointStruct(id=summary_point_id, vector=summary_vector, payload=summary_payload))

        # --- C. LƯU VÀO QDRANT ---
        if points_to_upsert:
            try:
                await qdrant.upsert(
                    collection_name=QDRANT_COLLECTION,
                    points=points_to_upsert
                )
                total_points += len(points_to_upsert)
            except Exception as e:
                print(f"[ERROR Upsert] Bài {article_id}: {e}")

        total_processed += 1
        if total_processed % 10 == 0:
            print(f"[PROGRESS] Đã xử lý {total_processed} bài ({total_points} points)...")

    print(f"[DONE] Hoàn tất! Đã xử lý {total_processed} bài viết, tạo ra {total_points} vectors trong Qdrant.")
    await qdrant.close()
    mongo_client.close()

if __name__ == "__main__":
    print("Script này sẽ TÁI TẠO (Re-index) toàn bộ dữ liệu từ MongoDB sang Qdrant.")
    asyncio.run(update_qdrant_data())