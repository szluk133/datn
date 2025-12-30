from qdrant_client import QdrantClient
from config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def inspect_data():
    """
    Công cụ đơn giản để in ra 5 record đầu tiên trong Qdrant
    để kiểm tra xem payload thực tế đang chứa các trường gì.
    """
    logger.info("Connecting to Qdrant...")
    client = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key)
    collection_name = settings.qdrant_collection_name
    
    try:
        # Scroll lấy 5 điểm dữ liệu đầu tiên
        scroll_result, _ = client.scroll(
            collection_name=collection_name,
            limit=5,
            with_payload=True,
            with_vectors=False
        )
        
        print(f"\n--- INSPECTING COLLECTION: {collection_name} ---")
        if not scroll_result:
            print("❌ Collection is empty!")
            return

        for i, point in enumerate(scroll_result):
            print(f"\nPOINT #{i+1} ID: {point.id}")
            payload = point.payload
            
            # Kiểm tra các trường quan trọng
            print(f"  - type: {payload.get('type')}")
            print(f"  - topic: {payload.get('topic')}")
            print(f"  - article_id: {payload.get('article_id')}")
            print(f"  - search_id: {payload.get('search_id')}")
            
            # [NEW] Kiểm tra các trường mới
            print(f"  - update_id (New): {payload.get('update_id')}")
            print(f"  - ai_sentiment_label (New): {payload.get('ai_sentiment_label')}")
            print(f"  - ai_sentiment_score (New): {payload.get('ai_sentiment_score')}")
            print(f"  - sentiment (Legacy): {payload.get('sentiment')}")
            
    except Exception as e:
        logger.error(f"Error inspecting Qdrant: {e}")

if __name__ == "__main__":
    inspect_data()