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
        Logic cập nhật: Tính Summary trước -> Dùng Summary làm input cho Sentiment.
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

        t_summ = time.time()

        sentiment_score = 0.0
        
        if not self._sentiment_pipeline:
            self.load_model()
            
        if self._sentiment_pipeline:
            try:
                if summary_sentences:
                    input_text = " ".join(summary_sentences)
                else:
                    input_text = content[:1000]

                raw_output = self._sentiment_pipeline(input_text, truncation=True, max_length=512)
                
                if isinstance(raw_output[0], list):
                    all_scores = raw_output[0]
                else:
                    all_scores = raw_output
                
                pos_score = 0.0
                neg_score = 0.0
                
                for item in all_scores:
                    label = item['label'].upper()
                    score = item['score']
                    
                    if label in ['POS', 'POSITIVE', 'B-POS']:
                        pos_score = score
                    elif label in ['NEG', 'NEGATIVE', 'B-NEG']:
                        neg_score = score
                
                sentiment_score = pos_score - neg_score
                    
            except Exception as e:
                print(f"[AI ERROR] Sentiment: {e}")
                sentiment_score = 0.0
        
        t_end = time.time()
                
        return {
            "sentiment_score": sentiment_score,
            "summary": summary_sentences
        }

    async def analyze_content_local(self, content: str) -> dict:
        return await asyncio.to_thread(self._analyze_sync, content)

local_ai_service = LocalAIService()

async def analyze_content_local(content: str) -> dict:
    return await local_ai_service.analyze_content_local(content)




# import asyncio
# import numpy as np
# from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
# from sklearn.metrics.pairwise import cosine_similarity
# from config import SENTIMENT_MODEL_NAME
# from services.embedding_service import get_embedding_service
# import re
# import torch
# import time

# class LocalAIService:
#     _instance = None
#     _sentiment_pipeline = None
#     _tokenizer = None

#     def __new__(cls):
#         if cls._instance is None:
#             cls._instance = super(LocalAIService, cls).__new__(cls)
#         return cls._instance

#     def load_model(self):
#         if self._sentiment_pipeline is None:
#             print(f"[AI-LOCAL] Đang tải model Sentiment '{SENTIMENT_MODEL_NAME}'...")
#             t0 = time.time()
#             try:
#                 self._tokenizer = AutoTokenizer.from_pretrained(SENTIMENT_MODEL_NAME)
#                 model = AutoModelForSequenceClassification.from_pretrained(SENTIMENT_MODEL_NAME)
                
#                 # Quantization để giảm RAM và tăng tốc CPU
#                 quantized_model = torch.quantization.quantize_dynamic(
#                     model, {torch.nn.Linear}, dtype=torch.qint8
#                 )
                
#                 self._sentiment_pipeline = pipeline(
#                     "sentiment-analysis", 
#                     model=quantized_model, 
#                     tokenizer=self._tokenizer, 
#                     device=-1, # CPU
#                     top_k=None # Trả về điểm số của TẤT CẢ các nhãn
#                 )
#                 print(f"[AI-LOCAL] Model loaded in {time.time()-t0:.2f}s")
#             except Exception as e:
#                 print(f"[AI-LOCAL ERROR] Load model fail: {e}")

#     def _analyze_sync(self, content: str) -> dict:
#         t_start = time.time()
        
#         # 1. Sentiment Analysis
#         sentiment_score = 0.0
        
#         if not self._sentiment_pipeline:
#             self.load_model()
            
#         if self._sentiment_pipeline:
#             try:
#                 input_text = content[:1500]
                
#                 # pipeline(top_k=None) trả về danh sách chứa các dict điểm số
#                 # VD: [[{'label': 'POS', 'score': 0.1}, {'label': 'NEU', 'score': 0.8}, ...]]
#                 raw_output = self._sentiment_pipeline(input_text)
                
#                 # Xử lý format đầu ra (đôi khi là list of lists, đôi khi là list of dicts)
#                 if isinstance(raw_output[0], list):
#                     all_scores = raw_output[0]
#                 else:
#                     all_scores = raw_output
                
#                 pos_score = 0.0
#                 neg_score = 0.0
                
#                 # Duyệt qua tất cả các nhãn để lấy xác suất POS và NEG
#                 for item in all_scores:
#                     label = item['label'].upper()
#                     score = item['score']
                    
#                     if label in ['POS', 'POSITIVE', 'B-POS']:
#                         pos_score = score
#                     elif label in ['NEG', 'NEGATIVE', 'B-NEG']:
#                         neg_score = score
                
#                 # [OPTIMIZED LOGIC] Weighted Score
#                 # Loại bỏ hoàn toàn tính ngẫu nhiên
#                 sentiment_score = pos_score - neg_score
                    
#             except Exception as e:
#                 print(f"[AI ERROR] Sentiment: {e}")
#                 sentiment_score = 0.0
        
#         t_sent = time.time()

#         # 2. Extractive Summarization (Embedding-based)
#         summary_sentences = []
#         try:
#             sentences = re.split(r'(?<=[.!?])\s+', content)
#             valid_sentences = [s.strip() for s in sentences if len(s.strip()) > 25][:40]
            
#             if len(valid_sentences) <= 3:
#                 summary_sentences = valid_sentences
#             else:
#                 embed_service = get_embedding_service()
#                 vectors = embed_service.get_embeddings(valid_sentences)
                
#                 if vectors and len(vectors) > 0:
#                     mat = np.array(vectors)
#                     doc_embedding = np.mean(mat, axis=0).reshape(1, -1)
                    
#                     sims = cosine_similarity(mat, doc_embedding).flatten()
                    
