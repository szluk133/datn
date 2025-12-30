import { auth } from "@/auth";
import { sendRequest } from "@/utils/api";
import SearchClient from "@/components/client/model/search.client";
import { IAdminArticle } from "@/types/next-auth";

const ArticleSearchPage = async ({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) => {
    const params = await searchParams;
    const session = await auth();

    const current = Number(params.page ?? 1);
    const pageSize = Number(params.limit ?? 20);
    
    const keyword = params.q ? String(params.q) : "";
    const website = params.website ? String(params.website) : "";
    const topic = params.topic ? String(params.topic) : "";
    const sort = params.sort ? String(params.sort) : "";

    const startDate = params.startDate ? String(params.startDate) : "";
    const endDate = params.endDate ? String(params.endDate) : "";
    
    // Cập nhật: Thêm sentimentLabel và giữ min/max sentiment cho độ tin cậy
    const sentimentLabel = params.sentimentLabel ? String(params.sentimentLabel) : "";
    const minSentiment = params.minSentiment ? String(params.minSentiment) : "";
    const maxSentiment = params.maxSentiment ? String(params.maxSentiment) : "";

    const resWebsites = await sendRequest<any[]>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/article/websites`,
        method: "GET",
        headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    const websites = resWebsites?.data ?? [];

    const apiParams = new URLSearchParams();
    apiParams.append('page', current.toString());
    apiParams.append('limit', pageSize.toString());

    if (keyword) apiParams.append('q', keyword);
    if (website) apiParams.append('website', website);
    if (topic) apiParams.append('topic', topic);
    if (sort) apiParams.append('sort', sort);

    if (startDate) apiParams.append('startDate', startDate);
    if (endDate) apiParams.append('endDate', endDate);
    
    // Thêm tham số mới vào API call
    if (sentimentLabel) apiParams.append('sentimentLabel', sentimentLabel);
    if (minSentiment) apiParams.append('minSentiment', minSentiment);
    if (maxSentiment) apiParams.append('maxSentiment', maxSentiment);

    const resArticles = await sendRequest<any>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/admin/articles/search?${apiParams.toString()}`,
        method: "GET",
        headers: { Authorization: `Bearer ${session?.access_token}` },
    });

    let articles: IAdminArticle[] = [];
    let total = 0;

    if (resArticles.data) {
        if ((resArticles.data as any).data && Array.isArray((resArticles.data as any).data)) {
            articles = (resArticles.data as any).data;
            total = (resArticles.data as any).total || 0;
        } else if (Array.isArray(resArticles.data)) {
            articles = resArticles.data;
            total = articles.length;
        } else if ((resArticles.data as any).hits) {
            articles = (resArticles.data as any).hits;
            total = (resArticles.data as any).estimatedTotalHits || (resArticles.data as any).totalHits || 0;
        }
    }

    return (
        <div style={{ 
            backgroundColor: '#f5f7fa', 
            minHeight: '100vh', 
            padding: '24px' 
        }}>
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                <SearchClient 
                    articles={articles}
                    meta={{ current, pageSize, total }}
                    websites={websites}
                />
            </div>
        </div>
    );
};

export default ArticleSearchPage;