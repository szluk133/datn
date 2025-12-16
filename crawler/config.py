from dotenv import load_dotenv
import os
load_dotenv()
# Database
MONGO_URI = os.getenv("MONGO_URI")
DATABASE_NAME = os.getenv("DATABASE_NAME")
COLLECTION_NAME = os.getenv("COLLECTION_NAME")
HISTORY_COLLECTION_NAME = os.getenv("HISTORY_COLLECTION_NAME")
SCHEDULED_JOBS_COLLECTION = os.getenv("SCHEDULED_JOBS_COLLECTION")
TOPICS_COLLECTION_NAME = os.getenv("TOPICS_COLLECTION_NAME")

# Vector DBs
QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION")

MEILISEARCH_URL = os.getenv("MEILISEARCH_URL")
MEILISEARCH_KEY = os.getenv("MEILISEARCH_KEY")

# Embedding Model (Dùng chung cho cả Vector Search và Tóm tắt Extractive)
EMBEDDING_MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

# Sentiment Model (Chạy Local CPU)
SENTIMENT_MODEL_NAME = "wonrax/phobert-base-vietnamese-sentiment"

# Crawler Config
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}
CHUNK_SIZE_CHARS = 1000
PREVIEW_CHARS = 200
HISTORY_LIMIT = 10

MAX_CONCURRENT_REQUESTS = 20
MAX_CONNECTIONS_PER_SITE = 5
REQUEST_TIMEOUT = 15.0
RETRY_COUNT = 3
AUTO_CRAWL_MONTHS = 6