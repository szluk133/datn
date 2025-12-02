from sentence_transformers import SentenceTransformer
from config import EMBEDDING_MODEL_NAME
import asyncio
from typing import List

class EmbeddingService:
    _instance = None
    _model = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(EmbeddingService, cls).__new__(cls)
        return cls._instance

    def load_model(self):
        if self._model is None:
            print(f"[EMBEDDING] Đang tải model '{EMBEDDING_MODEL_NAME}'...")
            try:
                self._model = SentenceTransformer(EMBEDDING_MODEL_NAME)
                # [TỐI ƯU] Chuyển model sang chế độ eval để tắt dropout, tăng tốc nhẹ
                self._model.eval() 
                print(f"[EMBEDDING] Tải thành công.")
            except Exception as e:
                print(f"[EMBEDDING ERROR] {e}")

    def get_embedding(self, text: str) -> list:
        """Tạo vector cho 1 văn bản (Legacy)."""
        if not self._model: self.load_model()
        if not self._model: return []
        try:
            # encode trả về numpy array
            return self._model.encode(text[:1000]).tolist()
        except Exception: return []

    # [NEW] Hàm xử lý theo lô (Batch) - Tăng tốc cực lớn cho tóm tắt
    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        if not self._model: self.load_model()
        if not self._model or not texts: return []
        
        try:
            # batch_size=32 là mặc định, có thể tăng lên nếu RAM dư dả
            embeddings = self._model.encode(texts, batch_size=32, show_progress_bar=False)
            return embeddings.tolist()
        except Exception as e:
            print(f"[EMBEDDING ERROR] Batch encode fail: {e}")
            return []

    async def get_embedding_async(self, text: str) -> list:
        return await asyncio.to_thread(self.get_embedding, text)

    # [NEW] Wrapper Async cho hàm Batch
    async def get_embeddings_async(self, texts: List[str]) -> List[List[float]]:
        return await asyncio.to_thread(self.get_embeddings, texts)

embedding_service = EmbeddingService()
def get_embedding_service():
    return embedding_service