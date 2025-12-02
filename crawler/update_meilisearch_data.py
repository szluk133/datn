import asyncio
import motor.motor_asyncio
from meilisearch_python_async import Client as MeiliClient
from config import (
    MONGO_URI, DATABASE_NAME, COLLECTION_NAME, 
    MEILISEARCH_URL, MEILISEARCH_KEY
)
import datetime

# Hàm Helper để xử lý datetime -> string
def json_serializable(obj):
    if isinstance(obj, (datetime.datetime, datetime.date)):
        return obj.isoformat()
    if isinstance(obj, list):
        return [json_serializable(item) for item in obj]
    if isinstance(obj, dict):
        return {k: json_serializable(v) for k, v in obj.items()}
    return obj

async def update_meilisearch_data():
    """
    Script đồng bộ toàn bộ dữ liệu từ MongoDB sang Meilisearch.
    - Cập nhật filterable attributes (search_id).
    - Điền giá trị mặc định 'system_auto' cho bản ghi cũ thiếu search_id.
    """
    print("[MIGRATION] Bắt đầu cập nhật dữ liệu Meilisearch...")
    
    # 1. Kết nối Database
    mongo_client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
    db = mongo_client[DATABASE_NAME]
    articles_col = db[COLLECTION_NAME]
    
    meili = MeiliClient(MEILISEARCH_URL, MEILISEARCH_KEY)
    index = meili.index("articles")
    
    # [UPDATED] Thiết lập filter attributes bao gồm search_id
    print("[SETUP] Cập nhật Filterable Attributes...")
    await index.update_filterable_attributes([
        'publish_date', 
        'website', 
        'site_categories',
        'search_id', # Quan trọng: Để lọc theo Search ID
        'ai_sentiment_score'
    ])
    
    # 2. Lấy tất cả bài viết từ MongoDB
    cursor = articles_col.find({})
    
    batch_size = 100
    batch_docs = []
    total_synced = 0
    
    async for article in cursor:
        # Copy article và bỏ _id (vì Meili không nhận ObjectId)
        doc = article.copy()
        if '_id' in doc: del doc['_id']
        
        # [UPDATED] Kiểm tra và điền search_id mặc định cho bản ghi cũ
        if 'search_id' not in doc:
            doc['search_id'] = 'system_auto'
            
        # Đảm bảo có đủ trường AI
        if 'ai_sentiment_score' not in doc: doc['ai_sentiment_score'] = 0.0
        if 'ai_summary' not in doc: doc['ai_summary'] = []
            
        # Convert datetime sang string
        doc = json_serializable(doc)
        
        batch_docs.append(doc)
        
        # Gửi theo batch
        if len(batch_docs) >= batch_size:
            try:
                await index.add_documents(batch_docs, primary_key='article_id')
                total_synced += len(batch_docs)
                print(f"[SYNC] Đã đồng bộ {total_synced} bài...")
                batch_docs = []
            except Exception as e:
                print(f"[ERROR] Lỗi sync batch: {e}")
                
    # Gửi nốt batch cuối cùng
    if batch_docs:
        try:
            await index.add_documents(batch_docs, primary_key='article_id')
            total_synced += len(batch_docs)
        except Exception as e:
            print(f"[ERROR] Lỗi sync batch cuối: {e}")

    print(f"[DONE] Hoàn tất! Tổng cộng {total_synced} bài đã được cập nhật (kèm search_id) vào Meilisearch.")
    
    await meili.close()
    mongo_client.close()

if __name__ == "__main__":
    print("Script này sẽ đồng bộ TOÀN BỘ dữ liệu MongoDB sang Meilisearch.")
    asyncio.run(update_meilisearch_data())