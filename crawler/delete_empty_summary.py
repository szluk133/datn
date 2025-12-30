import asyncio
import sys
from typing import List

from database import (
    connect_to_mongo, close_connections, connect_external_services,
    get_articles_collection, get_qdrant_client, get_meili_client
)
from config import QDRANT_COLLECTION
from qdrant_client.models import Filter, FieldCondition, MatchAny, FilterSelector

# Kích thước lô xử lý
BATCH_SIZE = 100

async def delete_empty_summary_articles():
    print("--- [START] QUÉT VÀ XÓA BÀI VIẾT CÓ SUMMARY RỖNG ---")
    
    # 1. Khởi tạo kết nối
    await connect_to_mongo()
    await connect_external_services()
    
    articles_col = get_articles_collection()
    meili = get_meili_client()
    qdrant = get_qdrant_client()

    # 2. Quét các bài báo có summary rỗng
    # Điều kiện: là chuỗi rỗng "", hoặc là None, hoặc field không tồn tại
    query = {
        "$or": [
            {"summary": ""},
            {"summary": None},
            {"summary": {"$exists": False}}
        ]
    }
    
    # Chỉ lấy trường article_id và _id, title để log
    cursor = articles_col.find(query, {"article_id": 1, "title": 1})
    
    articles_to_delete = await cursor.to_list(length=None)
    total_count = len(articles_to_delete)
    
    print(f"[INFO] Tìm thấy {total_count} bài viết có summary rỗng.")
    
    if total_count == 0:
        print("[INFO] Không có gì để xóa.")
        await close_connections()
        return

    # Danh sách ID cần xóa
    article_ids_list = [doc['article_id'] for doc in articles_to_delete if doc.get('article_id')]
    mongo_ids_list = [doc['_id'] for doc in articles_to_delete]

    print(f"[INFO] Bắt đầu xóa {total_count} bài viết...")

    # --- A. Xóa khỏi MongoDB ---
    try:
        delete_result = await articles_col.delete_many({"_id": {"$in": mongo_ids_list}})
        print(f"   >> [MongoDB] Đã xóa {delete_result.deleted_count} documents.")
    except Exception as e:
        print(f"   >> [MongoDB Error] {e}")

    # --- B. Đồng bộ xóa Meilisearch ---
    if meili and article_ids_list:
        try:
            for i in range(0, len(article_ids_list), BATCH_SIZE):
                batch_ids = article_ids_list[i:i + BATCH_SIZE]
                task = await meili.index("articles").delete_documents(batch_ids)
                print(f"   >> [Meilisearch] Gửi lệnh xóa batch {i//BATCH_SIZE + 1} ({len(batch_ids)} items). Task UID: {task.task_uid}")
        except Exception as e:
            print(f"   >> [Meilisearch Error] {e}")

    # --- C. Đồng bộ xóa Qdrant ---
    if qdrant and article_ids_list:
        try:
            # Xóa vector dựa trên article_id trong payload
            for i in range(0, len(article_ids_list), BATCH_SIZE):
                batch_ids = article_ids_list[i:i + BATCH_SIZE]
                
                points_selector = FilterSelector(
                    filter=Filter(
                        must=[
                            FieldCondition(
                                key="article_id",
                                match=MatchAny(any=batch_ids)
                            )
                        ]
                    )
                )
                
                await qdrant.delete(
                    collection_name=QDRANT_COLLECTION,
                    points_selector=points_selector
                )
                print(f"   >> [Qdrant] Đã xóa vector cho batch {i//BATCH_SIZE + 1} ({len(batch_ids)} articles).")
                
        except Exception as e:
            print(f"   >> [Qdrant Error] {e}")

    print("--- [END] HOÀN TẤT QUÁ TRÌNH ---")
    await close_connections()

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(delete_empty_summary_articles())