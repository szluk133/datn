from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
import datetime
import asyncio
import httpx
from typing import List, Optional
import sys
import uuid 

from database import (
    get_articles_collection, get_topics_collection, get_qdrant_client, get_meili_client,
    get_my_articles_collection
)
from services.ai_service import analyze_content_local
from services.embedding_service import get_embedding_service
from services.crawler_service import crawl_and_process_article, sync_to_meilisearch
from config import AUTO_CRAWL_MONTHS, HEADERS, REQUEST_TIMEOUT, RETRY_COUNT, QDRANT_COLLECTION
from pymongo import UpdateOne
from utils import split_text_into_chunks

from crawlers.vnexpress_crawler import VnExpressCrawler
from crawlers.vneconomy_crawler import VneconomyCrawler
from crawlers.cafef_crawler import CafeFCrawler
from qdrant_client.models import PointStruct 

scheduler = AsyncIOScheduler()

TOPIC_CONCURRENCY_LIMIT = 5 
topic_semaphore = asyncio.Semaphore(TOPIC_CONCURRENCY_LIMIT)

# [NEW] Hàm xử lý Đồng bộ cho API (được await trực tiếp từ Controller)
async def process_user_articles_ai(user_id: str, update_id: str) -> int:
    """
    Hàm này chạy tuần tự, xử lý xong mới return.
    Dùng cho API /my-articles/enrich để user chờ kết quả.
    """
    my_articles_col = get_my_articles_collection()
    qdrant = get_qdrant_client()
    embed_service = get_embedding_service()
    
    print(f"[MY_ARTICLES] Bắt đầu xử lý cho User: {user_id}, UpdateID: {update_id}")
    
    # 1. Tìm kiếm bài viết theo batch
    cursor = my_articles_col.find({'user_id': user_id, 'update_id': update_id})
    articles = await cursor.to_list(length=None)
    
    if not articles:
        print(f"[MY_ARTICLES] Không tìm thấy bài viết nào.")
        return 0

    processed_count = 0
    
    for article in articles:
        try:
            content = article.get('content', '')
            title = article.get('title', '')
            
            # 2. Sinh AI Data
            # Logic: Nếu bài quá ngắn (<50 char) thì bỏ qua AI, gán mặc định
            if len(content) < 50:
                 ai_result = {
                    "summary": [], 
                    "sentiment_score": 0.0, 
                    "sentiment_label": "Trung tính"
                }
            else:
                ai_result = await analyze_content_local(content)
            
            updates = {
                'ai_summary': ai_result.get('summary', []),
                'ai_sentiment_score': ai_result.get('sentiment_score', 0.0),
                'ai_sentiment_label': ai_result.get('sentiment_label', "Trung tính"),
                'last_enriched_at': datetime.datetime.now()
            }
            
            # Update MongoDB
            await my_articles_col.update_one({'_id': article['_id']}, {'$set': updates})
            article.update(updates) 
            
            # 3. Đồng bộ Qdrant (type="my_page")
            if qdrant:
                points = []
                base_payload = {
                    "type": "my_page",
                    "article_id": article.get('article_id', str(article['_id'])),
                    "content": content, 
                    "title": title,
                    "website": article.get('website', 'uploaded'),
                    "publish_date": article.get('publish_date'),
                    "user_id": user_id,
                    "update_id": update_id,
                    "sentiment_label": updates['ai_sentiment_label'],
                    "sentiment_score": updates['ai_sentiment_score']
                }
                
                # Chuẩn hóa ngày tháng
                if isinstance(base_payload['publish_date'], datetime.datetime):
                    base_payload['publish_date'] = base_payload['publish_date'].isoformat()
                
                # Chia Chunk
                chunks = split_text_into_chunks(base_payload['article_id'], content)
                
                for chunk in chunks:
                    vector = await embed_service.get_embedding_async(chunk['text'])
                    if not vector: continue
                    
                    qdrant_point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{base_payload['article_id']}_{chunk['chunk_id']}"))
                    chunk_payload = base_payload.copy()
                    chunk_payload['text'] = chunk['text'] 
                    
                    points.append(PointStruct(id=qdrant_point_id, vector=vector, payload=chunk_payload))
                
                # Vector Summary
                ai_summary_list = updates.get('ai_summary', [])
                if ai_summary_list:
                    summary_text = "\n".join(ai_summary_list)
                    sum_vector = await embed_service.get_embedding_async(summary_text)
                    if sum_vector:
                        sum_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{base_payload['article_id']}_summary"))
                        sum_payload = base_payload.copy()
                        sum_payload['is_summary'] = True
                        sum_payload['text'] = summary_text
                        points.append(PointStruct(id=sum_id, vector=sum_vector, payload=sum_payload))

                if points:
                    if hasattr(qdrant, 'upsert'):
                        await qdrant.upsert(collection_name=QDRANT_COLLECTION, points=points)
            
            processed_count += 1
            
        except Exception as e:
            print(f"[MY_ARTICLES ERROR] ID {article.get('_id')}: {e}")

    print(f"[MY_ARTICLES] Hoàn tất. Đã xử lý {processed_count}/{len(articles)} bài.")
    return processed_count

