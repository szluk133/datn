from fastapi import FastAPI, HTTPException
import logging
from typing import Optional
import uvicorn
from models import ChatRequest, ChatResponse
from services import ChatService
from database import connect_to_mongo, close_mongo_connection

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="RAG Chatbot API (Read-Only)",
    description="API Chatbot RAG (Chỉ đọc dữ liệu từ Qdrant đã có).",
    version="2.1.0"
)

chat_service: Optional[ChatService] = None

@app.on_event("startup")
async def startup_event():
    global chat_service
    logger.info("Starting up...")
    try:
        await connect_to_mongo()

        chat_service = ChatService()
        
        logger.info("ChatService initialized successfully.")
        logger.info("Ready to serve requests.")
    except Exception as e:
        logger.error(f"Startup failed: {e}")
        raise RuntimeError(e)

@app.on_event("shutdown")
async def shutdown_event():
    await close_mongo_connection()
    logger.info("Shutdown complete.")

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Endpoint xử lý chat RAG.
    """
    if not chat_service:
        raise HTTPException(status_code=503, detail="Service not ready")
    try:
        return await chat_service.handle_chat(request)
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "ok", "mode": "read-only", "version": "2.1.0"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)

