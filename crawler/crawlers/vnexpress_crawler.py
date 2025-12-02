import httpx
from bs4 import BeautifulSoup
from typing import List, Dict, Optional
from urllib.parse import urlparse
import datetime
import uuid
import re 
from .base_crawler import BaseCrawler
from utils import parse_vietnamese_date

class VnExpressCrawler(BaseCrawler):
    
    def __init__(self, client):
        super().__init__(client)
        self.base_url = "https://vnexpress.net"
        self.search_url_base = "https://timkiem.vnexpress.net/"

    async def fetch_search_page(self, keyword: str, page: int, start_date_iso: str, end_date_iso: str) -> Optional[BeautifulSoup]:
        try:
            start_dt = datetime.datetime.strptime(start_date_iso, '%Y-%m-%d')
            end_dt = datetime.datetime.strptime(end_date_iso, '%Y-%m-%d').replace(hour=23, minute=59)
            
            # Tham số chuẩn
            params = {
                'search_f': 'title,tag_list', 
                'q': keyword, 
                'media_type': 'all', 
                'fromdate': int(start_dt.timestamp()), 
                'todate': int(end_dt.timestamp()), 
                'page': page,
                'date_format': 'all',
                'latest': ''
            }
            resp = await self.client.get(self.search_url_base, params=params)
            return BeautifulSoup(resp.text, 'html.parser')
        except: return None

    async def fetch_category_page(self, category_url: str, page: int) -> Optional[BeautifulSoup]:
        if page > 1: url = f"{category_url}-p{page}"
        else: url = category_url
        try:
            resp = await self.client.get(url)
            return BeautifulSoup(resp.text, 'html.parser')
        except: return None

    def extract_article_links(self, soup: BeautifulSoup, is_search_page: bool = True) -> List[Dict]:
        articles = []
        if is_search_page: items = soup.select('article.item-news.item-news-common')
        else: items = soup.select('article.item-news')
        
        for item in items:
            try:
                article_url = item.get('data-url')
                a_tag = item.select_one('h3.title-news a')
                
                if not a_tag and not article_url: continue
                url = a_tag.get('href') if a_tag else article_url
                
                if url and not url.startswith('http'):
                    url = self.base_url + url

                title = ""
                if a_tag:
                    title = a_tag.get('title') or a_tag.text.strip()
                
                ts = item.get('data-publishtime')
                pub_date = datetime.datetime.fromtimestamp(int(ts)) if ts else None
                
                if url:
                    articles.append({'url': url, 'title': title, 'publish_date': pub_date})
            except: continue
        return articles

    async def crawl_article_detail(self, article_data: Dict, content_keyword: Optional[str]) -> Optional[Dict]:
        url = article_data['url']
        try:
            resp = await self.client.get(url)
            # Nếu là video player và không có nội dung text thì bỏ qua
            if "Video Player" in resp.text and "fck_detail" not in resp.text: return None
            
            soup = BeautifulSoup(resp.text, 'html.parser')
            
            # 1. Title
            title_tag = soup.select_one('h2.title') or soup.select_one('h1.title-detail') or soup.select_one('h1.title-news')
            if title_tag:
                article_data['title'] = title_tag.text.strip()

            # 2. Description (Sapo)
            sapo = soup.select_one('p.description').text.strip() if soup.select_one('p.description') else ""
            
            # 3. Content
            content_div = soup.select_one('article.fck_detail')
            
            content = ""
            if content_div:
                paragraphs = content_div.select('p.Normal')
                if not paragraphs:
                    paragraphs = content_div.select('p')
                content = "\n".join([p.text.strip() for p in paragraphs])
                if not content:
                    content = content_div.text.strip()
            else:
                content = "\n".join([p.text.strip() for p in soup.select('p.Normal')])

            if not content: return None

            # [LOGIC MỚI] Làm sạch Content: Xóa dòng trống thừa
            content = "\n".join([line.strip() for line in content.splitlines() if line.strip()])

            if content_keyword and content_keyword.lower() not in content.lower(): return None
            
            # 4. Date
            date_tag = soup.select_one('span.date')
            if date_tag:
                pd = parse_vietnamese_date(date_tag.text.strip())
                if pd: article_data['publish_date'] = pd

            # 5. Categories
            cats = [a.text for a in soup.select('ul.breadcrumb li a') if "VnExpress" not in a.text]

            # 6. Tags
            tags = []
            scripts = soup.find_all('script')
            for script in scripts:
                if script.string and 'articleTags' in script.string:
                    match = re.search(r"['\"]articleTags['\"]\s*:\s*['\"]([^'\"]+)['\"]", script.string)
                    if match:
                        tag_str = match.group(1)
                        tags = [t.strip() for t in tag_str.split(',') if t.strip()]
                        break
            
            if not tags:
                meta_kw = soup.select_one('meta[name="keywords"]')
                if meta_kw and meta_kw.get('content'):
                    raw_tags = meta_kw.get('content').split(',')
                    tags = [t.strip() for t in raw_tags if t.strip()]
            
            if not tags:
                meta_news_kw = soup.select_one('meta[name="news_keywords"]')
                if meta_news_kw and meta_news_kw.get('content'):
                    tags = [t.strip() for t in meta_news_kw.get('content').split(',') if t.strip()]

            if not tags:
                tag_items = soup.select('.tags .item-tag a, .tag-list a')
                for tag in tag_items:
                    tag_text = tag.get('title') or tag.text.strip()
                    if tag_text:
                        tags.append(tag_text)
            
            article_id = str(uuid.uuid4())
            article_data.update({
                'article_id': article_id, 
                'summary': sapo, 
                'content': content,
                'site_categories': cats,
                'tags': tags,
                'status': 'raw',
                'crawled_at': datetime.datetime.now()
            })
            return article_data
        except: return None


