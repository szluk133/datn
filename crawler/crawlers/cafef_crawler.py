import urllib.parse
from bs4 import BeautifulSoup
from typing import List, Dict, Optional
from urllib.parse import urljoin
import datetime
import uuid
import re 
from .base_crawler import BaseCrawler
from utils import parse_vietnamese_date

class CafeFCrawler(BaseCrawler):
    
    def __init__(self, client):
        super().__init__(client)
        self.base_url = "https://cafef.vn"
        # Cache để lưu Zone ID của từng chuyên mục
        self.category_zone_map = {}

    async def fetch_search_page(self, keyword: str, page: int, start_date_iso: str, end_date_iso: str) -> Optional[BeautifulSoup]:
        encoded_keyword = urllib.parse.quote(keyword)
        # URL Search: /tim-kiem/trang-1.chn?keywords=...
        url = f"{self.base_url}/tim-kiem/trang-{page}.chn?keywords={encoded_keyword}"
        
        try:
            resp = await self.client.get(url)
            if resp.status_code != 200:
                print(f"[CAFEF ERR] Search failed: {resp.status_code}")
                return None
            return BeautifulSoup(resp.text, 'html.parser')
        except Exception as e:
            print(f"[CAFEF ERR] Fetch search: {e}")
            return None

    def _extract_zone_id(self, soup: BeautifulSoup) -> Optional[str]:
        """Tìm Zone ID để dùng cho phân trang."""
        # Cách 1: Tìm trong attribute data-cd-key="...zone18835"
        try:
            elements = soup.select('[data-cd-key]')
            for el in elements:
                cd_key = el.get('data-cd-key', '')
                match = re.search(r'zone(\d+)', cd_key)
                if match:
                    return match.group(1)
        except: pass
            
        # Cách 2: Tìm trong script (adm_zoneId = '...')
        try:
            scripts = soup.find_all('script')
            for script in scripts:
                if script.string:
                    # zoneId = '18835'; hoặc adm_zoneId = '18835'
                    match = re.search(r"zoneId\s*=\s*['\"](\d+)['\"]", script.string)
                    if match:
                        return match.group(1)
        except: pass

        return None

    async def fetch_category_page(self, category_url: str, page: int) -> Optional[BeautifulSoup]:
        target_url = ""
        
        if page == 1:
            target_url = category_url
        else:
            zone_id = self.category_zone_map.get(category_url)
            
            if zone_id:
                # [FIX] URL chuẩn cho load more của CafeF
                # Format: https://cafef.vn/timelinelist/18835/2.chn
                target_url = f"{self.base_url}/timelinelist/{zone_id}/{page}.chn"
            else:
                # Fallback: Nếu không có ZoneID, thử đoán URL cũ (thường sẽ fail)
                if ".chn" in category_url:
                    target_url = category_url.replace(".chn", f"/trang-{page}.chn")
                else:
                    target_url = f"{category_url}/trang-{page}.chn"

        try:
            # print(f"[CAFEF DEBUG] Fetching Page {page}: {target_url}") 
            resp = await self.client.get(target_url)
            
            if resp.status_code != 200: 
                print(f"[CAFEF ERR] Category Page {page} failed: {resp.status_code} | URL: {target_url}")
                return None
            
            soup = BeautifulSoup(resp.text, 'html.parser')
            
            # Nếu là trang 1, tìm và lưu Zone ID cho các trang sau
            if page == 1:
                found_zone = self._extract_zone_id(soup)
                if found_zone:
                    print(f"[CAFEF] Detected Zone ID {found_zone} for {category_url}")
                    self.category_zone_map[category_url] = found_zone
            
            return soup
        except Exception as e:
            print(f"[CAFEF ERR] Fetch category {target_url}: {e}")
            return None

    def extract_article_links(self, soup: BeautifulSoup, is_search_page: bool = True) -> List[Dict]:
        articles = []
        seen_links = set()

        if is_search_page:
            # --- TRANG TÌM KIẾM ---
            items = soup.select('.timeline.list-bytags .item')
            for item in items:
                try:
                    title_tag = item.select_one('h3 a') or item.select_one('.box-category-link-title')
                    if not title_tag: continue
                    href = title_tag.get('href')
                    if not href or 'javascript' in href: continue
                    full_url = urljoin(self.base_url, href)
                    if full_url in seen_links: continue
                    title = title_tag.get('title') or title_tag.text.strip()
                    
                    pub_date = None
                    time_tag = item.select_one('.time')
                    if time_tag:
                        title_attr = time_tag.get('title')
                        if title_attr:
                            try: pub_date = datetime.datetime.fromisoformat(title_attr)
                            except: pass
                        if not pub_date:
                            pub_date = parse_vietnamese_date(time_tag.text.strip())
                    articles.append({'url': full_url, 'title': title, 'publish_date': pub_date})
                    seen_links.add(full_url)
                except: continue
        else:
            # --- TRANG CHUYÊN MỤC & TIMELINE LIST ---
            # API timelinelist trả về các thẻ <li> hoặc <div> trực tiếp
            
            # Selector bao quát
            containers = soup.select('.listchungkhoannew .tlitem, .box-category-item, li.knswli, .timeline-item')
            
            # Fallback mạnh cho kết quả trả về từ API (thường không có wrapper class lớn)
            if not containers:
                containers = soup.select('li')
                
            for container in containers:
                try:
                    # Loại bỏ các phần tử rác/quảng cáo
                    if container.get('class') and 'clearfix' in container.get('class') and len(container.get('class')) == 1: continue

                    # 1. Title
                    title_tag = container.select_one('h3 a') or container.select_one('h4 a') or container.select_one('a.title')
                    
                    if not title_tag and container.name == 'li':
                        # Tìm thẻ a đầu tiên có title
                        title_tag = container.find('a', title=True)

                    if not title_tag: continue

                    href = title_tag.get('href')
                    if not href or len(href) < 5 or 'javascript' in href: continue
                    
                    full_url = urljoin(self.base_url, href)
                    if full_url in seen_links: continue

                    title = title_tag.get('title') or title_tag.text.strip()
                    if not title: continue
                    
                    # 2. Date
                    pub_date = None
                    time_tag = container.select_one('.time.time-ago') or container.select_one('.time') or container.select_one('.knswli-time')
                    
                    if time_tag:
                        iso_date = time_tag.get('title')
                        if iso_date:
                            try: pub_date = datetime.datetime.fromisoformat(iso_date)
                            except: pass
                        if not pub_date:
                            pub_date = parse_vietnamese_date(time_tag.text.strip())

                    articles.append({'url': full_url, 'title': title, 'publish_date': pub_date})
                    seen_links.add(full_url)
                except: continue

        return articles

    async def crawl_article_detail(self, article_data: Dict, content_keyword: Optional[str]) -> Optional[Dict]:
        url = article_data['url']
        try:
            resp = await self.client.get(url)
            if resp.status_code != 200: return None
            soup = BeautifulSoup(resp.text, 'html.parser')
            
            # Title
            title_tag = soup.select_one('h1.title')
            if title_tag: article_data['title'] = title_tag.text.strip()

            # Date
            if not article_data.get('publish_date'):
                date_tag = soup.select_one('.pdate')
                if date_tag:
                    raw_date = date_tag.text.strip().replace('|', '').strip() 
                    pd = parse_vietnamese_date(raw_date)
                    if pd: article_data['publish_date'] = pd
            if not article_data.get('publish_date'):
                 article_data['publish_date'] = datetime.datetime.now()

            # Categories
            cats = []
            cat_tag = soup.select_one('a.category-page__name') or soup.select_one('a.cat')
            if cat_tag: cats.append(cat_tag.text.strip())
            
            # Sapo
            sapo_tag = soup.select_one('.sapo')
            sapo_text = sapo_tag.text.strip() if sapo_tag else ""

            # Content
            content_div = soup.select_one('.detail-content.afcbc-body') or soup.select_one('.detail-content')
            content_text = ""
            if content_div:
                for trash in content_div.select('.link-content-footer, .avatar-content, .box-dautu, .related-news, .relate-container'):
                    trash.decompose()
                lines = [p.text.strip() for p in content_div.find_all('p') if p.text.strip()]
                content_text = "\n".join(lines)
            
            if not content_text: return None
            if content_keyword and content_keyword.lower() not in content_text.lower(): return None

            # Tags
            tags = []
            tag_area = soup.select_one('.row2[data-marked-zoneid="cafef_detail_tag"]') or soup.select_one('.tags')
            if tag_area:
                for t in tag_area.select('a'):
                    txt = t.text.strip()
                    if txt: tags.append(txt)

            article_id = str(uuid.uuid5(uuid.NAMESPACE_URL, url))

            article_data.update({
                'article_id': article_id,
                'summary': sapo_text,
                'content': content_text,
                'site_categories': cats,
                'tags': tags,
                'status': 'raw',
                'crawled_at': datetime.datetime.now()
            })
            return article_data

        except Exception as e:
            print(f"[CAFEF ERR] Detail {url}: {e}")
            return None



