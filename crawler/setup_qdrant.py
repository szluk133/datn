import asyncio
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct
from config import QDRANT_URL, QDRANT_API_KEY, QDRANT_COLLECTION

VECTOR_SIZE = 384

async def setup_qdrant_collection(recreate: bool = False):

    print(f"[SETUP] Đang kết nối tới Qdrant: {QDRANT_URL}...")
    
    try:
        client = AsyncQdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
        
        collections = await client.get_collections()
        exists = any(c.name == QDRANT_COLLECTION for c in collections.collections)
        
        if exists:
            print(f"[INFO] Collection '{QDRANT_COLLECTION}' đã tồn tại.")
            
            
            if recreate:
                print(f"[WARN] Đang xóa collection '{QDRANT_COLLECTION}' để tạo lại...")
                await client.delete_collection(collection_name=QDRANT_COLLECTION)
            else:
                print("[INFO] Giữ nguyên dữ liệu hiện có. LƯU Ý: Nếu kích thước vector thay đổi, bạn CẦN chạy lại với --reset.")

        if not exists or recreate:
            print(f"[SETUP] Đang tạo Collection '{QDRANT_COLLECTION}' với size={VECTOR_SIZE}...")
            await client.create_collection(
                collection_name=QDRANT_COLLECTION,
                vectors_config=VectorParams(
                    size=VECTOR_SIZE, 
                    distance=Distance.COSINE 
                )
            )
            print("[SUCCESS] Đã tạo Collection thành công.")

        print("[SETUP] Đang tối ưu hóa Index cho các trường Payload...")
        
        await client.create_payload_index(collection_name=QDRANT_COLLECTION, field_name="article_id", field_schema="keyword")
        await client.create_payload_index(collection_name=QDRANT_COLLECTION, field_name="type", field_schema="keyword")
        await client.create_payload_index(collection_name=QDRANT_COLLECTION, field_name="website", field_schema="keyword")
        await client.create_payload_index(collection_name=QDRANT_COLLECTION, field_name="user_id", field_schema="keyword")

        print("[SUCCESS] Hoàn tất cấu hình Qdrant!")
        await client.close()

    except Exception as e:
        print(f"[ERROR] Lỗi khi setup Qdrant: {e}")

if __name__ == "__main__":
    import sys
    should_recreate = False
    if len(sys.argv) > 1 and sys.argv[1] == "--reset":
        print("[WARN] --reset được kích hoạt → XÓA collection cũ.")
        should_recreate = True


    asyncio.run(setup_qdrant_collection(recreate=should_recreate))