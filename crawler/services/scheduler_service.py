from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
import datetime
import asyncio
import httpx
from typing import List, Optional
import sys
import uuid 

from database import (
    get_articles_collection, get_topics_collection, get_qdrant_client, get_meili_client
)
from services.ai_service import analyze_content_local
from services.embedding_service import get_embedding_service
from services.crawler_service import crawl_and_process_article, sync_to_meilisearch
from config import AUTO_CRAWL_MONTHS, HEADERS, REQUEST_TIMEOUT, RETRY_COUNT, QDRANT_COLLECTION
from pymongo import UpdateOne
from utils import split_text_into_chunks

from crawlers.vnexpress_crawler import VnExpressCrawler
from crawlers.vneconomy_crawler import VneconomyCrawler
from qdrant_client.models import PointStruct 

scheduler = AsyncIOScheduler()

TOPIC_CONCURRENCY_LIMIT = 3 
topic_semaphore = asyncio.Semaphore(TOPIC_CONCURRENCY_LIMIT)

# --- WORKER 1: ENRICHMENT ---
async def enrichment_worker():
    articles_col = get_articles_collection()
    qdrant = get_qdrant_client()
    meili = get_meili_client()
    embed_service = get_embedding_service()
    
    try:
        # [TỐI ƯU] Tăng batch size lên 10
        cursor = articles_col.find({'status': {'$in': ['raw', 'ai_error']}}).limit(10)
        articles = await cursor.to_list(length=10)
    except Exception: return

    if not articles: return
    
    print(f"[WORKER] Đang xử lý AI cho {len(articles)} bài viết...")

    for article in articles:
        # Đánh dấu đang xử lý để worker khác không lấy trùng
        await articles_col.update_one({'_id': article['_id']}, {'$set': {'status': 'processing'}})
        
        try:
            # Ưu tiên dùng content, fallback sang summary
            content_for_analysis = article.get('content', '')
            if not content_for_analysis:
                content_for_analysis = article.get('summary', '')

            ai_result = await analyze_content_local(content_for_analysis)
            
            # [CHECK] Đảm bảo tóm tắt tối đa 3 câu
            raw_summary = ai_result.get('summary', [])
            final_summary = raw_summary[:3] if raw_summary else []

            updates = {
                'last_enriched_at': datetime.datetime.now(),
                'ai_summary': final_summary,
                'ai_sentiment_score': ai_result.get('sentiment_score', 0.0),
                'status': 'enriched'
            }
            
            # Cập nhật Mongo
            await articles_col.update_one({'_id': article['_id']}, {'$set': updates})
            
            # Update Meilisearch
            if meili:
                try:
                    index = meili.index("articles")
                    # Đảm bảo search_id lấy từ DB ra, nếu không có thì default mảng
                    s_id_val = article.get('search_id')
                    if not s_id_val: s_id_val = ['system_auto']
                    elif isinstance(s_id_val, str): s_id_val = [s_id_val]

                    update_doc = {
                        'article_id': article.get('article_id'),
                        'ai_sentiment_score': updates['ai_sentiment_score'],
                        'ai_summary': updates['ai_summary'],
                        'search_id': s_id_val
                    }
                    await index.update_documents([update_doc])
                except Exception as e:
                    print(f"[MEILI ERROR] Update AI failed: {e}")

            # Update Qdrant
            if qdrant and updates['status'] == 'enriched':
                points = []
                content_text = article.get('content', '')
                if not content_text: content_text = article.get('summary', '')
                
                # Chuẩn bị search_id cho Qdrant
                s_id_val = article.get('search_id')
                if not s_id_val: s_id_val = ['system_auto']
                elif isinstance(s_id_val, str): s_id_val = [s_id_val]

                # 1. CHUNKS
                chunks = split_text_into_chunks(article.get('article_id'), content_text)
                for chunk in chunks:
                    vector = await embed_service.get_embedding_async(chunk['text'])
                    if not vector: continue
                    
                    qdrant_chunk_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, chunk['chunk_id']))
                    chunk_payload = {
                        "type": "chunk",
                        "article_id": article.get('article_id'),
                        "chunk_id": chunk['chunk_id'],
                        "text": chunk['text'], 
                        "user_id": article.get('user_id', 'system'),
                        "search_id": s_id_val, 
                        "title": article.get('title', ''),
                        "url": article.get('url', ''),
                        "website": article.get('website'),
                        "publish_date": article.get('publish_date').isoformat() if article.get('publish_date') else None,
                        "sentiment": updates.get('ai_sentiment_score', 0.0),
                        "topic": article.get('site_categories', []) 
                    }
                    points.append(PointStruct(id=qdrant_chunk_id, vector=vector, payload=chunk_payload))
                
                # 2. AI SUMMARY
                ai_summary_list = updates.get('ai_summary', [])
                if ai_summary_list:
                    summary_text_joined = "\n".join(ai_summary_list)
                    summary_vector = await embed_service.get_embedding_async(summary_text_joined)
                    if summary_vector:
                        summary_point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{article.get('article_id')}_summary"))
                        summary_payload = {
                            "type": "ai_summary",
                            "article_id": article.get('article_id'),
                            "summary_text": ai_summary_list,
                            "title": article.get('title', ''),
                            "url": article.get('url', ''),
                            "website": article.get('website'),
                            "publish_date": article.get('publish_date').isoformat() if article.get('publish_date') else None,
                            "topic": article.get('site_categories', []),
                            "sentiment": updates.get('ai_sentiment_score', 0.0),
                            "search_id": s_id_val,
                            "user_id": article.get('user_id', 'system')
                        }
                        points.append(PointStruct(id=summary_point_id, vector=summary_vector, payload=summary_payload))

                if points:
                    await qdrant.upsert(collection_name=QDRANT_COLLECTION, points=points)
                    
        except Exception as e:
            print(f"[WORKER ERROR] Lỗi bài {article.get('url')}: {e}")
            await articles_col.update_one({'_id': article['_id']}, {'$set': {'status': 'ai_error'}})