# [BACKGROUND] Worker chạy ngầm định kỳ cho bài Crawl (Giữ nguyên)
async def enrichment_worker():
    articles_col = get_articles_collection()
    qdrant = get_qdrant_client()
    meili = get_meili_client()
    embed_service = get_embedding_service()
    
    try:
        cursor = articles_col.find({'status': {'$in': ['raw', 'ai_error']}}).limit(20)
        articles = await cursor.to_list(length=20)
    except Exception: return

    if not articles: return
    
    print(f"[WORKER] Bắt đầu xử lý AI cho {len(articles)} bài viết...")
    
    ids_to_process = [doc['_id'] for doc in articles]
    await articles_col.update_many(
        {'_id': {'$in': ids_to_process}},
        {'$set': {'status': 'processing'}}
    )

    for article in articles:
        try:
            content_for_analysis = article.get('content', '')
            if not content_for_analysis:
                content_for_analysis = article.get('summary', '')

            if len(content_for_analysis) < 50:
                updates = {
                    'last_enriched_at': datetime.datetime.now(),
                    'ai_summary': [],
                    'ai_sentiment_score': 0.0,
                    'ai_sentiment_label': "Trung tính",
                    'status': 'enriched'
                }
            else:
                ai_result = await analyze_content_local(content_for_analysis)
                raw_summary = ai_result.get('summary', [])
                final_summary = raw_summary[:3] if raw_summary else []

                updates = {
                    'last_enriched_at': datetime.datetime.now(),
                    'ai_summary': final_summary,
                    'ai_sentiment_score': ai_result.get('sentiment_score', 0.0),
                    'ai_sentiment_label': ai_result.get('sentiment_label', "Trung tính"),
                    'status': 'enriched'
                }
            
            await articles_col.update_one({'_id': article['_id']}, {'$set': updates})
            
            if meili:
                try:
                    article.update(updates)
                    s_id_val = article.get('search_id')
                    if not s_id_val: s_id_val = ['system_auto']
                    elif isinstance(s_id_val, str): s_id_val = [s_id_val]
                    article['search_id'] = s_id_val
                    await sync_to_meilisearch([article])
                except Exception as e:
                    print(f"[MEILI ERROR] Sync failed: {e}")

            if qdrant and updates['status'] == 'enriched':
                points = []
                content_text = article.get('content', '') or article.get('summary', '')
                
                s_id_val = article.get('search_id')
                if not s_id_val: s_id_val = ['system_auto']
                elif isinstance(s_id_val, str): s_id_val = [s_id_val]

                base_payload = {
                    "article_id": article.get('article_id'),
                    "user_id": article.get('user_id', 'system'),
                    "search_id": s_id_val, 
                    "title": article.get('title', ''),
                    "url": article.get('url', ''),
                    "website": article.get('website'),
                    "publish_date": article.get('publish_date').isoformat() if article.get('publish_date') else None,
                    "sentiment": updates.get('ai_sentiment_score', 0.0),
                    "sentiment_label": updates.get('ai_sentiment_label', "Trung tính"),
                    "topic": article.get('site_categories', []) 
                }

                chunks = split_text_into_chunks(article.get('article_id'), content_text)
                for chunk in chunks:
                    vector = await embed_service.get_embedding_async(chunk['text'])
                    if not vector: continue
                    qdrant_chunk_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, chunk['chunk_id']))
                    chunk_payload = base_payload.copy()
                    chunk_payload.update({
                        "type": "chunk",
                        "chunk_id": chunk['chunk_id'],
                        "text": chunk['text']
                    })
                    points.append(PointStruct(id=qdrant_chunk_id, vector=vector, payload=chunk_payload))
                
                ai_summary_list = updates.get('ai_summary', [])
                if ai_summary_list:
                    summary_text_joined = "\n".join(ai_summary_list)
                    summary_vector = await embed_service.get_embedding_async(summary_text_joined)
                    if summary_vector:
                        summary_point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{article.get('article_id')}_summary"))
                        summary_payload = base_payload.copy()
                        summary_payload.update({
                            "type": "ai_summary",
                            "summary_text": ai_summary_list
                        })
                        points.append(PointStruct(id=summary_point_id, vector=summary_vector, payload=summary_payload))

                if points:
                    if hasattr(qdrant, 'upsert'):
                        await qdrant.upsert(collection_name=QDRANT_COLLECTION, points=points)
                    
        except Exception as e:
            print(f"[WORKER ERROR] Lỗi bài {article.get('url')}: {e}")
            await articles_col.update_one({'_id': article['_id']}, {'$set': {'status': 'ai_error'}})
            
    print(f"[WORKER] Hoàn tất batch {len(articles)} bài.")

