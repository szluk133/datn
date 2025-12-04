from pydantic import BaseModel, Field
from typing import List, Optional
import datetime

class CrawlParams(BaseModel):
    websites: Optional[List[str]] = Field(default=[], description="Danh sách website (bỏ trống để tìm tất cả).")
    keyword_search: str = Field(..., description="Từ khóa tìm kiếm.")
    keyword_content: Optional[str] = Field("", description="Từ khóa lọc sâu nội dung.")
    
    max_articles: int = Field(10, gt=0, description="Tổng số bài tối đa hệ thống nên lưu trữ/tìm kiếm cho topic này.")
    
    start_date: str = Field(..., description="Ngày bắt đầu (dd/mm/yyyy).")
    end_date: str = Field(..., description="Ngày kết thúc (dd/mm/yyyy).")
    user_id: str = Field(..., description="ID người dùng.")
    
    page: int = Field(1, gt=0, description="Trang hiện tại (bắt đầu từ 1).")
    page_size: int = Field(10, gt=0, le=50, description="Số lượng bài trên mỗi trang.")

class TopicBase(BaseModel):
    name: str = Field(..., description="Tên chủ đề.")
    url: str = Field(..., description="Link chuyên mục.")
    website: str = Field(..., description="Nguồn.")
    category_group: Optional[str] = Field("General", description="Nhóm.")

class TopicCreate(TopicBase):
    pass

class TopicInDB(TopicBase):
    id: str = Field(alias="_id")
    last_crawled_at: Optional[datetime.datetime] = None
    is_active: bool = True

class ScheduleConfig(BaseModel):
    minutes: int = Field(..., gt=5, description="Số phút giữa các lần crawl (tối thiểu 5 phút).")