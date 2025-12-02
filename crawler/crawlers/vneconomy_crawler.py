import requests
from bs4 import BeautifulSoup
from typing import List, Dict, Optional, Tuple
from urllib.parse import urlparse, urljoin
import datetime
import uuid
import re 
from .base_crawler import BaseCrawler
from utils import parse_vietnamese_date

class VneconomyCrawler(BaseCrawler):
    
    def __init__(self, client):
        super().__init__(client)
        self.base_url = "https://vneconomy.vn"

    async def fetch_search_page(self, keyword: str, page: int, start_date_iso: str, end_date_iso: str) -> Optional[BeautifulSoup]:
        url = f"{self.base_url}/tim-kiem.html?Text={requests.utils.quote(keyword)}&FromDate={start_date_iso}&ToDate={end_date_iso}&SortBy=newest&page={page}"
        try:
            resp = await self.client.get(url)
            if resp.status_code != 200:
                print(f"[VNECONOMY ERR] Search failed: {resp.status_code}")
                return None
            return BeautifulSoup(resp.text, 'html.parser')
        except Exception as e:
            print(f"[VNECONOMY ERR] Fetch search: {e}")
            return None

    async def fetch_category_page(self, category_url: str, page: int) -> Optional[BeautifulSoup]:
        if "?" in category_url: 
            url = f"{category_url}&trang={page}"
        else: 
            url = f"{category_url}?trang={page}"
        
        try:
            resp = await self.client.get(url)
            if resp.status_code != 200:
                print(f"[VNECONOMY ERR] Category failed ({url}): {resp.status_code}")
                return None
            return BeautifulSoup(resp.text, 'html.parser')
        except Exception as e:
            print(f"[VNECONOMY ERR] Fetch category: {e}")
            return None

    def extract_article_links(self, soup: BeautifulSoup, is_search_page: bool = True) -> List[Dict]:
        articles = []
        seen_links = set() # Set này dùng để lọc trùng TRONG trang hiện tại
        all_links = soup.select('a[href]')
        
        for link_tag in all_links:
            try:
                href = link_tag.get('href')
                # Lọc rác
                if not href or '.htm' not in href or 'video' in href or len(href) < 15:
                    continue
                
                full_url = urljoin(self.base_url, href)
                
                if full_url in seen_links:
                    continue

                title = link_tag.get('title') or link_tag.text.strip()
                
                # Nếu thẻ a hiện tại không có title (ví dụ thẻ ảnh), thử tìm ở cha
                if not title:
                    parent_container = link_tag.find_parent(class_=['featured-row_item', 'story-item', 'highlight-item', 'grid-new-column_item'])
                    if parent_container:
                        title_tag = parent_container.select_one('h3, h4, .featured-row_item__title h3, .story__title')
                        if title_tag:
                            title = title_tag.get('title') or title_tag.text.strip()

                if not title or len(title) < 5: 
                    continue

                # Tìm ngày đăng
                pub_date = None
                parent_classes = [
                    'featured-row_item', 'featured-column_item', 
                    'story-item', 'list-new-item', 'highlight-item', 'story',
                    'grid-new-column_item'
                ]
                
                parent = link_tag.find_parent(class_=parent_classes)
                if parent:
                    date_tag = parent.select_one('.story__time, .time, .date, .meta-time, .featured-row_item__meta')
                    if date_tag:
                        pub_date = parse_vietnamese_date(date_tag.text.strip())

                articles.append({
                    'url': full_url, 
                    'title': title,
                    'publish_date': pub_date 
                })
                seen_links.add(full_url)
                
            except Exception: continue
            
        return articles

    async def crawl_article_detail(self, article_data: Dict, content_keyword: Optional[str]) -> Optional[Dict]:
        url = article_data['url']
        try:
            resp = await self.client.get(url)
            if resp.status_code != 200: return None
            
            soup = BeautifulSoup(resp.text, 'html.parser')

            # 1. Sapo
            sapo = soup.select_one('.news-sapo, .sapo, .detail-sapo')
            sapo_text = sapo.text.strip() if sapo else ""
            
            # 2. Content
            body = soup.select_one('div[data-field="body"]') or \
                   soup.select_one('.detail-content') or \
                   soup.select_one('.content-detail') or \
                   soup.select_one('.multimedia-content') or \
                   soup.select_one('article.post-content')
            
            if body:
                for trash in body.select('.box-dautu, .related-news, table'):
                    trash.decompose()
                content_text = "\n".join([p.text.strip() for p in body.find_all('p') if p.text.strip()])
            else:
                content_text = ""

            # Fallback
            if not content_text: 
                main_tag = soup.select_one('main') or soup.select_one('body')
                if main_tag:
                    ps = main_tag.select('p')
                    content_text = "\n".join([p.text.strip() for p in ps if len(p.text.strip()) > 20])
                    if len(content_text) > 5000: content_text = content_text[:5000]

            if not content_text: 
                return None

            # [LOGIC MỚI] Làm sạch Content: Xóa dòng trống thừa
            # Tách dòng -> strip từng dòng -> bỏ dòng rỗng -> ghép lại
            if content_text:
                content_text = "\n".join([line.strip() for line in content_text.splitlines() if line.strip()])

            if content_keyword and content_keyword.lower() not in content_text.lower(): 
                return None

            # 3. Date
            date_tag = soup.select_one('.detail-time, .date-detail .date, .msg-time')
            if date_tag:
                pub_date = parse_vietnamese_date(date_tag.text.strip())
                if pub_date: article_data['publish_date'] = pub_date
            
            if not article_data.get('publish_date'):
                article_data['publish_date'] = datetime.datetime.now()

            # 4. Categories
            cats = []
            breadcrumbs = soup.select('.breadcrumb-topbar a.text-breadcrumb')
            for b in breadcrumbs:
                txt = b.text.strip()
                if txt and "Trang chủ" not in txt:
                    cats.append(txt)

            if not cats:
                header_sec = soup.select_one('.layout-header-section-page')
                if header_sec:
                    main_cat = header_sec.select_one('.title-header-section-dt .title, h1.title')
                    if main_cat:
                        cats.append(main_cat.text.strip())
                    sub_cats = header_sec.select('a.text-header-dt')
                    for sc in sub_cats:
                        txt = sc.text.strip()
                        if txt and txt not in cats:
                            cats.append(txt)
            
            if not cats:
                breadcrumb_links = soup.select('.breadcrumb li a, .breadcrumb-item a, ul.breadcrumb a')
                for a in breadcrumb_links:
                    txt = a.text.strip()
                    if txt and "Trang chủ" not in txt and txt not in cats:
                        cats.append(txt)

            # 5. Tags
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
                tag_items = soup.select('.list-tag .tag, .list-tag a, .tags-list a, .tag-item a')
                for tag in tag_items:
                    span = tag.find('span')
                    t_text = span.text.strip() if span else tag.text.strip()
                    if t_text: tags.append(t_text)

            article_id = str(uuid.uuid4())
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
            print(f"[VNECONOMY ERR] Detail {url}: {e}")
            return None