# import urllib.parse
# from bs4 import BeautifulSoup
# from typing import List, Dict, Optional
# from urllib.parse import urljoin
# import datetime
# import uuid
# import re 
# from .base_crawler import BaseCrawler
# from utils import parse_vietnamese_date

# class CafeFCrawler(BaseCrawler):
    
#     def __init__(self, client):
#         super().__init__(client)
#         self.base_url = "https://cafef.vn"

#     async def fetch_search_page(self, keyword: str, page: int, start_date_iso: str, end_date_iso: str) -> Optional[BeautifulSoup]:
#         # URL mẫu: https://cafef.vn/tim-kiem/trang-1.chn?keywords=lạm%20phát%20cao
#         encoded_keyword = urllib.parse.quote(keyword)
#         url = f"{self.base_url}/tim-kiem/trang-{page}.chn?keywords={encoded_keyword}"
        
#         try:
#             # CafeF thường không cần filter date trên URL search, ta phải lọc sau khi lấy về
#             print(f"[CAFEF] Crawling Search: {url}")
#             resp = await self.client.get(url)
#             if resp.status_code != 200:
#                 print(f"[CAFEF ERR] Search failed: {resp.status_code}")
#                 return None
#             return BeautifulSoup(resp.text, 'html.parser')
#         except Exception as e:
#             print(f"[CAFEF ERR] Fetch search: {e}")
#             return None

