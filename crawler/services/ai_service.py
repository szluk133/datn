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
                print(f"[AI-LOCAL] Model loaded in {time.time()-t0:.2f}s.")
            except Exception as e:
                print(f"[AI-LOCAL ERROR] Load model failed: {e}")

    async def analyze_content_local(self, content: str):
        """
        Phân tích siêu tốc (Ultra-fast) cho CPU.
        Input: content (hoặc summary)
        """
        if not content or len(content.strip()) < 20:
            return {"summary": ["Nội dung quá ngắn."], "sentiment_score": 0.0}

        if not self._sentiment_pipeline:
            await asyncio.to_thread(self.load_model)

        t_start = time.time()
        
        sentiment_score = 0.0
        try:
            text_for_sentiment = content[:1000] 

            result = await asyncio.to_thread(
                self._sentiment_pipeline, 
                text_for_sentiment, 
                truncation=True, 
                max_length=256
            )
            
            if result:
                scores_list = []
                if isinstance(result, list):
                    if len(result) > 0:
                        first_item = result[0]
                        if isinstance(first_item, list):
                            scores_list = first_item
                        elif isinstance(first_item, dict):
                            scores_list = result
                
                if scores_list and isinstance(scores_list, list) and len(scores_list) > 0 and isinstance(scores_list[0], dict):
                    sorted_scores = sorted(scores_list, key=lambda x: x.get('score', 0.0), reverse=True)
                    top_result = sorted_scores[0]
                    
                    label = top_result.get('label')
                    confidence = top_result.get('score', 0.0)
                    
                    if label == 'POS': sentiment_score = confidence
                    elif label == 'NEG': sentiment_score = -confidence
                    else: sentiment_score = 0.0
                else:
                    pass

        except Exception as e:
            print(f"[AI ERROR] Sentiment failed: {e}")
            sentiment_score = 0.0

        t_sent = time.time()

        summary_sentences = []
        try:
            sentences = re.split(r'(?<=[.!?])\s+', content)
            valid_sentences = [s.strip() for s in sentences if len(s.strip()) > 25][:40]
            
            if len(valid_sentences) <= 3:
                summary_sentences = valid_sentences
            else:
                embed_service = get_embedding_service()
                vectors = await embed_service.get_embeddings_async(valid_sentences)
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

        t_end = time.time()
        
        print(f"[PERF] Sent: {t_sent-t_start:.2f}s | Summ: {t_end-t_sent:.2f}s | Total: {t_end-t_start:.2f}s")

        return {
            "summary": summary_sentences,
            "sentiment_score": round(sentiment_score, 2)
        }

local_ai_service = LocalAIService()
async def analyze_content_local(content: str):
    return await local_ai_service.analyze_content_local(content)