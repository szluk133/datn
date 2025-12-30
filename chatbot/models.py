from pydantic import BaseModel, Field
from typing import Optional, List, Literal

class SourcedAnswer(BaseModel):
    """
    Đại diện cho một nguồn thông tin (bài báo).
    Move class này lên trước ChatHistory để dùng trong ChatHistory
    """
    article_id: str = Field(..., description="ID của bài báo nguồn.")
    title: str = Field(..., description="Tiêu đề của bài báo nguồn.")
    url: Optional[str] = Field(None, description="Link bài gốc (nếu có).")

class ChatHistory(BaseModel):
    """
    Mô hình cho một cặp hỏi-đáp trong lịch sử chat.
    """
    query: str
    answer: str
    intent: Optional[str] = None
    dependency: Optional[str] = None
    # [CẬP NHẬT] Lưu thêm sources để biết bài 1, bài 2 là bài nào
    sources: List[SourcedAnswer] = Field(default=[], description="Danh sách nguồn của câu trả lời này.")

class ChatContext(BaseModel):
    """
    Ngữ cảnh hiện tại của người dùng trên Frontend.
    """
    current_page: Literal["home_page", "list_page", "detail_page", "my_page"] = Field("home_page", description="Trang người dùng đang đứng. Thêm 'my_page' cho trang tài liệu cá nhân.")
    
    search_id: Optional[str] = Field(None, description="ID phiên tìm kiếm hiện tại (dùng cho list_page).")
    
    update_id: Optional[str] = Field(None, description="ID đợt upload tài liệu (dùng cho my_page).")
    
    article_id: Optional[str] = Field(None, description="ID bài báo (nếu ở trang detail).")
    
    sort_by: Optional[Literal["publish_date", "sentiment", "relevance"]] = Field(
        "relevance", 
        description="Tiêu chí sắp xếp hiện tại trên Frontend (mặc định là độ liên quan/relevance)."
    )
    sort_order: Optional[Literal["asc", "desc"]] = Field(
        "desc", 
        description="Thứ tự sắp xếp: 'asc' (tăng dần) hoặc 'desc' (giảm dần)."
    )

class ChatRequest(BaseModel):
    """
    Mô hình dữ liệu cho một yêu cầu chat từ client.
    """
    user_id: str = Field(..., description="ID định danh người dùng.")
    query: str = Field(..., description="Câu hỏi của người dùng.")
    conversation_id: Optional[str] = Field(None, description="ID của phiên hội thoại hiện tại.")
    context: ChatContext = Field(default_factory=ChatContext, description="Ngữ cảnh trang web hiện tại.")

class ChatResponse(BaseModel):
    """
    Mô hình dữ liệu cho phản hồi từ chatbot.
    """
    answer: str = Field(..., description="Câu trả lời tổng hợp cuối cùng.")
    conversation_id: str = Field(..., description="ID của phiên hội thoại.")
    sources: List[SourcedAnswer] = Field(default=[], description="Danh sách nguồn tham khảo.")
    intent_detected: Optional[str] = Field(None, description="Loại ý định hệ thống phát hiện.")
    dependency_label: Optional[str] = Field(None, description="Nhãn câu hỏi (main/sub).")
    strategy_used: Optional[str] = Field(None, description="Chiến lược RAG đã dùng.")