# import httpx
# from bs4 import BeautifulSoup
# from typing import List, Dict, Optional
# from urllib.parse import urlparse
# import datetime
# import uuid
# import re # [NEW] Import Regex
# from .base_crawler import BaseCrawler
# from utils import parse_vietnamese_date

# class VnExpressCrawler(BaseCrawler):
    
#     def __init__(self, client):
#         super().__init__(client)
#         self.base_url = "https://vnexpress.net"
#         self.search_url_base = "https://timkiem.vnexpress.net/"

#     async def fetch_search_page(self, keyword: str, page: int, start_date_iso: str, end_date_iso: str) -> Optional[BeautifulSoup]:
#         try:
#             start_dt = datetime.datetime.strptime(start_date_iso, '%Y-%m-%d')
#             end_dt = datetime.datetime.strptime(end_date_iso, '%Y-%m-%d').replace(hour=23, minute=59)
            
#             # Tham số chuẩn
#             params = {
#                 'search_f': 'title,tag_list', 
#                 'q': keyword, 
#                 'media_type': 'all', 
#                 'fromdate': int(start_dt.timestamp()), 
#                 'todate': int(end_dt.timestamp()), 
#                 'page': page,
#                 'date_format': 'all',
#                 'latest': ''
#             }
#             resp = await self.client.get(self.search_url_base, params=params)
#             return BeautifulSoup(resp.text, 'html.parser')
#         except: return None

#     async def fetch_category_page(self, category_url: str, page: int) -> Optional[BeautifulSoup]:
#         if page > 1: url = f"{category_url}-p{page}"
#         else: url = category_url
#         try:
#             resp = await self.client.get(url)
#             return BeautifulSoup(resp.text, 'html.parser')
#         except: return None

#     def extract_article_links(self, soup: BeautifulSoup, is_search_page: bool = True) -> List[Dict]:
#         articles = []
#         if is_search_page: items = soup.select('article.item-news.item-news-common')
#         else: items = soup.select('article.item-news')
        
#         for item in items:
#             try:
#                 article_url = item.get('data-url')
#                 a_tag = item.select_one('h3.title-news a')
                
#                 if not a_tag and not article_url: continue
#                 url = a_tag.get('href') if a_tag else article_url
                
#                 if url and not url.startswith('http'):
#                     url = self.base_url + url

#                 title = ""
#                 if a_tag:
#                     title = a_tag.get('title') or a_tag.text.strip()
                
