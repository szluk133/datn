import asyncio
from meilisearch_python_async import Client
from config import MEILISEARCH_URL, MEILISEARCH_KEY

async def main():
    print(f"Kết nối Meilisearch: {MEILISEARCH_URL}")
    client = Client(MEILISEARCH_URL, MEILISEARCH_KEY)
    
    index_name = "articles"
    index = client.index(index_name)

    try:
        stats = await index.get_stats()
        print(f"Tìm thấy index '{index_name}' với {stats.number_of_documents} documents.")
        
        # Xóa toàn bộ documents
        task = await index.delete_all_documents()
        print(f"Đã gửi lệnh xóa. Task UID: {task.task_uid}")
        
        print("Đang đợi Meilisearch xử lý...")
        
        # [FIX] Dùng vòng lặp kiểm tra trạng thái thay vì wait_for_task để tránh lỗi version
        while True:
            # Lấy thông tin task hiện tại
            task_info = await client.get_task(task.task_uid)
            
            # Kiểm tra trạng thái
            if task_info.status in ['succeeded', 'failed', 'canceled']:
                print(f"Trạng thái Task: {task_info.status}")
                if task_info.status == 'failed':
                    print(f"Chi tiết lỗi: {task_info.error}")
                break
            
            # Đợi 1 giây rồi check lại
            await asyncio.sleep(1) 
            
        print("✅ Meilisearch: Đã xóa sạch documents. Settings vẫn được giữ nguyên.")
        
    except Exception as e:
        print(f"⚠️ Lỗi: {e}")

if __name__ == "__main__":
    asyncio.run(main())