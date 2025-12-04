from pydantic import BaseModel, Field
from typing import Optional, List, Literal

class ChatHistory(BaseModel):
    query: str
    answer: str

class ChatContext(BaseModel):
    """
    Ngữ cảnh hiện tại của người dùng trên Frontend.
    """
    current_page: Literal["home_page", "list_page", "detail_page"] = Field("home_page", description="Trang người dùng đang đứng.")
    search_id: Optional[str] = Field(None, description="ID phiên tìm kiếm (nếu ở trang list).")
    article_id: Optional[str] = Field(None, description="ID bài báo (nếu ở trang detail).")

class ChatRequest(BaseModel):
    """
    Mô hình dữ liệu cho một yêu cầu chat từ client.
    """
    user_id: str = Field(..., description="ID định danh người dùng.")
    query: str = Field(..., description="Câu hỏi của người dùng.")
    conversation_id: Optional[str] = Field(None, description="ID của phiên hội thoại hiện tại.")
    
    context: ChatContext = Field(default_factory=ChatContext, description="Ngữ cảnh trang web hiện tại.")

class SourcedAnswer(BaseModel):
    """
    Đại diện cho một nguồn bài báo.
    """
    article_id: str = Field(..., description="ID của bài báo nguồn.")
    title: str = Field(..., description="Tiêu đề của bài báo nguồn.")
    url: Optional[str] = Field(None, description="Link bài gốc (nếu có).")

class ChatResponse(BaseModel):
    """
    Mô hình dữ liệu cho phản hồi từ chatbot.
    """
    answer: str = Field(..., description="Câu trả lời tổng hợp cuối cùng.")
    conversation_id: str = Field(..., description="ID của phiên hội thoại.")
    sources: List[SourcedAnswer] = Field(default=[], description="Danh sách nguồn tham khảo.")
    intent_detected: Optional[str] = Field(None, description="Loại ý định hệ thống phát hiện (Debug).")
    strategy_used: Optional[str] = Field(None, description="Chiến lược RAG đã dùng (Summary First vs Deep Dive).")