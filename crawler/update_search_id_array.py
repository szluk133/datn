import asyncio
import motor.motor_asyncio
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue
from meilisearch_python_async import Client as MeiliClient
from config import (
    MONGO_URI, DATABASE_NAME, COLLECTION_NAME,
    QDRANT_URL, QDRANT_API_KEY, QDRANT_COLLECTION,
    MEILISEARCH_URL, MEILISEARCH_KEY
)
import datetime

# Helper function
def json_serializable(obj):
    if isinstance(obj, (datetime.datetime, datetime.date)):
        return obj.isoformat()
    if isinstance(obj, list):
        return [json_serializable(item) for item in obj]
    if isinstance(obj, dict):
        return {k: json_serializable(v) for k, v in obj.items()}
    return obj

async def migrate_search_id_to_array():
    print("--- [MIGRATION] BẮT ĐẦU CHUYỂN ĐỔI SEARCH_ID THÀNH MẢNG ---")
    
    # 1. Kết nối Database
    mongo_client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
    db = mongo_client[DATABASE_NAME]
    articles_col = db[COLLECTION_NAME]
    
    qdrant = AsyncQdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
    meili = MeiliClient(MEILISEARCH_URL, MEILISEARCH_KEY)
    
    # --- BƯỚC 1: CẬP NHẬT MONGODB ---
    print("\n[MONGO] Đang quét và cập nhật MongoDB...")
    
    # Tìm các document có search_id là String (type 2)
    # $type 2 = String, $type 4 = Array
    cursor = articles_col.find({'search_id': {'$type': 2}})
    
    mongo_count = 0
    async for doc in cursor:
        old_search_id = doc.get('search_id')
        if isinstance(old_search_id, str):
            # Update thành mảng
            await articles_col.update_one(
                {'_id': doc['_id']},
                {'$set': {'search_id': [old_search_id]}}
            )
            mongo_count += 1
            
    print(f"[MONGO] Đã cập nhật {mongo_count} bản ghi từ String -> Array.")

    # --- BƯỚC 2: CẬP NHẬT MEILISEARCH ---
    print("\n[MEILI] Đang đồng bộ lại cấu trúc sang Meilisearch...")
    
    # Lấy toàn bộ data từ Mongo (đã update) để sync sang Meili
    cursor_all = articles_col.find({})
    meili_batch = []
    meili_count = 0
    
    async for doc in cursor_all:
        # Chuẩn bị doc
        meili_doc = doc.copy()
        if '_id' in meili_doc: del meili_doc['_id']
        
        # Đảm bảo search_id là list (nếu chưa có thì gán rỗng hoặc mặc định)
        if 'search_id' not in meili_doc or meili_doc['search_id'] is None:
            meili_doc['search_id'] = ['system_auto']
        elif isinstance(meili_doc['search_id'], str):
             meili_doc['search_id'] = [meili_doc['search_id']]
             
        meili_batch.append(json_serializable(meili_doc))
        
        if len(meili_batch) >= 100:
            await meili.index("articles").update_documents(meili_batch, primary_key='article_id')
            meili_count += len(meili_batch)
            meili_batch = []
            print(f"[MEILI] Synced {meili_count} docs...")
            
    if meili_batch:
        await meili.index("articles").update_documents(meili_batch, primary_key='article_id')
        meili_count += len(meili_batch)
        
    print(f"[MEILI] Hoàn tất đồng bộ {meili_count} bản ghi.")

    # --- BƯỚC 3: CẬP NHẬT QDRANT ---
    print("\n[QDRANT] Đang cập nhật Payload trong Qdrant...")
    
    # Duyệt lại Mongo để lấy map {article_id: [search_ids]}
    cursor_qdrant = articles_col.find({}, {'article_id': 1, 'search_id': 1})
    qdrant_count = 0
    
    async for doc in cursor_qdrant:
        article_id = doc.get('article_id')
        search_ids = doc.get('search_id') # Lúc này đã là mảng
        
        if not article_id or not isinstance(search_ids, list):
            continue
            
        try:
            # Tìm tất cả points của article này (Chunk + Summary)
            scroll_filter = Filter(
                must=[FieldCondition(key="article_id", match=MatchValue(value=article_id))]
            )
            
            points, _ = await qdrant.scroll(
                collection_name=QDRANT_COLLECTION,
                scroll_filter=scroll_filter,
                limit=100,
                with_payload=True,
                with_vectors=False
            )
            
            points_ids_to_update = []
            for p in points:
                # Kiểm tra nếu payload cũ đang là string thì mới cần update
                # Hoặc update luôn để đồng bộ với Mongo mới nhất
                points_ids_to_update.append(p.id)
                
            if points_ids_to_update:
                await qdrant.set_payload(
                    collection_name=QDRANT_COLLECTION,
                    payload={'search_id': search_ids}, # Gán đè mảng mới
                    points=points_ids_to_update
                )
                qdrant_count += 1
                if qdrant_count % 50 == 0:
                    print(f"[QDRANT] Updated payload for {qdrant_count} articles...")
                    
        except Exception as e:
            print(f"[QDRANT ERROR] Article {article_id}: {e}")

    print(f"[QDRANT] Hoàn tất cập nhật {qdrant_count} bài viết.")
    
    await qdrant.close()
    mongo_client.close()
    await meili.close()
    
    print("\n--- [MIGRATION] HOÀN TẤT TOÀN BỘ ---")

if __name__ == "__main__":
    asyncio.run(migrate_search_id_to_array())