# [BACKGROUND] Auto Crawl Logic (Giữ nguyên)
async def process_single_topic(topic, crawler, articles_col, topics_col, cutoff_date):
    async with topic_semaphore: 
        site = topic['website']
        url = topic['url']
        cutoff_log = cutoff_date.strftime('%d/%m %H:%M')
        print(f"[AUTO] >> Quét: {topic['name']} | Stop at: {cutoff_log}")
        
        page = 1
        stop_topic = False
        new_count = 0
        
        while page <= 50 and not stop_topic: 
            try:
                soup = await crawler.fetch_category_page(url, page)
                if not soup: break
                
                links = crawler.extract_article_links(soup, is_search_page=False)
                if not links: break
                
                tasks = []
                for link in links:
                    url_check = link['url']
                    if link.get('publish_date') and link['publish_date'] < cutoff_date:
                        existing_doc = await articles_col.find_one({'url': url_check}, {'search_id': 1})
                        if existing_doc and 'system_auto' in existing_doc.get('search_id', []):
                            print(f"[AUTO] Bài cũ ({link['publish_date']}) ĐÃ CÓ 'system_auto'. Dừng topic {topic['name']}.")
                            stop_topic = True
                            break
                        else: pass

                    existing_full = await articles_col.find_one({'url': url_check}, {'search_id': 1})
                    if existing_full:
                        if 'system_auto' in existing_full.get('search_id', []): continue 
                    
                    tasks.append(crawl_and_process_article(crawler, link, None, site, [], "system_auto", "system"))
                
                if tasks:
                    results = await asyncio.gather(*tasks)
                    valid_res = [r for r in results if r]
                    if valid_res:
                        ops = []
                        for d in valid_res:
                            if 'current_search_id' in d: del d['current_search_id']
                            ops.append(UpdateOne({'url': d['url']}, {'$set': d, '$addToSet': {'search_id': "system_auto"}}, upsert=True))
                        await articles_col.bulk_write(ops, ordered=False)
                        for d in valid_res: d['search_id'] = ["system_auto"] 
                        await sync_to_meilisearch(valid_res)
                        new_count += len(valid_res)
                
                page += 1
                await asyncio.sleep(1)
            except Exception as e: print(f"[AUTO ERR] {topic['name']}: {e}"); break
        
        await topics_col.update_one({'_id': topic['_id']}, {'$set': {'last_crawled_at': datetime.datetime.now()}})
        if new_count > 0: print(f"[AUTO] << Xong {topic['name']}: +{new_count} bài mới.")