#                     top_idx = sims.argsort()[-3:][::-1]
#                     top_idx = sorted(top_idx)
#                     summary_sentences = [valid_sentences[i] for i in top_idx]
#                 else:
#                     summary_sentences = valid_sentences[:3]

#         except Exception as e:
#             print(f"[AI ERROR] Summary: {e}")
#             summary_sentences = [content[:200] + "..."]

#         t_end = time.time()
        
#         return {
#             "sentiment_score": sentiment_score,
#             "summary": summary_sentences
#         }

#     async def analyze_content_local(self, content: str) -> dict:
#         return await asyncio.to_thread(self._analyze_sync, content)

# local_ai_service = LocalAIService()

# async def analyze_content_local(content: str) -> dict:
#     return await local_ai_service.analyze_content_local(content)




# import asyncio
# import numpy as np
# from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
# from sklearn.metrics.pairwise import cosine_similarity
# from config import SENTIMENT_MODEL_NAME
# from services.embedding_service import get_embedding_service
# import re
# import torch
# import time

# class LocalAIService:
#     _instance = None
#     _sentiment_pipeline = None
#     _tokenizer = None

#     def __new__(cls):
#         if cls._instance is None:
#             cls._instance = super(LocalAIService, cls).__new__(cls)
#         return cls._instance

#     def load_model(self):
#         if self._sentiment_pipeline is None:
#             print(f"[AI-LOCAL] Đang tải model Sentiment '{SENTIMENT_MODEL_NAME}'...")
#             t0 = time.time()
#             try:
#                 self._tokenizer = AutoTokenizer.from_pretrained(SENTIMENT_MODEL_NAME)
#                 model = AutoModelForSequenceClassification.from_pretrained(SENTIMENT_MODEL_NAME)
#                 quantized_model = torch.quantization.quantize_dynamic(
#                     model, {torch.nn.Linear}, dtype=torch.qint8
#                 )
#                 self._sentiment_pipeline = pipeline(
#                     "sentiment-analysis", 
#                     model=quantized_model, 
#                     tokenizer=self._tokenizer, 
#                     device=-1,
#                     top_k=None 
#                 )
#                 print(f"[AI-LOCAL] Model loaded in {time.time()-t0:.2f}s.")
#             except Exception as e:
#                 print(f"[AI-LOCAL ERROR] Load model failed: {e}")

#     async def analyze_content_local(self, content: str):
#         """
#         Phân tích siêu tốc (Ultra-fast) cho CPU.
#         Input: content (hoặc summary)
#         """
#         if not content or len(content.strip()) < 20:
#             return {"summary": ["Nội dung quá ngắn."], "sentiment_score": 0.0}

#         if not self._sentiment_pipeline:
#             await asyncio.to_thread(self.load_model)

#         t_start = time.time()
        
#         sentiment_score = 0.0
#         try:
#             text_for_sentiment = content[:1000] 

#             result = await asyncio.to_thread(
#                 self._sentiment_pipeline, 
#                 text_for_sentiment, 
#                 truncation=True, 
#                 max_length=256
#             )
            
#             if result:
#                 scores_list = []
#                 if isinstance(result, list):
#                     if len(result) > 0:
#                         first_item = result[0]
#                         if isinstance(first_item, list):
#                             scores_list = first_item
#                         elif isinstance(first_item, dict):
#                             scores_list = result
                
#                 if scores_list and isinstance(scores_list, list) and len(scores_list) > 0 and isinstance(scores_list[0], dict):
#                     sorted_scores = sorted(scores_list, key=lambda x: x.get('score', 0.0), reverse=True)
#                     top_result = sorted_scores[0]
                    
#                     label = top_result.get('label')
#                     confidence = top_result.get('score', 0.0)
                    
#                     if label == 'POS': sentiment_score = confidence
#                     elif label == 'NEG': sentiment_score = -confidence
#                     else: sentiment_score = 0.0
#                 else:
#                     pass

#         except Exception as e:
#             print(f"[AI ERROR] Sentiment failed: {e}")
#             sentiment_score = 0.0

#         t_sent = time.time()

#         summary_sentences = []
#         try:
#             sentences = re.split(r'(?<=[.!?])\s+', content)
#             valid_sentences = [s.strip() for s in sentences if len(s.strip()) > 25][:40]
            
#             if len(valid_sentences) <= 3:
#                 summary_sentences = valid_sentences
#             else:
#                 embed_service = get_embedding_service()
#                 vectors = await embed_service.get_embeddings_async(valid_sentences)
#                 if vectors and len(vectors) > 0:
#                     mat = np.array(vectors)
#                     doc_embedding = np.mean(mat, axis=0).reshape(1, -1)
                    
#                     sims = cosine_similarity(mat, doc_embedding).flatten()
#                     top_idx = sims.argsort()[-3:][::-1]
#                     top_idx = sorted(top_idx)
#                     summary_sentences = [valid_sentences[i] for i in top_idx]
#                 else:
#                     summary_sentences = valid_sentences[:3]

#         except Exception as e:
#             print(f"[AI ERROR] Summary: {e}")
#             summary_sentences = [content[:200] + "..."]

#         t_end = time.time()
        
#         print(f"[PERF] Sent: {t_sent-t_start:.2f}s | Summ: {t_end-t_sent:.2f}s | Total: {t_end-t_start:.2f}s")

#         return {
#             "summary": summary_sentences,
#             "sentiment_score": round(sentiment_score, 2)
#         }

# local_ai_service = LocalAIService()
# async def analyze_content_local(content: str):
#     return await local_ai_service.analyze_content_local(content)