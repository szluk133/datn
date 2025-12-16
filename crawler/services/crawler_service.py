import datetime
import asyncio
import httpx
from typing import List, Dict, Optional, Tuple, Any, Callable, Set
import copy 
from crawlers.base_crawler import BaseCrawler
from config import (
    HISTORY_LIMIT, MAX_CONCURRENT_REQUESTS, QDRANT_COLLECTION, 
    AUTO_CRAWL_MONTHS
)
import motor.motor_asyncio
from pymongo import UpdateOne
from database import get_meili_client, get_qdrant_client, get_articles_collection, get_history_collection
from services.embedding_service import get_embedding_service
from qdrant_client.models import Filter, FieldCondition, MatchAny, MatchValue, MatchText

SEMAPHORE = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)

def json_serializable(obj):
    if isinstance(obj, (datetime.datetime, datetime.date)):
        return obj.isoformat()
    if isinstance(obj, list):
        return [json_serializable(item) for item in obj]
    if isinstance(obj, dict):
        return {k: json_serializable(v) for k, v in obj.items()}
    return obj

async def qdrant_search_wrapper(client, collection_name, query_vector, **kwargs):
    try:
        if hasattr(client, 'search'):
            return await client.search(collection_name=collection_name, query_vector=query_vector, **kwargs)
        elif hasattr(client, 'search_points'):
            return await client.search_points(collection_name=collection_name, vector=query_vector, **kwargs)
        elif hasattr(client, 'query_points'):
            return await client.query_points(collection_name=collection_name, query=query_vector, **kwargs)
        else:
            return []
    except Exception as e:
        print(f"[QDRANT WRAPPER ERROR] {e}")
        return []

async def check_duplicate_with_qdrant(title: str, summary: str) -> bool:
    qdrant = get_qdrant_client()
    embed_service = get_embedding_service()
    if not qdrant: return False
    try:
        text_to_check = f"{title} {summary}"
        vector = await embed_service.get_embedding_async(text_to_check)
        if not vector: return False
        
        search_result = await qdrant_search_wrapper(
            qdrant, 
            collection_name=QDRANT_COLLECTION, 
            query_vector=vector, 
            limit=1, 
            with_payload=True, 
            score_threshold=0.90
        )
        if search_result: return True
    except Exception: return False
    return False

async def search_relevant_articles_for_chat(user_query: str, top_k: int = 3, user_id_filter: str = None) -> List[Dict]:
    qdrant = get_qdrant_client()
    embed_service = get_embedding_service()
    if not qdrant: return []
    try:
        query_vector = await embed_service.get_embedding_async(user_query)
        if not query_vector: return []
        filter_conditions = []
        if user_id_filter:
            filter_conditions.append(FieldCondition(key="user_id", match=MatchAny(any=[user_id_filter, "system", "system_auto"])))
        search_filter = Filter(must=filter_conditions) if filter_conditions else None
        
        hits = await qdrant_search_wrapper(
            qdrant,
            collection_name=QDRANT_COLLECTION, 
            query_vector=query_vector, 
            query_filter=search_filter, 
            limit=top_k, 
            with_payload=True
        )
        
        results = []
        for hit in hits:
            p = hit.payload
            results.append({"text": p.get("text", "") or "\n".join(p.get("summary_text", [])), "title": p.get("title", ""), "url": p.get("url", ""), "score": hit.score, "publish_date": p.get("publish_date", "")})
        return results
    except Exception as e:
        print(f"[CHATBOT ERROR] {e}")
        return []

async def sync_to_meilisearch(articles: List[Dict]):
    meili = get_meili_client()
    if not meili: return
    try:
        meili_docs = [json_serializable({k:v for k,v in art.items() if k!='_id'}) for art in articles]
        index = meili.index("articles")
        await index.update_filterable_attributes(['publish_date', 'website', 'site_categories', 'search_id', 'ai_sentiment_score'])
        await index.update_searchable_attributes(['title', 'summary', 'content', 'site_categories', 'website', 'search_keyword'])
        await index.add_documents(meili_docs, primary_key='article_id')
    except Exception as e:
        print(f"[MEILI ERROR] Sync failed: {e}")