async def execute_topic_crawl(website_filter: Optional[str] = None, force_days_back: int = None):
    filter_log = f"Filter: {website_filter}" if website_filter else "Filter: ALL"
    force_log = f"| FORCE DAYS: {force_days_back}" if force_days_back else ""
    print(f"--- [AUTO CRAWL] START ({filter_log}) {force_log} ---")
    
    topics_col = get_topics_collection(); articles_col = get_articles_collection()
    query = {'is_active': True}
    if website_filter: query['website'] = website_filter
    try: topics = await topics_col.find(query).to_list(length=100)
    except: return
    if not topics: return
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    async with httpx.AsyncClient(headers=headers, timeout=REQUEST_TIMEOUT, follow_redirects=True) as client:
        crawler_instances = {}
        if website_filter == 'vneconomy.vn' or website_filter is None: crawler_instances['vneconomy.vn'] = VneconomyCrawler(client)
        if website_filter == 'vnexpress.net' or website_filter is None: crawler_instances['vnexpress.net'] = VnExpressCrawler(client)
        if website_filter == 'cafef.vn' or website_filter is None: crawler_instances['cafef.vn'] = CafeFCrawler(client)
        
        tasks = []
        now = datetime.datetime.now()
        
        for topic in topics:
            site = topic['website']; crawler = crawler_instances.get(site)
            if crawler:
                last_crawled = topic.get('last_crawled_at')
                if force_days_back:
                    topic_cutoff = now - datetime.timedelta(days=force_days_back)
                elif last_crawled:
                    time_diff = now - last_crawled
                    if time_diff.days > 60: topic_cutoff = now - datetime.timedelta(days=60)
                    else: topic_cutoff = last_crawled - datetime.timedelta(days=1)
                else: topic_cutoff = now - datetime.timedelta(days=60)

                tasks.append(process_single_topic(topic, crawler, articles_col, topics_col, topic_cutoff))
        if tasks: await asyncio.gather(*tasks)
    print(f"--- [AUTO CRAWL] END ---")

def reschedule_topic_crawl(minutes: int):
    try:
        scheduler.reschedule_job('topic_crawl', trigger=IntervalTrigger(minutes=minutes))
        print(f"[SCHEDULER] Đã cập nhật lịch Auto-Crawl: {minutes} phút/lần.")
        return True
    except Exception as e:
        print(f"[SCHEDULER ERROR] Không thể cập nhật lịch: {e}")
        return False

def start_scheduler():
    get_embedding_service().load_model()
    from services.ai_service import local_ai_service
    import threading
    threading.Thread(target=local_ai_service.load_model).start()
    
    scheduler.add_job(enrichment_worker, IntervalTrigger(seconds=30), id='enrichment', replace_existing=True, max_instances=2)
    scheduler.add_job(execute_topic_crawl, IntervalTrigger(hours=2), id='topic_crawl', replace_existing=True)
    scheduler.start()




# from apscheduler.schedulers.asyncio import AsyncIOScheduler
# from apscheduler.triggers.interval import IntervalTrigger
# import datetime
# import asyncio
# import httpx
# from typing import List, Optional
# import sys
# import uuid 

