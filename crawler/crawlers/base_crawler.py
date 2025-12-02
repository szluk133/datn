from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Tuple
from bs4 import BeautifulSoup
import datetime
import httpx

class BaseCrawler(ABC):
    
    def __init__(self, client: httpx.AsyncClient):
        self.client = client

    @abstractmethod
    async def fetch_search_page(self, keyword: str, page: int, start_date_iso: str, end_date_iso: str) -> Optional[BeautifulSoup]:
        """Crawl trang kết quả tìm kiếm (On-demand)."""
        pass

    @abstractmethod
    async def fetch_category_page(self, category_url: str, page: int) -> Optional[BeautifulSoup]:
        """(MỚI) Crawl trang chuyên mục (Auto-crawl)."""
        pass

    @abstractmethod
    def extract_article_links(self, soup: BeautifulSoup, is_search_page: bool = True) -> List[Dict]:
        """
        Trích xuất link. 
        is_search_page=True: Xử lý HTML trang tìm kiếm.
        is_search_page=False: Xử lý HTML trang chuyên mục.
        """
        pass

    @abstractmethod
    async def crawl_article_detail(self, article_data: Dict, content_keyword: Optional[str]) -> Optional[Dict]:
        """Crawl chi tiết bài báo."""
        pass