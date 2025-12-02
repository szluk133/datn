import { auth } from "@/auth";
import { sendRequest } from "@/utils/api";
import { IArticle } from "@/types/next-auth";
import SavedArticleList from "@/components/client/article/saved.article.list";
import { Button } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import Link from "next/link";

// Cập nhật Interface khớp với response thực tế: { data: { data: [], total: ... } }
interface ISavedArticleResponse {
    data: any[]; 
    total: number;
    page: number | string; // API trả về string "1"
    limit: number | string; // API trả về string "10"
    totalPages: number;
}

const ModelHomePage = async ({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) => {
    const session = await auth();
    const params = await searchParams;

    const page = Number(params.page ?? 1);
    const limit = 10;

    let savedArticles: IArticle[] = [];
    let meta = { current: 1, pageSize: limit, total: 0, totalPages: 0 };

    if (session) {
        try {
            const res = await sendRequest<ISavedArticleResponse>({
                // Thêm user_id vào query params giống API mẫu bạn cung cấp
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/saved-articles?page=${page}&limit=${limit}&user_id=${session.user._id}`,
                method: 'GET',
                headers: { Authorization: `Bearer ${session.access_token}` },
            });

            // Lấy object data bọc bên ngoài
            const responseData = res?.data;

            // Kiểm tra và truy cập vào mảng data nằm lồng bên trong
            if (responseData && Array.isArray(responseData.data)) {
                
                savedArticles = responseData.data.map((item: any) => ({
                    ...item,
                    // QUAN TRỌNG: Map article_id (string) thành _id/id để component ArticleItem hiểu
                    id: item.article_id, 
                    _id: item.article_id,
                    
                    // Xử lý dữ liệu null từ API (Fallback values)
                    // Nếu title null -> lấy article_title
                    title: item.title || item.article_title || "Không có tiêu đề",
                    // Nếu url null -> lấy article_url
                    url: item.url || item.article_url || "#",
                    // Nếu website null -> Hiện "N/A"
                    website: item.website || "N/A",
                    // Nếu publish_date null -> Lấy ngày hiện tại hoặc createdAt của record saved
                    publish_date: item.publish_date || item.createdAt || new Date().toISOString(),
                    // Sentiment null -> 0
                    ai_sentiment_score: item.ai_sentiment_score ?? 0,
                    site_categories: item.site_categories || [],
                    summary: item.summary || "Bài viết chưa có tóm tắt chi tiết."
                }));

                meta = {
                    current: Number(responseData.page),
                    pageSize: Number(responseData.limit),
                    total: responseData.total,
                    totalPages: responseData.totalPages
                };
            }
        } catch (error) {
            console.error("Error fetching saved articles for home:", error);
        }
    }

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            {/* Header: Tiêu đề + Nút Tìm kiếm */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: 24,
                borderBottom: '1px solid #f0f0f0',
                paddingBottom: 16
            }}>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: '#1890ff' }}>
                    Bài viết đã lưu
                </h2>
                
                <Link href="/model/search">
                    <Button type="primary" size="large" icon={<SearchOutlined />}>
                        Tìm kiếm bài báo
                    </Button>
                </Link>
            </div>

            {/* Danh sách bài đã lưu */}
            <section>
                <SavedArticleList 
                    articles={savedArticles} 
                    meta={meta} 
                />
            </section>
        </div>
    );
};

export default ModelHomePage;

// 'use client';

// import ArticleList from "@/components/client/article/article.list";
// import { Col, Row } from "antd";
// import React from "react";


// const ClientPage = () => {
//     return (
//         <Row justify="center">
//             <Col xs={24} md={18} lg={12}>
//                 <ArticleList />
//             </Col>
//         </Row>
//     )
// }

// export default ClientPage;

