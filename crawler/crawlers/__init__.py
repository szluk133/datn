from .cafef_crawler import CafeFCrawler
from .vneconomy_crawler import VneconomyCrawler
from .vnexpress_crawler import VnExpressCrawler

CRAWLER_REGISTRY = {
    "vneconomy.vn": VneconomyCrawler,
    "vnexpress.net": VnExpressCrawler,
    "cafef.vn": CafeFCrawler,
}
