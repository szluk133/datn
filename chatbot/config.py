from pydantic_settings import BaseSettings
from dotenv import load_dotenv
import os

load_dotenv()

class Settings(BaseSettings):

    google_api_key: str = os.getenv("GOOGLE_API_KEY", "AIzaSyDtAEYsrEH6C9QhcFbTmNxLDAuqT0UaukM")

    mongodb_uri: str = os.getenv("MONGODB_URI", "mongodb+srv://szluk133:sncuong2003@cluster0.nmr1jhv.mongodb.net/")
    mongodb_db_name: str = os.getenv("MONGODB_DB_NAME", "test")

    qdrant_url: str = os.getenv("QDRANT_URL", "https://c9a9a8ac-8ff4-4614-873b-e5c3428a0fb6.eu-west-2-0.aws.cloud.qdrant.io")
    qdrant_api_key: str = os.getenv("QDRANT_API_KEY")
    qdrant_collection_name: str = os.getenv("QDRANT_COLLECTION_NAME", "datn")

    class Config:
        env_file = ".env"
        env_file_encoding = 'utf-8'

settings = Settings()