async def crawl_and_process_article(crawler, article_data, content_keyword, website_name, search_keyword, search_id, user_id):
    async with SEMAPHORE:
        if await check_duplicate_with_qdrant(article_data['title'], article_data.get('summary', '')): return None
        try:
            detailed = await crawler.crawl_article_detail(article_data, content_keyword)
            if detailed:
                extracted_tags = detailed.get('tags', [])
                site_categories = detailed.get('site_categories', [])
                
                final_search_keywords = []
                if isinstance(search_keyword, list) and search_keyword:
                    final_search_keywords.extend(search_keyword)
                elif isinstance(search_keyword, str) and search_keyword and search_keyword != "auto_topic":
                    final_search_keywords.append(search_keyword)
                    
                if not final_search_keywords:
                    if extracted_tags:
                        final_search_keywords = extracted_tags
                    elif site_categories:
                        final_search_keywords = site_categories[-2:]
                    else:
                        final_search_keywords = [website_name]

                if 'tags' in detailed:
                    del detailed['tags']

                detailed.update({
                    'website': website_name, 
                    'search_keyword': final_search_keywords, 
                    'current_search_id': search_id, 
                    'user_id': user_id, 
                    'crawled_at': datetime.datetime.now()
                })
                return detailed
        except Exception: pass
        return None

async def _crawl_task_wrapper(crawler, site_name, params, s_date, e_date, s_id, col):
    count = 0; page = 1
    while count < params.max_articles and page <= 50: 
        soup = await crawler.fetch_search_page(params.keyword_search, page, s_date.strftime('%Y-%m-%d'), e_date.strftime('%Y-%m-%d'))
        if not soup: break
        links = crawler.extract_article_links(soup, is_search_page=True)
        if not links: break
        sub_tasks = []
        for link in links:
            if count + len(sub_tasks) >= params.max_articles: break
            sub_tasks.append(crawl_and_process_article(crawler, link, params.keyword_content, site_name, params.keyword_search, s_id, params.user_id))
        if not sub_tasks: break
        res = await asyncio.gather(*sub_tasks)
        valid_articles = [r for r in res if r]
        if valid_articles:
            ops = []
            current_search_id = s_id
            for d in valid_articles:
                current_search_id = d.pop('current_search_id', s_id)
                update_query = {'$set': d, '$addToSet': {'search_id': current_search_id}}
                ops.append(UpdateOne({'url': d['url']}, update_query, upsert=True))
            if ops: await col.bulk_write(ops, ordered=False)
            
            for d in valid_articles: d['search_id'] = [current_search_id]
            await sync_to_meilisearch(valid_articles)
            
            count += len(valid_articles)
        page += 1
        await asyncio.sleep(1)
    return count

async def execute_crawl_task(crawlers_map, params, search_id):
    articles_col = get_articles_collection()
    start_dt = datetime.datetime.strptime(params.start_date, '%d/%m/%Y')
    end_dt = datetime.datetime.strptime(params.end_date, '%d/%m/%Y')
    tasks = []
    
    browser_headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
    }
    
    async with httpx.AsyncClient(headers=browser_headers, timeout=60.0, follow_redirects=True) as client:
        for name, crawler in crawlers_map.items():
            crawler.client = client
            tasks.append(_crawl_task_wrapper(crawler, name, params, start_dt, end_dt, search_id, articles_col))
        results = await asyncio.gather(*tasks)
        return sum(results)

