import { auth } from "@/auth";
import { sendRequest } from "@/utils/api";
import { IArticle } from "@/types/next-auth";
import SavedArticleList from "@/components/client/article/saved.article.list";
import { Button, Result } from "antd";
import Link from "next/link";

interface ISavedArticleResponse {
    data: any[]; 
    total: number;
    page: number | string;
    limit: number | string;
    totalPages: number;
}

const SavedArticlesPage = async ({
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
    let error = null;

    if (session) {
        try {
            const res = await sendRequest<ISavedArticleResponse>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/saved-articles?page=${page}&limit=${limit}&user_id=${session.user._id}`,
                method: 'GET',
                headers: { Authorization: `Bearer ${session.access_token}` },
            });

            const responseData = res?.data;

            if (responseData && Array.isArray(responseData.data)) {
                savedArticles = responseData.data.map((item: any) => ({
                    ...item,
                    id: item.article_id, 
                    _id: item.article_id,
                    title: item.title || item.article_title || "Không có tiêu đề",
                    url: item.url || item.article_url || "#",
                    website: item.website || "Nguồn khác",
                    publish_date: item.publish_date || item.createdAt || new Date().toISOString(),
                    ai_sentiment_score: item.ai_sentiment_score ?? null,
                    site_categories: item.site_categories || [],
                    summary: item.summary || "Chưa có tóm tắt nội dung.",
                    ai_summary: item.ai_summary || []
                }));

                meta = {
                    current: Number(responseData.page),
                    pageSize: Number(responseData.limit),
                    total: responseData.total,
                    totalPages: responseData.totalPages
                };
            }
        } catch (err) {
            console.error("Error fetching saved articles:", err);
            error = "Không thể tải danh sách bài viết.";
        }
    }

    return (
        <div style={{ 
            backgroundColor: '#f5f7fa', 
            minHeight: '100vh', 
            padding: '24px' 
        }}>
            {!session ? (
                <div style={{ textAlign: 'center', marginTop: 50 }}>
                    <p>Vui lòng đăng nhập để xem bài viết đã lưu.</p>
                    <Link href="/auth/login"><Button type="primary">Đăng nhập</Button></Link>
                </div>
            ) : (
                <SavedArticleList 
                    articles={savedArticles} 
                    meta={meta} 
                />
            )}
        </div>
    );
};

export default SavedArticlesPage;