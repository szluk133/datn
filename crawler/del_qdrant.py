import asyncio
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Filter
# Import config để đảm bảo xóa đúng Collection dự án đang dùng
from config import QDRANT_URL, QDRANT_API_KEY, QDRANT_COLLECTION

async def main():
    print(f"Kết nối Qdrant: {QDRANT_URL} | Collection: {QDRANT_COLLECTION}")
    
    client = AsyncQdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
    
    try:
        # Kiểm tra collection tồn tại
        collections = await client.get_collections()
        exists = any(c.name == QDRANT_COLLECTION for c in collections.collections)
        
        if not exists:
            print(f"⚠️ Collection '{QDRANT_COLLECTION}' không tồn tại. Không cần xóa.")
            return

        # Lấy số lượng trước khi xóa (Optional)
        info = await client.get_collection(QDRANT_COLLECTION)
        print(f"Số lượng points hiện tại: {info.points_count}")

        # Xóa toàn bộ points bằng Filter rỗng (Match All)
        # points_selector với Filter rỗng sẽ chọn tất cả points
        await client.delete(
            collection_name=QDRANT_COLLECTION,
            points_selector=Filter(must=[])
        )
        
        print(f"✅ Qdrant: Đã xóa sạch points trong collection '{QDRANT_COLLECTION}'.")
        
    except Exception as e:
        print(f"❌ Lỗi Qdrant: {e}")
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(main())