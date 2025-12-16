import { auth } from "@/auth";
import { sendRequest } from "@/utils/api";
import { IArticle } from "@/types/next-auth";
import ArticleBody from "@/components/client/article/ArticleBody";
import ArticleDetailBreadcrumb from "@/components/client/article/article.breadcrumb"; 
import { Card, Result, Button } from "antd";
import Link from "next/link";
import { ReadOutlined } from "@ant-design/icons";

const ArticleDetailPage = async ({
    params,
}: {
    params: Promise<{ articleId: string }>;
}) => {
    const { articleId } = await params;
    const session = await auth();

    let article: IArticle | null = null;
    let error = null;

    try {
        const res = await sendRequest<IArticle>({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/article/${articleId}`,
            method: 'GET',
            headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        if (res.data) {
            article = res.data;
        } else {
            error = "Không tìm thấy bài viết";
        }
    } catch (e) {
        error = "Lỗi kết nối";
    }

    if (error || !article) {
        return (
            <div style={{ padding: '50px 20px', display: 'flex', justifyContent: 'center' }}>
                <Result
                    status="404"
                    title="404"
                    subTitle="Xin lỗi, bài viết bạn tìm kiếm không tồn tại hoặc đã bị xóa."
                    extra={
                        <Link href="/model/article">
                            <Button type="primary">Quay lại danh sách</Button>
                        </Link>
                    }
                />
            </div>
        );
    }

    return (
        <div style={{ 
            backgroundColor: '#f5f7fa',
            minHeight: '100vh', 
            paddingBottom: '40px' 
        }}>
            <div style={{ height: '60px', background: '#fff', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 20px' }}>
                    <ArticleDetailBreadcrumb title={article.title} />
                </div>
            </div>

            <div style={{ maxWidth: 900, margin: '24px auto', padding: '0 20px' }}>
                <Card 
                    variant="borderless" 
                    style={{ 
                        borderRadius: 12, 
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)' 
                    }}
                    styles={{ body: { padding: '40px' } }}
                >
                    <ArticleBody 
                        articleId={article.id || article._id}
                        title={article.title}
                        content={article.content || ''}
                        website={article.website}
                        publish_date={article.publish_date}
                        ai_sentiment_score={article.ai_sentiment_score}
                        ai_summary={article.ai_summary}
                        site_categories={article.site_categories}
                        url={article.url}
                    />
                </Card>
            </div>
        </div>
    );
};

export default ArticleDetailPage;