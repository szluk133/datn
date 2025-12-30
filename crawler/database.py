import motor.motor_asyncio
from typing import Optional
import sys
from config import (
    MONGO_URI, DATABASE_NAME, COLLECTION_NAME, HISTORY_COLLECTION_NAME, 
    SCHEDULED_JOBS_COLLECTION, TOPICS_COLLECTION_NAME, MY_COLLECTION_NAME,
    QDRANT_URL, QDRANT_API_KEY, MEILISEARCH_URL, MEILISEARCH_KEY
)
from qdrant_client import AsyncQdrantClient
from meilisearch_python_async import Client as MeiliClient

client: Optional[motor.motor_asyncio.AsyncIOMotorClient] = None
db: Optional[motor.motor_asyncio.AsyncIOMotorDatabase] = None
qdrant_client: Optional[AsyncQdrantClient] = None
meili_client: Optional[MeiliClient] = None

async def connect_to_mongo():
    global client, db
    print("[MONGO] Connecting...")
    try:
        client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
        await client.admin.command('ping')
        db = client[DATABASE_NAME]
        print(f"[MONGO] Connected to {DATABASE_NAME}")
    except Exception as e:
        print(f"[FATAL] Mongo Error: {e}", file=sys.stderr)

async def connect_external_services():
    global qdrant_client, meili_client
    try:
        qdrant_client = AsyncQdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
        print("[QDRANT] Connected.")
    except Exception as e: print(f"[WARN] Qdrant Error: {e}")

    try:
        meili_client = MeiliClient(MEILISEARCH_URL, MEILISEARCH_KEY)
        print("[MEILISEARCH] Connected.")
    except Exception as e: print(f"[WARN] Meilisearch Error: {e}")

async def close_connections():
    if client: client.close()
    if qdrant_client: await qdrant_client.close()
    if meili_client: await meili_client.close()

def get_db() -> motor.motor_asyncio.AsyncIOMotorDatabase:
    return db

def get_articles_collection(): return db[COLLECTION_NAME]
def get_history_collection(): return db[HISTORY_COLLECTION_NAME]
def get_scheduled_jobs_collection(): return db[SCHEDULED_JOBS_COLLECTION]
def get_topics_collection(): return db[TOPICS_COLLECTION_NAME]
def get_my_articles_collection(): return db[MY_COLLECTION_NAME]
def get_qdrant_client(): return qdrant_client
def get_meili_client(): return meili_client