#     async def fetch_category_page(self, category_url: str, page: int) -> Optional[BeautifulSoup]:
#         # Logic pagination của CafeF thường là: /tieu-de-chuyen-muc/trang-2.chn
#         if ".chn" in category_url:
#             url = category_url.replace(".chn", f"/trang-{page}.chn")
#         else:
#             # Fallback nếu url không có đuôi .chn (hiếm gặp ở cafef)
#             url = f"{category_url}/trang-{page}.chn"

#         try:
#             resp = await self.client.get(url)
#             if resp.status_code != 200: return None
#             return BeautifulSoup(resp.text, 'html.parser')
#         except: return None

#     def extract_article_links(self, soup: BeautifulSoup, is_search_page: bool = True) -> List[Dict]:
#         articles = []
#         seen_links = set()

#         if is_search_page:
#             # --- XỬ LÝ TRANG TÌM KIẾM ---
#             # Selector: <div class="timeline list-bytags"> -> <div class="item">
#             items = soup.select('.timeline.list-bytags .item')
#             for item in items:
#                 try:
#                     title_tag = item.select_one('h3 a') or item.select_one('.box-category-link-title')
#                     if not title_tag: continue

#                     href = title_tag.get('href')
#                     if not href or 'javascript' in href: continue
                    
#                     full_url = urljoin(self.base_url, href)
#                     if full_url in seen_links: continue

#                     title = title_tag.get('title') or title_tag.text.strip()
                    
#                     # CafeF trang search đôi khi không hiện ngày rõ ràng ở list item,
#                     # hoặc nó nằm trong thẻ <span class="time" title="...">
#                     pub_date = None
#                     time_tag = item.select_one('.time')
#                     if time_tag:
#                         # Ưu tiên lấy attribute title: 2025-12-17T13:45:00
#                         title_attr = time_tag.get('title')
#                         if title_attr:
#                             try: pub_date = datetime.datetime.fromisoformat(title_attr)
#                             except: pass
#                         if not pub_date:
#                             pub_date = parse_vietnamese_date(time_tag.text.strip())

#                     articles.append({
#                         'url': full_url,
#                         'title': title,
#                         'publish_date': pub_date # Có thể là None, sẽ check lại ở detail
#                     })
#                     seen_links.add(full_url)
#                 except: continue
#         else:
#             # --- XỬ LÝ TRANG CHUYÊN MỤC (Auto Crawl) ---
#             # Selector: .listchungkhoannew .tlitem
#             containers = soup.select('.listchungkhoannew .tlitem')
#             for container in containers:
#                 try:
#                     title_tag = container.select_one('h3 a')
#                     if not title_tag: continue

#                     href = title_tag.get('href')
#                     if not href: continue
                    
