import os

# Database
MONGO_URI = os.environ.get("MONGO_URI", "mongodb+srv://szluk133:sncuong2003@cluster0.nmr1jhv.mongodb.net/")
DATABASE_NAME = "test"
COLLECTION_NAME = "articles"
HISTORY_COLLECTION_NAME = "search_history"
SCHEDULED_JOBS_COLLECTION = "scheduled_jobs"
TOPICS_COLLECTION_NAME = "topics"

# Vector DBs
QDRANT_URL = os.environ.get("QDRANT_URL", "https://c9a9a8ac-8ff4-4614-873b-e5c3428a0fb6.eu-west-2-0.aws.cloud.qdrant.io")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.WmogjAtxB_OvIMfRVLIyQ_yzUZANoUKpDhOF7Zx00YA")
QDRANT_COLLECTION = "datn"

MEILISEARCH_URL = os.environ.get("MEILISEARCH_URL", "http://localhost:7700")
MEILISEARCH_KEY = os.environ.get("MEILISEARCH_KEY", "e_zh2SKU2P-K9eElhZHwc2VKhrr3YxZOQBdn6JahUow")

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