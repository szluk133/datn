from qdrant_client import QdrantClient, models
from qdrant_client.http.models import Distance, VectorParams
from config import settings
import logging
import sys

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def setup_qdrant_indices():
    logger.info("Đang kết nối tới Qdrant...")
    client = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key)
    collection_name = settings.qdrant_collection_name
    
    REQUIRED_VECTOR_SIZE = 384
    
    try:
        collection_info = client.get_collection(collection_name)
        current_size = collection_info.config.params.vectors.size
        logger.info(f"Collection '{collection_name}' đang tồn tại với size: {current_size}")
        
        if current_size != REQUIRED_VECTOR_SIZE:
            logger.warning(f" SIZE KHÔNG KHỚP (Đang là {current_size}, cần {REQUIRED_VECTOR_SIZE}).")
            logger.warning(" ĐANG XÓA VÀ TẠO LẠI COLLECTION CHO VECTOR 384 (Dữ liệu cũ sẽ mất)...")
            
            client.recreate_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(size=REQUIRED_VECTOR_SIZE, distance=Distance.COSINE),
            )
            logger.info(f" Đã tạo lại collection với size {REQUIRED_VECTOR_SIZE}.")
        else:
            logger.info(f" Collection đã chuẩn size {REQUIRED_VECTOR_SIZE}.")
            
    except Exception as e:
        logger.info(f"Collection chưa tồn tại ({e}). Đang tạo mới...")
        client.recreate_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=REQUIRED_VECTOR_SIZE, distance=Distance.COSINE),
        )
        logger.info(f" Đã tạo mới collection với size {REQUIRED_VECTOR_SIZE}.")

    # [UPDATE] Các trường cần Index (Bao gồm trường mới)
    indices_config = [
        # Các trường định danh & phân loại chính
        {"field": "type", "schema": models.PayloadSchemaType.KEYWORD},
        {"field": "article_id", "schema": models.PayloadSchemaType.KEYWORD},
        {"field": "search_id", "schema": models.PayloadSchemaType.KEYWORD},
        
        # [NEW] Trường cho My-Page
        {"field": "update_id", "schema": models.PayloadSchemaType.KEYWORD},
        
        # Content Filters
        {"field": "website", "schema": models.PayloadSchemaType.KEYWORD},
        {"field": "topic", "schema": models.PayloadSchemaType.KEYWORD},
        {"field": "publish_date", "schema": models.PayloadSchemaType.DATETIME},
        
        # [NEW] Sentiment Fields
        {"field": "ai_sentiment_label", "schema": models.PayloadSchemaType.KEYWORD},
        {"field": "ai_sentiment_score", "schema": models.PayloadSchemaType.FLOAT}, # Score giờ là confidence (0-1) hoặc score cũ
        {"field": "sentiment", "schema": models.PayloadSchemaType.FLOAT}, # Giữ lại field cũ cho backward compat
    ]

    logger.info("Bắt đầu cập nhật Index...")
    for config in indices_config:
        try:
            client.create_payload_index(
                collection_name=collection_name,
                field_name=config["field"],
                field_schema=config["schema"],
                wait=True
            )
            logger.info(f" Index '{config['field']}' OK.")
        except Exception as e:
            logger.warning(f"⚠️ Index '{config['field']}': {e}")

    logger.info(" Hoàn tất cấu hình Qdrant.")

if __name__ == "__main__":
    setup_qdrant_indices()




# from qdrant_client import QdrantClient, models
# from qdrant_client.http.models import Distance, VectorParams
# from config import settings
# import logging
# import sys

# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# def setup_qdrant_indices():
#     logger.info("Đang kết nối tới Qdrant...")
#     client = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key)
#     collection_name = settings.qdrant_collection_name
    
#     REQUIRED_VECTOR_SIZE = 384
    
#     try:
#         collection_info = client.get_collection(collection_name)
#         current_size = collection_info.config.params.vectors.size
#         logger.info(f"Collection '{collection_name}' đang tồn tại với size: {current_size}")
        
#         if current_size != REQUIRED_VECTOR_SIZE:
#             logger.warning(f" SIZE KHÔNG KHỚP (Đang là {current_size}, cần {REQUIRED_VECTOR_SIZE}).")
#             logger.warning(" ĐANG XÓA VÀ TẠO LẠI COLLECTION CHO VECTOR 384 (Dữ liệu cũ sẽ mất)...")
            
#             client.recreate_collection(
#                 collection_name=collection_name,
#                 vectors_config=VectorParams(size=REQUIRED_VECTOR_SIZE, distance=Distance.COSINE),
#             )
#             logger.info(f" Đã tạo lại collection với size {REQUIRED_VECTOR_SIZE}.")
#         else:
#             logger.info(f" Collection đã chuẩn size {REQUIRED_VECTOR_SIZE}.")
            
#     except Exception as e:
#         logger.info(f"Collection chưa tồn tại ({e}). Đang tạo mới...")
#         client.recreate_collection(
#             collection_name=collection_name,
#             vectors_config=VectorParams(size=REQUIRED_VECTOR_SIZE, distance=Distance.COSINE),
#         )
#         logger.info(f" Đã tạo mới collection với size {REQUIRED_VECTOR_SIZE}.")

#     # [UPDATE] Chỉ tạo Index cho các trường Root quan trọng
#     indices_config = [
#         {"field": "type", "schema": models.PayloadSchemaType.KEYWORD},
#         {"field": "article_id", "schema": models.PayloadSchemaType.KEYWORD},
#         {"field": "search_id", "schema": models.PayloadSchemaType.KEYWORD},
        
#         # ROOT Level Filters (Updated)
#         {"field": "website", "schema": models.PayloadSchemaType.KEYWORD},
#         {"field": "topic", "schema": models.PayloadSchemaType.KEYWORD},
#         {"field": "publish_date", "schema": models.PayloadSchemaType.DATETIME},
#         {"field": "sentiment", "schema": models.PayloadSchemaType.FLOAT},
#     ]

#     logger.info("Bắt đầu cập nhật Index...")
#     for config in indices_config:
#         try:
#             client.create_payload_index(
#                 collection_name=collection_name,
#                 field_name=config["field"],
#                 field_schema=config["schema"],
#                 wait=True
#             )
#             logger.info(f" Index '{config['field']}' OK.")
#         except Exception as e:
#             logger.warning(f"⚠️ Index '{config['field']}': {e}")

#     logger.info(" Hoàn tất cấu hình Qdrant (Size 384).")

# if __name__ == "__main__":
#     setup_qdrant_indices()