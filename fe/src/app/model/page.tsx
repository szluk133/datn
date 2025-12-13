import { auth } from "@/auth";
import { sendRequest } from "@/utils/api";
import { IArticle } from "@/types/next-auth";
import SavedArticleList from "@/components/client/article/saved.article.list";
import { Button } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import Link from "next/link";

interface ISavedArticleResponse {
    data: any[]; 
    total: number;
    page: number | string;
    limit: number | string;
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
                    website: item.website,
                    publish_date: item.publish_date || item.createdAt || new Date().toISOString(),
                    ai_sentiment_score: item.ai_sentiment_score ?? 0,
                    site_categories: item.site_categories || [],
                    summary: item.summary
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