# from database import (
#     get_articles_collection, get_topics_collection, get_qdrant_client, get_meili_client
# )
# from services.ai_service import analyze_content_local
# from services.embedding_service import get_embedding_service
# from services.crawler_service import crawl_and_process_article, sync_to_meilisearch
# from config import AUTO_CRAWL_MONTHS, HEADERS, REQUEST_TIMEOUT, RETRY_COUNT, QDRANT_COLLECTION
# from pymongo import UpdateOne
# from utils import split_text_into_chunks

# from crawlers.vnexpress_crawler import VnExpressCrawler
# from crawlers.vneconomy_crawler import VneconomyCrawler
# from crawlers.cafef_crawler import CafeFCrawler
# from qdrant_client.models import PointStruct 

# scheduler = AsyncIOScheduler()

# TOPIC_CONCURRENCY_LIMIT = 5 
# topic_semaphore = asyncio.Semaphore(TOPIC_CONCURRENCY_LIMIT)

# async def enrichment_worker():
#     articles_col = get_articles_collection()
#     qdrant = get_qdrant_client()
#     meili = get_meili_client()
#     embed_service = get_embedding_service()
    
#     try:
#         cursor = articles_col.find({'status': {'$in': ['raw', 'ai_error']}}).limit(20)
#         articles = await cursor.to_list(length=20)
#     except Exception: return

#     if not articles: return
    
#     print(f"[WORKER] Bắt đầu xử lý AI cho {len(articles)} bài viết...")
    
#     ids_to_process = [doc['_id'] for doc in articles]
#     await articles_col.update_many(
#         {'_id': {'$in': ids_to_process}},
#         {'$set': {'status': 'processing'}}
#     )

#     for article in articles:
#         try:
#             content_for_analysis = article.get('content', '')
#             if not content_for_analysis:
#                 content_for_analysis = article.get('summary', '')

#             # Xử lý trường hợp bài quá ngắn
#             if len(content_for_analysis) < 50:
#                 updates = {
#                     'last_enriched_at': datetime.datetime.now(),
#                     'ai_summary': [],
#                     'ai_sentiment_score': 0.0,
#                     'ai_sentiment_label': "Trung tính",
#                     'status': 'enriched'
#                 }
#             else:
#                 # Gọi AI Service mới
#                 ai_result = await analyze_content_local(content_for_analysis)
#                 raw_summary = ai_result.get('summary', [])
#                 final_summary = raw_summary[:3] if raw_summary else []

#                 updates = {
#                     'last_enriched_at': datetime.datetime.now(),
#                     'ai_summary': final_summary,
#                     'ai_sentiment_score': ai_result.get('sentiment_score', 0.0),
#                     'ai_sentiment_label': ai_result.get('sentiment_label', "Trung tính"),
#                     'status': 'enriched'
#                 }
            
#             # Update MongoDB
#             await articles_col.update_one({'_id': article['_id']}, {'$set': updates})
            
#             # --- Đồng bộ Meilisearch ---
#             if meili:
#                 try:
#                     article.update(updates)
#                     s_id_val = article.get('search_id')
#                     if not s_id_val: s_id_val = ['system_auto']
#                     elif isinstance(s_id_val, str): s_id_val = [s_id_val]
#                     article['search_id'] = s_id_val
                    
#                     await sync_to_meilisearch([article])
#                 except Exception as e:
#                     print(f"[MEILI ERROR] Sync failed: {e}")

#             # --- Đồng bộ Qdrant ---
#             if qdrant and updates['status'] == 'enriched':
#                 points = []
#                 content_text = article.get('content', '') or article.get('summary', '')
                
#                 s_id_val = article.get('search_id')
#                 if not s_id_val: s_id_val = ['system_auto']
#                 elif isinstance(s_id_val, str): s_id_val = [s_id_val]

#                 # Payload chung cho Qdrant
#                 base_payload = {
#                     "article_id": article.get('article_id'),
#                     "user_id": article.get('user_id', 'system'),
#                     "search_id": s_id_val, 
#                     "title": article.get('title', ''),
#                     "url": article.get('url', ''),
#                     "website": article.get('website'),
#                     "publish_date": article.get('publish_date').isoformat() if article.get('publish_date') else None,
#                     "sentiment": updates.get('ai_sentiment_score', 0.0), # Score [0,1]
#                     "sentiment_label": updates.get('ai_sentiment_label', "Trung tính"), # NEW FIELD
#                     "topic": article.get('site_categories', []) 
#                 }

