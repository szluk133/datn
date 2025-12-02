import { auth } from "@/auth";
import { sendRequest } from "@/utils/api";
import { IArticle } from "@/types/next-auth";
import SavedArticleList from "@/components/client/article/saved.article.list";

interface ISavedArticleResponse {
    data: any[]; // Data trả về chứa wrapper của saved items
    total: number;
    page: number;
    totalPages: number;
}

const SavedArticlesPage = async ({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) => {
    const params = await searchParams;
    const session = await auth();

    const page = Number(params.page ?? 1);
    const limit = 10;

    let articles: IArticle[] = [];
    let meta = { current: 1, pageSize: limit, total: 0, totalPages: 0 };

    if (session) {
        try {
            const res = await sendRequest<ISavedArticleResponse>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/saved-articles?page=${page}&limit=${limit}`,
                method: 'GET',
                headers: { Authorization: `Bearer ${session?.access_token}` },
            });

            if (res.data) {
                // API trả về Object Saved (chứa _id của bảng Saved và article details)
                // Ta cần map lại cấu trúc để phù hợp với IArticle cho component hiển thị
                // Giả sử API trả về các field chi tiết bài báo nằm ngang hàng (như mô tả của bạn)
                // Hoặc nếu nó nằm lồng trong 1 field, cần điều chỉnh map ở đây.
                
                // Dựa trên mô tả Response mẫu:
                // { "_id": "saved_id", "article_id": "article_id", "title": "...", "ai_sentiment_score": ... }
                
                articles = res.data.data.map((item: any) => ({
                    ...item,
                    id: item.article_id, // Gán article_id vào id để component ArticleItem dùng làm key và link
                    _id: item.article_id // Fallback
                }));

                meta = {
                    current: res.data.page,
                    pageSize: limit,
                    total: res.data.total,
                    totalPages: res.data.totalPages
                };
            }
        } catch (error) {
            console.error("Error fetching saved articles:", error);
        }
    }

    return (
        <div>
            <SavedArticleList 
                articles={articles} 
                meta={meta} 
            />
        </div>
    );
};

export default SavedArticlesPage;