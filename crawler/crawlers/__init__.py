# -*- coding: utf-8 -*-
from .vneconomy_crawler import VneconomyCrawler
from .vnexpress_crawler import VnExpressCrawler
# 1. Khi bạn tạo crawler mới (ví dụ: CafeFCrawler), hãy import nó ở đây
# from .cafef_crawler import CafeFCrawler 

# 2. Đây là "Registry" để API biết website nào tương ứng với class nào
CRAWLER_REGISTRY = {
    "vneconomy.vn": VneconomyCrawler,
    "vnexpress.net": VnExpressCrawler,
}
