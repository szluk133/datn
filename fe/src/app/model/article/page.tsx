import { auth } from "@/auth";
import { sendRequest } from "@/utils/api";
import { IArticle } from "@/types/next-auth";
import ArticleResultList from "@/components/client/article/article.result.list";

export interface SentimentStats {
    positive: number;
    negative: number;
    neutral: number;
}

interface IPaginatedArticleResponse {
    data: IArticle[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    sentiment_stats?: SentimentStats;
}

const ArticleResultsPage = async ({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) => {
    const params = await searchParams;
    const session = await auth();

    const searchId = params.id ? String(params.id) : null;
    const page = Number(params.page ?? 1);
    const limit = 5;

    let articles: IArticle[] = [];
    let meta = { current: 1, pageSize: 5, total: 0, totalPages: 0 };
    let sentimentStats: SentimentStats | undefined = undefined;

    if (searchId && session) {
        try {
            const res = await sendRequest<IPaginatedArticleResponse>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/article/search-history/${searchId}?page=${page}&limit=${limit}`,
                method: 'GET',
                headers: { Authorization: `Bearer ${session?.access_token}` },
            });

            if (res.data) {
                articles = res.data.data;
                meta = {
                    current: res.data.page,
                    pageSize: res.data.limit,
                    total: res.data.total,
                    totalPages: res.data.totalPages
                };
                if (res.data.sentiment_stats) {
                    sentimentStats = res.data.sentiment_stats;
                }
            }
        } catch (error) {
            console.error("Error fetching articles server-side:", error);
        }
    }

    return (
        <div style={{ backgroundColor: '#f5f7fa', minHeight: '100vh', padding: '24px' }}>
            <ArticleResultList 
                articles={articles} 
                meta={meta} 
                searchId={searchId}
                sentimentStats={sentimentStats}
            />
        </div>
    );
};

export default ArticleResultsPage;