async def perform_hybrid_search(params, crawlers_map, search_id) -> Tuple[int, str, Optional[Callable]]:
    meili = get_meili_client()
    qdrant = get_qdrant_client()
    embed_service = get_embedding_service()
    
    start_dt = datetime.datetime.strptime(params.start_date, '%d/%m/%Y')
    end_dt = datetime.datetime.strptime(params.end_date, '%d/%m/%Y')
    
    async def search_lexical():
        hits = []
        if meili:
            try:
                s_str = start_dt.strftime('%Y-%m-%d'); e_str = end_dt.strftime('%Y-%m-%d')
                conditions = [f"publish_date >= '{s_str}'", f"publish_date <= '{e_str}'"]
                if params.websites and len(params.websites) > 0:
                    site_filters = [f"website = '{site}'" for site in params.websites]
                    conditions.append(f"({' OR '.join(site_filters)})")
                filter_query = " AND ".join(conditions)
                
                search_params = { "filter": filter_query, "limit": params.max_articles + 20 }
                res = await meili.index("articles").search(params.keyword_search, **search_params)
                raw_hits = res.hits
                
                if params.keyword_content:
                    kw_content_lower = params.keyword_content.lower()
                    hits = []
                    for h in raw_hits:
                        content_body = (h.get('content') or "").lower()
                        summary_body = (h.get('summary') or "").lower()
                        if kw_content_lower in content_body or kw_content_lower in summary_body:
                            hits.append(h)
                else: hits = raw_hits
            except Exception as e: print(f"[MEILI SEARCH ERROR] {e}")
        return hits

    async def search_semantic():
        hits = []
        if qdrant and embed_service:
            try:
                q_filter_conditions = []
                if params.websites and len(params.websites) > 0:
                    q_filter_conditions.append(FieldCondition(key="website", match=MatchAny(any=params.websites)))
                q_filter = Filter(must=q_filter_conditions) if q_filter_conditions else None
                
                vector = await embed_service.get_embedding_async(params.keyword_search)
                if vector:
                    q_res = await qdrant_search_wrapper(qdrant, collection_name=QDRANT_COLLECTION, query_vector=vector, query_filter=q_filter, limit=params.max_articles + 20, score_threshold=0.55, with_payload=True)
                    
                    kw_content_lower = params.keyword_content.lower() if params.keyword_content else ""
                    for hit in q_res:
                        p = hit.payload
                        if kw_content_lower:
                            text_check = (p.get('text') or "").lower()
                            summary_check = ""
                            if isinstance(p.get('summary_text'), list): summary_check = " ".join(p.get('summary_text')).lower()
                            elif isinstance(p.get('summary_text'), str): summary_check = (p.get('summary_text') or "").lower()
                            if kw_content_lower not in text_check and kw_content_lower not in summary_check: continue

                        pub_date_str = p.get('publish_date')
                        if pub_date_str:
                            try:
                                p_date = datetime.datetime.fromisoformat(pub_date_str)
                                if start_dt <= p_date <= end_dt + datetime.timedelta(days=1):
                                    hits.append({'article_id': p.get('article_id'), 'url': p.get('url'), 'publish_date': pub_date_str})
                            except: pass
            except Exception as e: print(f"[QDRANT SEARCH ERROR] {e}")
        return hits

    print(f"[HYBRID] Checking availability for '{params.keyword_search}'...")
    lexical_results, semantic_results = await asyncio.gather(search_lexical(), search_semantic())
    
    combined_results = []
    seen_urls = set()
    for item in lexical_results + semantic_results:
        url = item.get('url')
        if url and url not in seen_urls: combined_results.append(item); seen_urls.add(url)

    def parse_date_sort(item):
        d = item.get('publish_date')
        if not d: return datetime.datetime.min
        try: return datetime.datetime.fromisoformat(str(d))
        except: return datetime.datetime.min
    combined_results.sort(key=parse_date_sort, reverse=True)

    if len(combined_results) > params.max_articles:
        combined_results = combined_results[:params.max_articles]

    if combined_results:
        ids = [i.get('article_id') for i in combined_results if i.get('article_id')]
        await update_search_id_for_existing_articles(ids, search_id)

    total_found_in_db = len(combined_results)
    print(f"[HYBRID] DB has {total_found_in_db} items (Strict Limit). Requested Max: {params.max_articles}")

    if total_found_in_db >= params.max_articles:
        return total_found_in_db, "completed", None
    
    else:
        missing_count = params.max_articles - total_found_in_db
        new_end_date = params.end_date
        
        try: crawl_params = params.model_copy(update={'max_articles': missing_count, 'end_date': new_end_date})
        except: 
            crawl_params = copy.deepcopy(params)
            crawl_params.max_articles = missing_count
            crawl_params.end_date = new_end_date

        async def background_crawl_and_update():
            print(f"[BACKGROUND] Starting crawl for {missing_count} items...")
            new_count = await execute_crawl_task(crawlers_map, crawl_params, search_id)
            final_total = total_found_in_db + new_count
            
            history_col = get_history_collection()
            await history_col.update_one(
                {'search_id': search_id},
                {'$set': {'status': 'completed', 'total_saved': final_total, 'updated_at': datetime.datetime.now()}}
            )
            print(f"[BACKGROUND] Finished. Total: {final_total}")

        return total_found_in_db, "processing", background_crawl_and_update

