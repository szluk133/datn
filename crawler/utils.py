import datetime
import re
from typing import Optional, List, Dict
import uuid
from config import CHUNK_SIZE_CHARS

def parse_vietnamese_date(date_str: str) -> Optional[datetime.datetime]:
    date_str = date_str.strip()
    try:
        match_vnexpress = re.search(r'(\d{1,2}/\d{1,2}/\d{4}), (\d{1,2}:\d{2})', date_str)
        if match_vnexpress:
            date_part = match_vnexpress.group(1)
            time_part = match_vnexpress.group(2)
            return datetime.datetime.strptime(f"{date_part} {time_part}", '%d/%m/%Y %H:%M')

        if re.match(r'\d{1,2}/\d{1,2}/\d{4}, \d{1,2}:\d{2}', date_str):
            return datetime.datetime.strptime(date_str, '%d/%m/%Y, %H:%M')

        match_short = re.search(r'(\d{1,2}/\d{1,2}/\d{4})', date_str)
        if match_short:
            date_part = match_short.group(1)
            return datetime.datetime.strptime(date_part, '%d/%m/%Y')
        
        return datetime.datetime.strptime(date_str, '%d/%m/%Y')
    except Exception:
        return None

def split_text_into_chunks(article_id: str, content: str) -> List[Dict]:
    """
    Chia nội dung bài viết thành các đoạn nhỏ (Chunks) để vector hóa.
    Mỗi chunk chứa text thực tế để Chatbot đọc.
    """
    chunks = []
    if not content:
        return chunks
        
    content_length = len(content)
    chunk_index = 0
    
    # Logic cắt đơn giản theo ký tự (có thể nâng cấp cắt theo câu/đoạn sau)
    while chunk_index * CHUNK_SIZE_CHARS < content_length:
        offset = chunk_index * CHUNK_SIZE_CHARS
        chunk_text = content[offset: offset + CHUNK_SIZE_CHARS]
        
        # Bỏ qua chunk quá ngắn (dưới 50 ký tự)
        if len(chunk_text.strip()) < 50:
            chunk_index += 1
            continue

        chunk_data = {
            'chunk_id': f"{article_id}_{chunk_index}",
            'text': chunk_text, # Nội dung quan trọng cho Chatbot
            'offset': offset
        }
        chunks.append(chunk_data)
        chunk_index += 1
        
    return chunks