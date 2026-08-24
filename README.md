# lvc

🚀 Tính năng chính
- Crawler Module: Tự động thu thập tin tức từ các nguồn uy tín (CafeF, VnEconomy, VnExpress).
- Search Engine: Tìm kiếm bài viết nhanh chóng với MeiliSearch. 
- AI Chatbot (RAG): Chatbot trả lời câu hỏi sử dụng Qdrant (Vector DB) và LLM.
- Admin Dashboard: Quản lý bài viết, người dùng, chủ đề và xem thống kê hệ thống.
- User Interface: Giao diện người dùng thân thiện để đọc tin, lưu bài viết và tương tác với Chatbot.

📂 Cấu trúc dự án
Dự án được chia thành 4 module chính:
```
lvc/
├── be/           # Backend API (NestJS, MongoDB, MeiliSearch, Qdrant)
├── fe/           # Frontend User & Admin (Next.js, TailwindCSS)
├── crawler/      # Tool thu thập dữ liệu (Python)
└── chatbot/      # AI Service & RAG Logic (Python)
```

🛠 Yêu cầu hệ thống
Trước khi cài đặt, đảm bảo máy tính của bạn đã cài đặt:
- Node.js: v18 trở lên
- Python: v3.9 trở lên
- Git

1. Cài đặt Backend (NestJS)
- Thư mục: /be
- Cài đặt dependencies:
  ```
  cd be
  npm install
  ```
- Cấu hình biến môi trường:
  ```
  cp .env.example .env
  ```
  Cập nhật các thông số trong .env (MongoDB URI, MeiliSearch Key, JWT Secret, v.v.)
- Chạy ứng dụng:
  ```
  # Chế độ development
  npm run dev
  ```
- Backend sẽ chạy tại: http://localhost:8080.

2. Cài đặt Frontend (Next.js)
- Thư mục: /fe
- Cài đặt dependencies:
  ```
  cd fe
  npm install
  ```
- Cấu hình biến môi trường:
  ```
  cp .env.example .env
  ```
- Cập nhật .env:
  - NEXT_PUBLIC_API_URL: URL của Backend
  - NEXTAUTH_SECRET: Secret key cho xác thực.
  - NEXTAUTH_URL: URL của Frontend
- Chạy ứng dụng:
  ```
  npm run dev
  ```

3. Cài đặt Crawler (Python)
- Thư mục: /crawler
- Module này dùng để cào dữ liệu và đẩy vào Database/Vector DB.
- Tạo môi trường ảo (Virtual Environment):
  ```
  cd crawler
  python -m venv venv
  # Windows:
  venv\Scripts\activate
  # macOS / Linux:
  source venv/bin/activate
  ```
- Cài đặt thư viện:
  ```
  pip install -r requirements.txt
  ```
- Cấu hình:
  ```
  cp .env.example .env
  ```
  Cấu hình kết nối Qdrant, MongoDB và API Key cho Embedding Model.
- Chạy Crawler:
  ```
  python main.py
  ```

4. Cài đặt Chatbot Service (Python)
- Thư mục: /chatbot
- Tạo môi trường ảo:
  ```
  cd chatbot
  python -m venv venv
  # Windows:
  venv\Scripts\activate
  # macOS / Linux:
  source venv/bin/activate
  ```
- Cài đặt thư viện:
  ```
  pip install -r requirements.txt
  ```
- Cấu hình:
  ```
  cp .env.example .env
  ```
  Cần API Key của LLM Provider (OpenAI/Gemini/Anthropic) và kết nối Qdrant.
- Chạy Service:
  ```
  python main.py
  ```

📝 Quy trình phát triển (Development Workflow)
1. Đảm bảo Mongodb, Meilisearch, Qdrant đang chạy.
2. Chạy Backend (be).
3. Chạy Frontend (fe).
4. Chạy Crawler (crawler) lần đầu để nạp dữ liệu vào DB.
5. Khởi động Chatbot (chatbot) để phục vụ tính năng chat.