#                 # 1. Chunk Embeddings
#                 chunks = split_text_into_chunks(article.get('article_id'), content_text)
#                 for chunk in chunks:
#                     vector = await embed_service.get_embedding_async(chunk['text'])
#                     if not vector: continue
                    
#                     qdrant_chunk_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, chunk['chunk_id']))
#                     chunk_payload = base_payload.copy()
#                     chunk_payload.update({
#                         "type": "chunk",
#                         "chunk_id": chunk['chunk_id'],
#                         "text": chunk['text']
#                     })
#                     points.append(PointStruct(id=qdrant_chunk_id, vector=vector, payload=chunk_payload))
                
#                 # 2. Summary Embeddings
#                 ai_summary_list = updates.get('ai_summary', [])
#                 if ai_summary_list:
#                     summary_text_joined = "\n".join(ai_summary_list)
#                     summary_vector = await embed_service.get_embedding_async(summary_text_joined)
#                     if summary_vector:
#                         summary_point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{article.get('article_id')}_summary"))
#                         summary_payload = base_payload.copy()
#                         summary_payload.update({
#                             "type": "ai_summary",
#                             "summary_text": ai_summary_list
#                         })
#                         points.append(PointStruct(id=summary_point_id, vector=summary_vector, payload=summary_payload))

#                 if points:
#                     if hasattr(qdrant, 'upsert'):
#                         await qdrant.upsert(collection_name=QDRANT_COLLECTION, points=points)
                    
#         except Exception as e:
#             print(f"[WORKER ERROR] Lỗi bài {article.get('url')}: {e}")
#             await articles_col.update_one({'_id': article['_id']}, {'$set': {'status': 'ai_error'}})
            
#     print(f"[WORKER] Hoàn tất batch {len(articles)} bài.")

# async def process_single_topic(topic, crawler, articles_col, topics_col, cutoff_date):
#     async with topic_semaphore: 
#         site = topic['website']
#         url = topic['url']
#         cutoff_log = cutoff_date.strftime('%d/%m %H:%M')
#         print(f"[AUTO] >> Quét: {topic['name']} | Stop at: {cutoff_log}")
        
#         page = 1
#         stop_topic = False
#         new_count = 0
        
#         while page <= 50 and not stop_topic: 
#             try:
#                 soup = await crawler.fetch_category_page(url, page)
#                 if not soup: break
                
#                 links = crawler.extract_article_links(soup, is_search_page=False)
#                 if not links: break
                
#                 tasks = []
#                 for link in links:
#                     url_check = link['url']
                    
#                     if link.get('publish_date') and link['publish_date'] < cutoff_date:
#                         existing_doc = await articles_col.find_one({'url': url_check}, {'search_id': 1})
#                         if existing_doc and 'system_auto' in existing_doc.get('search_id', []):
#                             print(f"[AUTO] Bài cũ ({link['publish_date']}) ĐÃ CÓ 'system_auto'. Dừng topic {topic['name']}.")
#                             stop_topic = True
#                             break
#                         else:
#                             pass

#                     existing_full = await articles_col.find_one({'url': url_check}, {'search_id': 1})
#                     if existing_full:
#                         if 'system_auto' in existing_full.get('search_id', []):
#                             continue 
                    
#                     tasks.append(crawl_and_process_article(crawler, link, None, site, [], "system_auto", "system"))
                
#                 if tasks:
#                     results = await asyncio.gather(*tasks)
#                     valid_res = [r for r in results if r]
#                     if valid_res:
#                         ops = []
#                         for d in valid_res:
#                             if 'current_search_id' in d: del d['current_search_id']
#                             ops.append(UpdateOne(
#                                 {'url': d['url']}, 
#                                 {'$set': d, '$addToSet': {'search_id': "system_auto"}}, 
#                                 upsert=True
#                             ))
                        