#                     full_url = urljoin(self.base_url, href)
#                     if full_url in seen_links: continue

#                     title = title_tag.text.strip()
                    
#                     # Lấy ngày từ <span class="time time-ago" title="2025-12-17T13:45:00">
#                     pub_date = None
#                     time_tag = container.select_one('.time.time-ago')
#                     if time_tag:
#                         iso_date = time_tag.get('title') # "2025-12-17T13:45:00"
#                         if iso_date:
#                             try:
#                                 pub_date = datetime.datetime.fromisoformat(iso_date)
#                             except: pass
                        
#                         if not pub_date:
#                             pub_date = parse_vietnamese_date(time_tag.text.strip())

#                     articles.append({
#                         'url': full_url,
#                         'title': title,
#                         'publish_date': pub_date
#                     })
#                     seen_links.add(full_url)
#                 except: continue

#         return articles

#     async def crawl_article_detail(self, article_data: Dict, content_keyword: Optional[str]) -> Optional[Dict]:
#         url = article_data['url']
#         try:
#             resp = await self.client.get(url)
#             if resp.status_code != 200: return None
            
#             soup = BeautifulSoup(resp.text, 'html.parser')
            
#             # 1. Title
#             # <h1 class="title" data-role="title">
#             title_tag = soup.select_one('h1.title')
#             if title_tag:
#                 article_data['title'] = title_tag.text.strip()

#             # 2. Date
#             # <span class="pdate" data-role="publishdate">15-08-2025 - 13:30 PM </span>
#             if not article_data.get('publish_date'):
#                 date_tag = soup.select_one('.pdate')
#                 if date_tag:
#                     raw_date = date_tag.text.strip().replace('|', '').strip() 
#                     # Format: 15-08-2025 - 13:30 PM
#                     # Xử lý trong utils.py hoặc trực tiếp ở đây
#                     pd = parse_vietnamese_date(raw_date)
#                     if pd: article_data['publish_date'] = pd
            
#             # Fallback date
#             if not article_data.get('publish_date'):
#                  article_data['publish_date'] = datetime.datetime.now()

#             # 3. Categories
#             # <a data-role="cate-name" class="category-page__name cat" ...>
#             cats = []
#             cat_tag = soup.select_one('a.category-page__name') or soup.select_one('a.cat')
#             if cat_tag:
#                 cats.append(cat_tag.text.strip())
            
#             # 4. Sapo (Summary)
#             # <h2 class="sapo" data-role="sapo">
#             sapo_tag = soup.select_one('.sapo')
#             sapo_text = sapo_tag.text.strip() if sapo_tag else ""

#             # 5. Content
#             # <div class="detail-content afcbc-body" data-role="content">
#             content_div = soup.select_one('.detail-content.afcbc-body') or soup.select_one('.detail-content')
            
#             content_text = ""
#             if content_div:
#                 # Xóa rác
#                 for trash in content_div.select('.link-content-footer, .avatar-content, .box-dautu, .related-news'):
#                     trash.decompose()
                
#                 # CafeF dùng thẻ p, có thể có b, i
#                 paragraphs = content_div.find_all('p')
#                 lines = []
#                 for p in paragraphs:
#                     text = p.text.strip()
#                     if text: lines.append(text)
#                 content_text = "\n".join(lines)
            
#             if not content_text: return None

#             # Filter Keyword Content
#             if content_keyword and content_keyword.lower() not in content_text.lower():
#                 return None

#             # 6. Tags (Search Keywords)
#             # <div class="row2" data-marked-zoneid="cafef_detail_tag"> -> a
#             tags = []
#             tag_area = soup.select_one('.row2[data-marked-zoneid="cafef_detail_tag"]') or soup.select_one('.tags')
#             if tag_area:
#                 tag_links = tag_area.select('a')
#                 for t in tag_links:
#                     txt = t.text.strip()
#                     if txt: tags.append(txt)

#             article_id = str(uuid.uuid5(uuid.NAMESPACE_URL, url))

#             article_data.update({
#                 'article_id': article_id,
#                 'summary': sapo_text,
#                 'content': content_text,
#                 'site_categories': cats,
#                 'tags': tags,
#                 'status': 'raw',
#                 'crawled_at': datetime.datetime.now()
#             })
#             return article_data

#         except Exception as e:
#             print(f"[CAFEF ERR] Detail {url}: {e}")
#             return None