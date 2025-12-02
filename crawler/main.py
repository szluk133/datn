from fastapi import FastAPI, HTTPException, Query, Depends, Path, Body, BackgroundTasks
import uvicorn
import sys
import asyncio
import motor.motor_asyncio
from contextlib import asynccontextmanager
import datetime
from bs4 import BeautifulSoup
import httpx
from typing import Optional, List

from schemas import CrawlParams, ScheduleConfig
from database import (
    connect_to_mongo, close_connections, connect_external_services,
    get_articles_collection, get_history_collection, get_topics_collection
)
from config import HEADERS, REQUEST_TIMEOUT, RETRY_COUNT
from crawlers import CRAWLER_REGISTRY
from services.crawler_service import perform_hybrid_search, save_and_clean_history, search_relevant_articles_for_chat
from services.scheduler_service import start_scheduler, execute_topic_crawl, reschedule_topic_crawl

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("--- [LIFESPAN] STARTING ---")
    await connect_to_mongo()
    await connect_external_services() 
    start_scheduler()
    yield
    print("--- [LIFESPAN] SHUTTING DOWN ---")
    await close_connections()

app = FastAPI(title="Crawler API v4.0 (Hybrid & Intelligent)", version="4.0.0", lifespan=lifespan)

# ... (Giữ nguyên các endpoint health_check, chatbot, admin ...)
@app.get("/", summary="Trạng thái API")
async def health_check():
    return {"status": "running", "features": ["Hybrid Search", "Auto Topic Crawl", "Vector Search", "Chatbot RAG"]}

@app.post("/chatbot/retrieve-context", summary="Lấy thông tin ngữ cảnh cho Chatbot (RAG)")
async def retrieve_context(
    question: str = Body(..., embed=True),
    user_id: Optional[str] = Body(None, embed=True),
    top_k: int = Body(3, embed=True)
):
    if not question: raise HTTPException(400, "Câu hỏi trống")
    results = await search_relevant_articles_for_chat(question, top_k, user_id)
    return {"status": "success", "query": question, "context_count": len(results), "contexts": results}