# --- WORKER 2: AUTO-CRAWL ---
async def process_single_topic(topic, crawler, articles_col, topics_col, cutoff_date):
    async with topic_semaphore: 
        site = topic['website']
        url = topic['url']
        cutoff_log = cutoff_date.strftime('%d/%m %H:%M')
        print(f"[AUTO] >> Quét: {topic['name']} | Stop at: {cutoff_log}")
        
        page = 1
        stop_topic = False
        new_count = 0
        
        # [UPDATED] Tăng giới hạn lên 50 trang
        while page <= 50 and not stop_topic: 
            try:
                soup = await crawler.fetch_category_page(url, page)
                if not soup: break
                
                links = crawler.extract_article_links(soup, is_search_page=False)
                if not links: break
                
                tasks = []
                for link in links:
                    if link.get('publish_date'):
                        if link['publish_date'] < cutoff_date:
                            print(f"[AUTO] Gặp bài cũ ({link['publish_date']}), dừng topic {topic['name']}.")
                            stop_topic = True
                            break 
                    
                    if await articles_col.find_one({'url': link['url']}, {'_id': 1}): 
                        continue
                    
                    tasks.append(crawl_and_process_article(crawler, link, None, site, [], "system_auto", "system"))
                
                if tasks:
                    results = await asyncio.gather(*tasks)
                    valid_res = [r for r in results if r]
                    if valid_res:
                        ops = []
                        for d in valid_res:
                            if 'current_search_id' in d: del d['current_search_id']
                            
                            ops.append(UpdateOne(
                                {'url': d['url']}, 
                                {'$set': d, '$addToSet': {'search_id': "system_auto"}}, 
                                upsert=True
                            ))
                        
                        await articles_col.bulk_write(ops, ordered=False)
                        
                        for d in valid_res: d['search_id'] = ["system_auto"] 
                        await sync_to_meilisearch(valid_res)
                        
                        new_count += len(valid_res)
                
                page += 1
                await asyncio.sleep(1)
            except Exception as e:
                print(f"[AUTO ERR] {topic['name']}: {e}"); break
        
        await topics_col.update_one({'_id': topic['_id']}, {'$set': {'last_crawled_at': datetime.datetime.now()}})
        if new_count > 0: print(f"[AUTO] << Xong {topic['name']}: +{new_count} bài mới.")

async def execute_topic_crawl(website_filter: Optional[str] = None):
    filter_log = f"Filter: {website_filter}" if website_filter else "Filter: ALL"
    print(f"--- [AUTO CRAWL] START ({filter_log}) ---")
    topics_col = get_topics_collection(); articles_col = get_articles_collection()
    query = {'is_active': True}
    if website_filter: query['website'] = website_filter
    try: topics = await topics_col.find(query).to_list(length=100)
    except: return
    if not topics: return
    async with httpx.AsyncClient(headers=HEADERS, timeout=REQUEST_TIMEOUT, follow_redirects=True) as client:
        crawler_instances = {}
        if website_filter == 'vneconomy.vn' or website_filter is None: crawler_instances['vneconomy.vn'] = VneconomyCrawler(client)
        if website_filter == 'vnexpress.net' or website_filter is None: crawler_instances['vnexpress.net'] = VnExpressCrawler(client)
        tasks = []
        for topic in topics:
            site = topic['website']; crawler = crawler_instances.get(site)
            if crawler:
                if topic.get('last_crawled_at'): topic_cutoff = topic['last_crawled_at'] - datetime.timedelta(minutes=30)
                else: topic_cutoff = datetime.datetime.now() - datetime.timedelta(days=3)
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
    
    # [CHANGE] Tăng tốc độ: Chạy mỗi 5 giây, xử lý tối đa 10 bài/lần
    # max_instances=2: Cho phép chạy chồng nếu lỡ bị chậm đột xuất
    scheduler.add_job(enrichment_worker, IntervalTrigger(seconds=5), id='enrichment', replace_existing=True, max_instances=2)
    
    scheduler.add_job(execute_topic_crawl, IntervalTrigger(hours=2), id='topic_crawl', replace_existing=True)
    scheduler.start()