async def update_search_id_for_existing_articles(article_ids: List[str], new_search_id: str):
    if not article_ids: return
    
    articles_col = get_articles_collection()
    qdrant = get_qdrant_client()
    
    try: 
        await articles_col.update_many(
            {'article_id': {'$in': article_ids}}, 
            {'$addToSet': {'search_id': new_search_id}}
        )
    except Exception as e:
        print(f"[MONGO UPDATE ERR] {e}")

    if qdrant:
        try:
            filter_condition = Filter(
                must=[FieldCondition(key="article_id", match=MatchAny(any=article_ids))]
            )
            
            points_res = await qdrant.scroll(
                collection_name=QDRANT_COLLECTION,
                scroll_filter=filter_condition,
                limit=1000, 
                with_payload=True
            )
            
            points, _ = points_res
            
            for p in points:
                current_payload = p.payload
                current_search_ids = current_payload.get('search_id', [])
                
                if isinstance(current_search_ids, str): current_search_ids = [current_search_ids]
                if not isinstance(current_search_ids, list): current_search_ids = []
                
                if new_search_id not in current_search_ids:
                    current_search_ids.append(new_search_id)
                    
                    await qdrant.set_payload(
                        collection_name=QDRANT_COLLECTION,
                        payload={'search_id': current_search_ids},
                        points=[p.id]
                    )
            
            print(f"[QDRANT] Updated search_id for {len(points)} points.")
            
        except Exception as e:
            print(f"[QDRANT UPDATE ERR] {e}")

async def save_and_clean_history(history_col, articles_col, search_id, user_id, s_kw, kw_c, max_art, total_saved, total_matched, time_range, status):
    doc = {
        'search_id': search_id, 'user_id': user_id, 'timestamp': datetime.datetime.now(), 
        'keyword_search': s_kw, 'keyword_content': kw_c,
        'max_articles_requested': max_art, 'total_saved': total_saved, 
        'time_range': time_range, 'status': status, 'data_cleared': False 
    }
    await history_col.insert_one(doc)
    cnt = await history_col.count_documents({'user_id': user_id})
    if cnt > HISTORY_LIMIT:
        del_count = cnt - HISTORY_LIMIT
        cursor = history_col.find({'user_id': user_id}).sort("timestamp", 1).limit(del_count)
        old_docs = await cursor.to_list(del_count)
        search_ids_to_clear = [d['search_id'] for d in old_docs if 'search_id' in d]
        history_ids_to_update = [d['_id'] for d in old_docs]
        if search_ids_to_clear:
            await articles_col.update_many({'search_id': {'$in': search_ids_to_clear}}, {'$pull': {'search_id': {'$in': search_ids_to_clear}}})
            await articles_col.delete_many({'search_id': {'$size': 0}})
            await history_col.update_many({'_id': {'$in': history_ids_to_update}}, {'$set': {'data_cleared': True}})