@app.post("/topics/init-from-html", summary="Init Topic & Trigger Crawl")
async def init_topics(
    background_tasks: BackgroundTasks, 
    website: str = Query(..., description="vneconomy.vn hoặc vnexpress.net"),
    collection = Depends(get_topics_collection)
):
    target_url = ""
    if website == "vneconomy.vn": target_url = "https://vneconomy.vn"
    elif website == "vnexpress.net": target_url = "https://vnexpress.net"
    else: raise HTTPException(400, "Website chưa được hỗ trợ.")

    try:
        async with httpx.AsyncClient(headers=HEADERS, timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(target_url)
            html_content = resp.text
    except Exception as e: raise HTTPException(500, f"Lỗi truy cập: {e}")

    soup = BeautifulSoup(html_content, 'html.parser')
    topics = []
    seen_urls = set()

    if website == "vneconomy.vn":
        items = soup.select('.list-menu-header li a')
        if not items: items = soup.select('li a')
        for item in items:
            href = item.get('href'); title = item.get('title') or item.text.strip()
            if title and "Tiêu điểm" in title: continue
            if href and title and len(title) > 2:
                if not href.startswith('http'): href = "https://vneconomy.vn" + href if href.startswith('/') else "https://vneconomy.vn/" + href
                if ".htm" in href and href not in seen_urls and len(href.split('/')) <= 5:
                    topics.append({'name': title.strip(), 'url': href, 'website': website}); seen_urls.add(href)
    elif website == "vnexpress.net":
        items = soup.select('a[data-medium^="Menu-"], .ul-nav-folder a, nav a')
        for item in items:
            href = item.get('href'); title = item.get('title') or item.text.strip()
            if href and title and len(title) > 2:
                if not href.startswith('http'): href = "https://vnexpress.net" + href if href.startswith('/') else "https://vnexpress.net/" + href
                if href in seen_urls: continue
                if ".html" not in href and "video" not in href and "podcast" not in href:
                    topics.append({'name': title.strip(), 'url': href, 'website': website}); seen_urls.add(href)

    count = 0
    for t in topics:
        res = await collection.update_one({'url': t['url']}, {'$set': {**t, 'is_active': True, 'last_scanned_at': datetime.datetime.now()}}, upsert=True)
        if res.upserted_id: count += 1

    if len(topics) > 0: background_tasks.add_task(execute_topic_crawl, website)
    return {"status": "success", "website": website, "message": f"Init {len(topics)} topics. Crawling background...", "added_new": count}

@app.post("/admin/trigger-auto-crawl", summary="Kích hoạt Auto-Crawl")
async def trigger_auto_crawl(background_tasks: BackgroundTasks, website: Optional[str] = Query(None)):
    background_tasks.add_task(execute_topic_crawl, website)
    return {"status": "triggered", "target": website or "ALL"}

@app.post("/admin/auto-crawl/{website}", summary="Kích hoạt Auto-Crawl theo Website cụ thể")
async def trigger_specific_site_crawl(
    background_tasks: BackgroundTasks,
    website: str = Path(..., description="Chọn: vnexpress.net hoặc vneconomy.vn")
):
    """
    Kích hoạt crawl tự động CHỈ cho website được chỉ định trên URL.
    """
    allowed_sites = ["vnexpress.net", "vneconomy.vn"]
    if website not in allowed_sites:
        raise HTTPException(status_code=400, detail=f"Website '{website}' không hợp lệ. Chỉ hỗ trợ: {allowed_sites}")
    
    # Gọi hàm execute_topic_crawl với filter là website cụ thể
    background_tasks.add_task(execute_topic_crawl, website)
    
    return {
        "status": "triggered", 
        "target": website,
        "message": f"Đã bắt đầu tiến trình crawl tự động cho {website}."
    }
@app.post("/admin/schedule", summary="Cập nhật tần suất Auto-Crawl")
async def update_schedule(config: ScheduleConfig):
    success = reschedule_topic_crawl(config.minutes)
    if not success: raise HTTPException(status_code=500, detail="Lỗi cập nhật lịch.")
    return {"status": "success", "message": f"Đã cập nhật lịch chạy mỗi {config.minutes} phút."}

# --- CRAWL ENDPOINTS ---
@app.post("/crawl", summary="Start Crawl Process (Async)")
async def start_crawl(
    params: CrawlParams, 
    background_tasks: BackgroundTasks,
    articles_col = Depends(get_articles_collection), 
    history_col = Depends(get_history_collection)
):
    """
    Trả về NGAY LẬP TỨC dữ liệu có sẵn.
    Nếu thiếu, sẽ chạy ngầm và cập nhật status trong DB.
    """
    search_id = datetime.datetime.now().strftime("%Y%m%d%H%M%S") + f"_{params.user_id}"
    crawlers_map = {}
    sites = params.websites if params.websites else ["vneconomy.vn", "vnexpress.net"]
    for name in sites:
        if name == "vneconomy.vn": crawlers_map[name] = CRAWLER_REGISTRY["vneconomy.vn"](None)
        elif name == "vnexpress.net": crawlers_map[name] = CRAWLER_REGISTRY["vnexpress.net"](None)
    
    # Hàm này trả về ngay số lượng hiện có, status, và hàm task (nếu cần chạy ngầm)
    total_existing, status, bg_task_func = await perform_hybrid_search(params, crawlers_map, search_id)
    
    # 1. Nếu có task cần chạy ngầm (do thiếu bài), đưa vào BackgroundTasks của FastAPI
    if bg_task_func:
        background_tasks.add_task(bg_task_func)
        
    # 2. Lưu trạng thái ban đầu vào History
    await save_and_clean_history(
        history_col, articles_col, search_id, params.user_id, 
        params.keyword_search, params.keyword_content, params.max_articles, 
        0, total_existing, f"{params.start_date}-{params.end_date}", status
    )
    
    # 3. Trả về ngay lập tức
    return {
        "status": status, # 'completed' (đã đủ) hoặc 'processing' (đang chạy thêm)
        "search_id": search_id,
        "meta": {
            "total_available_now": total_existing, # Số lượng có thể query NGAY BÂY GIỜ
            "page": params.page,
            "page_size": params.page_size
        },
        "instruction": "Use GET /crawl/status/{search_id} to check updates if status is 'processing'."
    }

@app.get("/crawl/status/{search_id}", summary="Check Crawl Status")
async def check_crawl_status(
    search_id: str, 
    history_collection = Depends(get_history_collection)
):
    """
    Backend gọi API này để kiểm tra xem việc crawl bù đã xong chưa.
    """
    record = await history_collection.find_one({'search_id': search_id})
    if not record:
        raise HTTPException(404, "Search ID not found")
    
    return {
        "search_id": search_id,
        "status": record.get("status", "unknown"), # 'processing' hoặc 'completed'
        "total_saved": record.get("total_saved", 0), # Tổng số bài cuối cùng
        "updated_at": record.get("updated_at")
    }

@app.get("/history")
async def get_history(user_id: str, history_collection = Depends(get_history_collection)):
    try:
        docs = await history_collection.find({'user_id': user_id}, {'_id': 0}).sort("timestamp", -1).limit(10).to_list(10)
        return {"status": "success", "history": docs}
    except Exception as e: raise HTTPException(500, str(e))

@app.get("/history/{search_id}/articles", summary="Get Articles (Pagination)")
async def get_history_articles(
    search_id: str, 
    user_id: str, 
    page: int = Query(1, gt=0),
    page_size: int = Query(10, gt=0),
    articles_collection = Depends(get_articles_collection), 
    history_collection = Depends(get_history_collection)
):
    try:
        if not await history_collection.find_one({'search_id': search_id, 'user_id': user_id}): 
            raise HTTPException(404, "Not found")
            
        skip = (page - 1) * page_size
        total = await articles_collection.count_documents({'search_id': search_id})
        cursor = articles_collection.find({'search_id': search_id}, {'_id': 0}).sort("publish_date", -1).skip(skip).limit(page_size)
        docs = await cursor.to_list(None)
        
        return {
            "status": "success", 
            "data": docs,
            "meta": {
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": (total + page_size - 1) // page_size
            }
        }
    except Exception as e: raise HTTPException(500, str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)



# from fastapi import FastAPI, HTTPException, Query, Depends, Path, Body, BackgroundTasks
# import uvicorn
# import sys
# import asyncio
# import motor.motor_asyncio
# from contextlib import asynccontextmanager
# import datetime
# from bs4 import BeautifulSoup
# import httpx
# from typing import Optional, List

# from schemas import CrawlParams, ScheduleConfig
# from database import (
#     connect_to_mongo, close_connections, connect_external_services,
#     get_articles_collection, get_history_collection, get_topics_collection
# )
# from config import HEADERS, REQUEST_TIMEOUT, RETRY_COUNT
# from crawlers import CRAWLER_REGISTRY
# from services.crawler_service import perform_hybrid_search, save_and_clean_history, search_relevant_articles_for_chat
# from services.scheduler_service import start_scheduler, execute_topic_crawl, reschedule_topic_crawl

# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     print("--- [LIFESPAN] STARTING ---")
#     await connect_to_mongo()
#     await connect_external_services() 
#     start_scheduler()
#     yield
#     print("--- [LIFESPAN] SHUTTING DOWN ---")
#     await close_connections()

# app = FastAPI(title="Crawler API v4.0 (Hybrid & Intelligent)", version="4.0.0", lifespan=lifespan)

# @app.get("/", summary="Trạng thái API")
# async def health_check():
#     return {"status": "running", "features": ["Hybrid Search", "Auto Topic Crawl", "Vector Search", "Chatbot RAG"]}

# # --- API CHATBOT (READ ONLY) ---
# @app.post("/chatbot/retrieve-context", summary="Lấy thông tin ngữ cảnh cho Chatbot (RAG)")
# async def retrieve_context(
#     question: str = Body(..., embed=True),
#     user_id: Optional[str] = Body(None, embed=True),
#     top_k: int = Body(3, embed=True)
# ):
#     if not question: raise HTTPException(400, "Câu hỏi trống")
#     results = await search_relevant_articles_for_chat(question, top_k, user_id)
#     return {"status": "success", "query": question, "context_count": len(results), "contexts": results}

# # --- ADMIN & CRAWL APIs ---
# @app.post("/topics/init-from-html", summary="Init Topic & Trigger Crawl")
# async def init_topics(
#     background_tasks: BackgroundTasks, 
#     website: str = Query(..., description="vneconomy.vn hoặc vnexpress.net"),
#     collection = Depends(get_topics_collection)
# ):
#     target_url = ""
#     if website == "vneconomy.vn": target_url = "https://vneconomy.vn"
#     elif website == "vnexpress.net": target_url = "https://vnexpress.net"
#     else: raise HTTPException(400, "Website chưa được hỗ trợ.")

#     try:
#         async with httpx.AsyncClient(headers=HEADERS, timeout=15.0, follow_redirects=True) as client:
#             resp = await client.get(target_url)
#             html_content = resp.text
#     except Exception as e: raise HTTPException(500, f"Lỗi truy cập: {e}")

#     soup = BeautifulSoup(html_content, 'html.parser')
#     topics = []
#     seen_urls = set()

#     if website == "vneconomy.vn":
#         items = soup.select('.list-menu-header li a')
#         if not items: items = soup.select('li a')
#         for item in items:
#             href = item.get('href'); title = item.get('title') or item.text.strip()
#             if title and "Tiêu điểm" in title: continue
#             if href and title and len(title) > 2:
#                 if not href.startswith('http'): href = "https://vneconomy.vn" + href if href.startswith('/') else "https://vneconomy.vn/" + href
#                 if ".htm" in href and href not in seen_urls and len(href.split('/')) <= 5:
#                     topics.append({'name': title.strip(), 'url': href, 'website': website}); seen_urls.add(href)
#     elif website == "vnexpress.net":
#         items = soup.select('a[data-medium^="Menu-"], .ul-nav-folder a, nav a')
#         for item in items:
#             href = item.get('href'); title = item.get('title') or item.text.strip()
#             if href and title and len(title) > 2:
#                 if not href.startswith('http'): href = "https://vnexpress.net" + href if href.startswith('/') else "https://vnexpress.net/" + href
#                 if href in seen_urls: continue
#                 if ".html" not in href and "video" not in href and "podcast" not in href:
#                     topics.append({'name': title.strip(), 'url': href, 'website': website}); seen_urls.add(href)

#     count = 0
#     for t in topics:
#         res = await collection.update_one({'url': t['url']}, {'$set': {**t, 'is_active': True, 'last_scanned_at': datetime.datetime.now()}}, upsert=True)
#         if res.upserted_id: count += 1

#     if len(topics) > 0: background_tasks.add_task(execute_topic_crawl, website)
#     return {"status": "success", "website": website, "message": f"Init {len(topics)} topics. Crawling background...", "added_new": count}

# @app.post("/admin/trigger-auto-crawl", summary="Kích hoạt Auto-Crawl")
# async def trigger_auto_crawl(background_tasks: BackgroundTasks, website: Optional[str] = Query(None)):
#     background_tasks.add_task(execute_topic_crawl, website)
#     return {"status": "triggered", "target": website or "ALL"}

# @app.post("/admin/schedule", summary="Cập nhật tần suất Auto-Crawl")
# async def update_schedule(config: ScheduleConfig):
#     success = reschedule_topic_crawl(config.minutes)
#     if not success: raise HTTPException(status_code=500, detail="Lỗi cập nhật lịch.")
#     return {"status": "success", "message": f"Đã cập nhật lịch chạy mỗi {config.minutes} phút."}

# @app.post("/crawl", summary="Tìm kiếm bài báo (Hybrid - Pagination)")
# async def start_crawl(
#     params: CrawlParams, 
#     background_tasks: BackgroundTasks,
#     articles_col = Depends(get_articles_collection), 
#     history_col = Depends(get_history_collection)
# ):
#     """
#     [UPDATED] API hỗ trợ phân trang chuẩn.
#     Trả về:
#     - data: Danh sách 10 bài của trang hiện tại.
#     - meta: Thông tin phân trang (total, page, page_size).
#     """
#     search_id = datetime.datetime.now().strftime("%Y%m%d%H%M%S") + f"_{params.user_id}"
#     crawlers_map = {}
#     sites = params.websites if params.websites else ["vneconomy.vn", "vnexpress.net"]
#     for name in sites:
#         if name == "vneconomy.vn": crawlers_map[name] = CRAWLER_REGISTRY["vneconomy.vn"](None)
#         elif name == "vnexpress.net": crawlers_map[name] = CRAWLER_REGISTRY["vnexpress.net"](None)
    
#     # 1. Gọi Service (Service đã xử lý logic Cắt Lát & Crawl Bù)
#     total_found, status, page_results, bg_task = await perform_hybrid_search(params, crawlers_map, search_id)
    
#     # 2. Xử lý Background Task (Nếu có crawl bù)
#     if bg_task:
#         background_tasks.add_task(bg_task)
        
#     # 3. Lưu lịch sử
#     # Lưu ý: total_saved trong lịch sử nên là tổng số bài tìm thấy (total_found) chứ không phải số bài của trang (10)
#     await save_and_clean_history(
#         history_col, articles_col, search_id, params.user_id, 
#         params.keyword_search, params.keyword_content, params.max_articles, 
#         len(page_results), total_found, f"{params.start_date}-{params.end_date}", status
#     )
    
#     # 4. Trả về cấu trúc chuẩn cho Frontend/NestJS
#     return {
#         "status": status,
#         "search_id": search_id,
#         "data": page_results,  # Chỉ chứa 10 bài (hoặc page_size)
#         "meta": {
#             "total": total_found,    # Tổng số bài có thể tìm thấy (ví dụ 50)
#             "page": params.page,     # Trang hiện tại (ví dụ 1)
#             "page_size": params.page_size, # Kích thước trang (ví dụ 10)
#             "total_pages": (total_found + params.page_size - 1) // params.page_size # Tổng số trang
#         },
#         "message": "Đã tìm thấy dữ liệu." if page_results else "Không tìm thấy bài viết phù hợp."
#     }

# @app.get("/history")
# async def get_history(user_id: str, history_collection = Depends(get_history_collection)):
#     try:
#         docs = await history_collection.find({'user_id': user_id}, {'_id': 0}).sort("timestamp", -1).limit(10).to_list(10)
#         return {"status": "success", "history": docs}
#     except Exception as e: raise HTTPException(500, str(e))

# @app.get("/history/{search_id}/articles", summary="Xem lại lịch sử (Full hoặc Pagination)")
# async def get_history_articles(
#     search_id: str, 
#     user_id: str, 
#     # Hỗ trợ pagination cho cả history nếu cần
#     page: int = Query(1, gt=0),
#     page_size: int = Query(10, gt=0),
#     articles_collection = Depends(get_articles_collection), 
#     history_collection = Depends(get_history_collection)
# ):
#     try:
#         if not await history_collection.find_one({'search_id': search_id, 'user_id': user_id}): 
#             raise HTTPException(404, "Not found")
            
#         # Pagination trong Mongo
#         skip = (page - 1) * page_size
        
#         # Đếm tổng
#         total = await articles_collection.count_documents({'search_id': search_id})
        
#         # Query phân trang
#         cursor = articles_collection.find({'search_id': search_id}, {'_id': 0})\
#             .sort("publish_date", -1)\
#             .skip(skip)\
#             .limit(page_size)
            
#         docs = await cursor.to_list(None)
        
#         return {
#             "status": "success", 
#             "data": docs,
#             "meta": {
#                 "total": total,
#                 "page": page,
#                 "page_size": page_size,
#                 "total_pages": (total + page_size - 1) // page_size
#             }
#         }
#     except Exception as e: raise HTTPException(500, str(e))

# if __name__ == "__main__":
#     uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)