#                         await articles_col.bulk_write(ops, ordered=False)
                        
#                         for d in valid_res: d['search_id'] = ["system_auto"] 
#                         await sync_to_meilisearch(valid_res)
                        
#                         new_count += len(valid_res)
                
#                 page += 1
#                 await asyncio.sleep(1)
#             except Exception as e:
#                 print(f"[AUTO ERR] {topic['name']}: {e}"); break
        
#         await topics_col.update_one({'_id': topic['_id']}, {'$set': {'last_crawled_at': datetime.datetime.now()}})
#         if new_count > 0: print(f"[AUTO] << Xong {topic['name']}: +{new_count} bài mới.")

# async def execute_topic_crawl(website_filter: Optional[str] = None, force_days_back: int = None):
#     filter_log = f"Filter: {website_filter}" if website_filter else "Filter: ALL"
#     force_log = f"| FORCE DAYS: {force_days_back}" if force_days_back else ""
#     print(f"--- [AUTO CRAWL] START ({filter_log}) {force_log} ---")
    
#     topics_col = get_topics_collection(); articles_col = get_articles_collection()
#     query = {'is_active': True}
#     if website_filter: query['website'] = website_filter
#     try: topics = await topics_col.find(query).to_list(length=100)
#     except: return
#     if not topics: return
    
#     headers = {
#         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
#     }
    
#     async with httpx.AsyncClient(headers=headers, timeout=REQUEST_TIMEOUT, follow_redirects=True) as client:
#         crawler_instances = {}
#         if website_filter == 'vneconomy.vn' or website_filter is None: crawler_instances['vneconomy.vn'] = VneconomyCrawler(client)
#         if website_filter == 'vnexpress.net' or website_filter is None: crawler_instances['vnexpress.net'] = VnExpressCrawler(client)
#         if website_filter == 'cafef.vn' or website_filter is None: crawler_instances['cafef.vn'] = CafeFCrawler(client)
        
#         tasks = []
#         now = datetime.datetime.now()
        
#         for topic in topics:
#             site = topic['website']; crawler = crawler_instances.get(site)
#             if crawler:
#                 last_crawled = topic.get('last_crawled_at')
#                 if force_days_back:
#                     topic_cutoff = now - datetime.timedelta(days=force_days_back)
#                 elif last_crawled:
#                     time_diff = now - last_crawled
#                     if time_diff.days > 60:
#                         topic_cutoff = now - datetime.timedelta(days=60)
#                     else:
#                         topic_cutoff = last_crawled - datetime.timedelta(days=1)
#                 else:
#                     topic_cutoff = now - datetime.timedelta(days=60)

#                 tasks.append(process_single_topic(topic, crawler, articles_col, topics_col, topic_cutoff))
#         if tasks: await asyncio.gather(*tasks)
#     print(f"--- [AUTO CRAWL] END ---")

# def reschedule_topic_crawl(minutes: int):
#     try:
#         scheduler.reschedule_job('topic_crawl', trigger=IntervalTrigger(minutes=minutes))
#         print(f"[SCHEDULER] Đã cập nhật lịch Auto-Crawl: {minutes} phút/lần.")
#         return True
#     except Exception as e:
#         print(f"[SCHEDULER ERROR] Không thể cập nhật lịch: {e}")
#         return False

# def start_scheduler():
#     get_embedding_service().load_model()
#     from services.ai_service import local_ai_service
#     import threading
#     threading.Thread(target=local_ai_service.load_model).start()
    
#     scheduler.add_job(enrichment_worker, IntervalTrigger(seconds=30), id='enrichment', replace_existing=True, max_instances=2)
#     scheduler.add_job(execute_topic_crawl, IntervalTrigger(hours=2), id='topic_crawl', replace_existing=True)
#     scheduler.start()