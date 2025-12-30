import asyncio
import numpy as np
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
from sklearn.metrics.pairwise import cosine_similarity
from config import SENTIMENT_MODEL_NAME
from services.embedding_service import get_embedding_service
import re
import torch
import time

class LocalAIService:
    _instance = None
    _sentiment_pipeline = None
    _tokenizer = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(LocalAIService, cls).__new__(cls)
        return cls._instance

    def load_model(self):
        if self._sentiment_pipeline is None:
            print(f"[AI-LOCAL] Đang tải model Sentiment '{SENTIMENT_MODEL_NAME}'...")
            t0 = time.time()
            try:
                self._tokenizer = AutoTokenizer.from_pretrained(SENTIMENT_MODEL_NAME)
                model = AutoModelForSequenceClassification.from_pretrained(SENTIMENT_MODEL_NAME)
                
                quantized_model = torch.quantization.quantize_dynamic(
                    model, {torch.nn.Linear}, dtype=torch.qint8
                )
                
                self._sentiment_pipeline = pipeline(
                    "sentiment-analysis", 
                    model=quantized_model, 
                    tokenizer=self._tokenizer, 
                    device=-1,
                    top_k=None
                )
                print(f"[AI-LOCAL] Model loaded in {time.time()-t0:.2f}s")
            except Exception as e:
                print(f"[AI-LOCAL ERROR] Load model fail: {e}")

    def _analyze_sync(self, content: str) -> dict:
        """
        Phân tích nội dung đồng bộ (CPU bound).
        Logic cập nhật: 
        1. Tính Summary.
        2. Nếu có Summary -> Input Sentiment = Summary.
        3. Nếu KHÔNG có Summary -> Input Sentiment = 1500 ký tự đầu content.
        4. Output: Label (Tích cực/Tiêu cực/Trung tính) & Score (0-1).
        """
        t_start = time.time()
        
        summary_sentences = []
        try:
            sentences = re.split(r'(?<=[.!?])\s+', content)
            valid_sentences = [s.strip() for s in sentences if len(s.strip()) > 25][:50]
            
            if len(valid_sentences) <= 3:
                summary_sentences = valid_sentences
            else:
                embed_service = get_embedding_service()
                vectors = embed_service.get_embeddings(valid_sentences)
                
                if vectors and len(vectors) > 0:
                    mat = np.array(vectors)
                    doc_embedding = np.mean(mat, axis=0).reshape(1, -1)
                    sims = cosine_similarity(mat, doc_embedding).flatten()
                    top_idx = sims.argsort()[-3:][::-1]
                    top_idx = sorted(top_idx)
                    summary_sentences = [valid_sentences[i] for i in top_idx]
                else:
                    summary_sentences = valid_sentences[:3]

        except Exception as e:
            print(f"[AI ERROR] Summary: {e}")
            summary_sentences = [content[:200] + "..."]

        sentiment_score = 0.0
        sentiment_label = "Trung tính"

        if not self._sentiment_pipeline:
            self.load_model()
            
        if self._sentiment_pipeline:
            try:
                if summary_sentences and len(" ".join(summary_sentences)) > 20:
                    input_text = " ".join(summary_sentences)
                else:
                    input_text = content[:1500]

                raw_output = self._sentiment_pipeline(input_text, truncation=True, max_length=512)
                
                if isinstance(raw_output[0], list):
                    all_scores = raw_output[0]
                else:
                    all_scores = raw_output
                
                sorted_scores = sorted(all_scores, key=lambda x: x['score'], reverse=True)
                top_result = sorted_scores[0]
                
                raw_label = top_result['label'].upper()
                confidence = top_result['score']
                
                if raw_label in ['POS', 'POSITIVE', 'B-POS']:
                    sentiment_label = "Tích cực"
                elif raw_label in ['NEG', 'NEGATIVE', 'B-NEG']:
                    sentiment_label = "Tiêu cực"
                else:
                    sentiment_label = "Trung tính"
                
                sentiment_score = confidence
                    
            except Exception as e:
                print(f"[AI ERROR] Sentiment: {e}")
                sentiment_score = 0.0
                sentiment_label = "Trung tính"
        
        t_end = time.time()
        
        return {
            "sentiment_score": sentiment_score,
            "sentiment_label": sentiment_label,
            "summary": summary_sentences
        }

    async def analyze_content_local(self, content: str) -> dict:
        return await asyncio.to_thread(self._analyze_sync, content)

local_ai_service = LocalAIService()

async def analyze_content_local(content: str) -> dict:
    return await local_ai_service.analyze_content_local(content)