from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure
import logging

from config import settings

logger = logging.getLogger(__name__)

class DBMotor:

    client: AsyncIOMotorClient = None
    db = None

db_motor = DBMotor()

async def connect_to_mongo():
    logger.info("Đang kết nối tới MongoDB...")
    try:
        db_motor.client = AsyncIOMotorClient(settings.mongodb_uri)
        await db_motor.client.admin.command('ismaster')
        db_motor.db = db_motor.client[settings.mongodb_db_name]
        logger.info(f"Kết nối MongoDB thành công tới database: '{settings.mongodb_db_name}'.")
    except ConnectionFailure as e:
        logger.error(f"Không thể kết nối tới MongoDB: {e}")
        raise

async def close_mongo_connection():
    if db_motor.client:
        logger.info("Đang đóng kết nối MongoDB...")
        db_motor.client.close()
        logger.info("Kết nối MongoDB đã được đóng.")

def get_mongo_db():
    if db_motor.db is None:
        raise Exception("Chưa kết nối tới MongoDB.")
    return db_motor.db