#                 ts = item.get('data-publishtime')
#                 pub_date = datetime.datetime.fromtimestamp(int(ts)) if ts else None
                
#                 if url:
#                     articles.append({'url': url, 'title': title, 'publish_date': pub_date})
#             except: continue
#         return articles

#     async def crawl_article_detail(self, article_data: Dict, content_keyword: Optional[str]) -> Optional[Dict]:
#         url = article_data['url']
#         try:
#             resp = await self.client.get(url)
#             # Nếu là video player và không có nội dung text thì bỏ qua
#             if "Video Player" in resp.text and "fck_detail" not in resp.text: return None
            
#             soup = BeautifulSoup(resp.text, 'html.parser')
            
#             # 1. Title
#             title_tag = soup.select_one('h2.title') or soup.select_one('h1.title-detail') or soup.select_one('h1.title-news')
#             if title_tag:
#                 article_data['title'] = title_tag.text.strip()

#             # 2. Description (Sapo)
#             sapo = soup.select_one('p.description').text.strip() if soup.select_one('p.description') else ""
            
#             # 3. Content
#             content_div = soup.select_one('article.fck_detail')
            
#             content = ""
#             if content_div:
#                 paragraphs = content_div.select('p.Normal')
#                 if not paragraphs:
#                     paragraphs = content_div.select('p')
#                 content = "\n".join([p.text.strip() for p in paragraphs])
#                 if not content:
#                     content = content_div.text.strip()
#             else:
#                 content = "\n".join([p.text.strip() for p in soup.select('p.Normal')])

#             if not content: return None

#             if content_keyword and content_keyword.lower() not in content.lower(): return None
            
#             # 4. Date
#             date_tag = soup.select_one('span.date')
#             if date_tag:
#                 pd = parse_vietnamese_date(date_tag.text.strip())
#                 if pd: article_data['publish_date'] = pd

#             # 5. Categories
#             cats = [a.text for a in soup.select('ul.breadcrumb li a') if "VnExpress" not in a.text]

#             # 6. Tags (Keywords) [UPDATED LOGIC]
#             tags = []

#             # Cách 0: [NEW] Lấy từ dataLayer trong thẻ <script>
#             # dataLayer.push({'articleTags':'tag1, tag2,...'})
#             scripts = soup.find_all('script')
#             for script in scripts:
#                 if script.string and 'articleTags' in script.string:
#                     # Regex tìm key 'articleTags' và value của nó
#                     match = re.search(r"['\"]articleTags['\"]\s*:\s*['\"]([^'\"]+)['\"]", script.string)
#                     if match:
#                         tag_str = match.group(1)
#                         tags = [t.strip() for t in tag_str.split(',') if t.strip()]
#                         break
            
#             # Cách 1: Fallback lấy từ <meta name="keywords" content="...">
#             if not tags:
#                 meta_kw = soup.select_one('meta[name="keywords"]')
#                 if meta_kw and meta_kw.get('content'):
#                     raw_tags = meta_kw.get('content').split(',')
#                     tags = [t.strip() for t in raw_tags if t.strip()]
            
#             # Cách 2: Fallback lấy từ <meta name="news_keywords">
#             if not tags:
#                 meta_news_kw = soup.select_one('meta[name="news_keywords"]')
#                 if meta_news_kw and meta_news_kw.get('content'):
#                     tags = [t.strip() for t in meta_news_kw.get('content').split(',') if t.strip()]

#             # Cách 3: Fallback DOM cũ
#             if not tags:
#                 tag_items = soup.select('.tags .item-tag a, .tag-list a')
#                 for tag in tag_items:
#                     tag_text = tag.get('title') or tag.text.strip()
#                     if tag_text:
#                         tags.append(tag_text)
            
#             article_id = str(uuid.uuid4())
#             article_data.update({
#                 'article_id': article_id, 
#                 'summary': sapo, 
#                 'content': content,
#                 'site_categories': cats,
#                 'tags': tags,
#                 'status': 'raw',
#                 'crawled_at': datetime.datetime.now()
#             })
#             return article_data
#         except: return None