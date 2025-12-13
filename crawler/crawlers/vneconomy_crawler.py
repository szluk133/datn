import urllib.parse
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
        try:
            s_dt = datetime.datetime.strptime(start_date_iso, '%Y-%m-%d')
            e_dt = datetime.datetime.strptime(end_date_iso, '%Y-%m-%d')
            s_date_vn = s_dt.strftime('%d/%m/%Y')
            e_date_vn = e_dt.strftime('%d/%m/%Y')
        except:
            s_date_vn = start_date_iso
            e_date_vn = end_date_iso

        encoded_keyword = urllib.parse.quote_plus(keyword)
        url = f"{self.base_url}/tim-kiem.html?Text={encoded_keyword}&FromDate={s_date_vn}&ToDate={e_date_vn}&SortBy=newest&page={page}"
        
        try:
            print(f"[VNECONOMY] Crawling Search: {url}")
            resp = await self.client.get(url)
            if resp.status_code != 200:
                print(f"[VNECONOMY ERR] Search failed: {resp.status_code} | URL: {url}")
                return None
            return BeautifulSoup(resp.text, 'html.parser')
        except Exception as e:
            print(f"[VNECONOMY ERR] Fetch search: {type(e).__name__} - {e}")
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
        seen_links = set()
        
        article_containers = soup.select(
            '.story-item, .featured-row_item, .featured-column_item, '
            '.list-new-item, .highlight-item, .story, .grid-new-column_item, '
            'article.story' 
        )
        
        BLACKLIST_URL_KEYWORDS = [
            '/video-media.htm', '/tieu-diem.htm', '/dau-tu.htm', 
            '/chung-khoan.htm', '/tai-chinh.htm', '/tai-chinh-ngan-hang.htm',
            '/bat-dong-san.htm', '/doanh-nhan.htm', '/the-gioi.htm', 
            '/cuoc-song-so.htm', '/o-to.htm', '/thi-truong.htm',
            '/kinh-te-xanh.htm', '/infographics.htm', '/chuyen-dong-xanh.htm',
            '/dien-dan-kinh-te-xanh.htm', '/thuong-hieu-xanh.htm',
            '/phap-ly-kinh-te-xanh.htm', '/thi-truong-von-tai-chinh.htm',
            '/timeline/'
        ]

        for container in article_containers:
            try:
                link_tag = container.select_one('a.story__title, a.cms-link, .featured-row_item__title a, h3 a, h4 a')
                
                if not link_tag:
                    link_tag = container.find('a', href=True)
                
                if not link_tag: continue

                href = link_tag.get('href')
                if not href or len(href) < 15: continue
                
                if '.htm' not in href or 'video' in href: continue
                
                slug = href.split('/')[-1].replace('.htm', '')
                if slug.count('-') < 3: 
                    continue

                if any(k in href for k in BLACKLIST_URL_KEYWORDS): continue

                full_url = urljoin(self.base_url, href)
                if full_url in seen_links: continue

                title = link_tag.get('title') or link_tag.text.strip()
                if not title:
                    title_elem = container.select_one('h3, h4, .story__title')
                    if title_elem:
                        title = title_elem.get('title') or title_elem.text.strip()
                
                if not title or len(title) < 15: continue

                pub_date = None
                date_tag = container.select_one('.story__time, .time, .date, .meta-time, .featured-row_item__meta')
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
            
            if len(soup.select('.story-item')) > 5 and not soup.select_one('.detail-content'):
                return None

            sapo = soup.select_one('.news-sapo, .sapo, .detail-sapo')
            sapo_text = sapo.text.strip() if sapo else ""
            
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

            if not content_text: 
                main_tag = soup.select_one('main') or soup.select_one('body')
                if main_tag:
                    ps = main_tag.select('p')
                    content_text = "\n".join([p.text.strip() for p in ps if len(p.text.strip()) > 20])
                    if len(content_text) > 5000: content_text = content_text[:5000]

            if not content_text: return None

            content_text = "\n".join([line.strip() for line in content_text.splitlines() if line.strip()])

            if content_keyword and content_keyword.lower() not in content_text.lower(): 
                return None

            date_tag = soup.select_one('.detail-time, .date-detail .date, .msg-time')
            if date_tag:
                pub_date = parse_vietnamese_date(date_tag.text.strip())
                if pub_date: article_data['publish_date'] = pub_date
            
            if not article_data.get('publish_date'):
                article_data['publish_date'] = datetime.datetime.now()

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
                    if main_cat: cats.append(main_cat.text.strip())
                    sub_cats = header_sec.select('a.text-header-dt')
                    for sc in sub_cats:
                        txt = sc.text.strip()
                        if txt and txt not in cats: cats.append(txt)
            
            if not cats:
                breadcrumb_links = soup.select('.breadcrumb li a, .breadcrumb-item a, ul.breadcrumb a')
                for a in breadcrumb_links:
                    txt = a.text.strip()
                    if txt and "Trang chủ" not in txt and txt not in cats: cats.append(txt)

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
            print(f"[VNECONOMY ERR] Detail {url}: {e}")
            return None