import { auth } from "@/auth";
import ArticleTable from "@/components/admin/article/article.table"; // Đảm bảo đường dẫn import đúng
import { sendRequest } from "@/utils/api";
import { IAdminArticle } from "@/types/next-auth";

// Định nghĩa Interface cho response API
interface IArticleResponse {
    data: IAdminArticle[];
    total: number;
    page: number;
    limit: number;
}

const ArticleManagePage = async ({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) => {
    // 1. Lấy tham số từ URL
    const params = await searchParams;
    const session = await auth();

    const current = Number(params.page ?? 1);
    const pageSize = Number(params.limit ?? 20);
    const keyword = params.q ? String(params.q) : "";
    const website = params.website ? String(params.website) : "";
    const topic = params.topic ? String(params.topic) : "";
    const sort = params.sort ? String(params.sort) : "";

    // 2. Fetch danh sách Websites (để truyền xuống cho dropdown)
    const resWebsites = await sendRequest<any[]>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/article/websites`,
        method: "GET",
        headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    const websites = resWebsites?.data ?? [];

    // 3. Build Query String cho API Bài viết
    const apiParams = new URLSearchParams();
    apiParams.append('page', current.toString());
    apiParams.append('limit', pageSize.toString());
    if (keyword) apiParams.append('q', keyword);
    if (website) apiParams.append('website', website);
    if (topic) apiParams.append('topic', topic);
    if (sort) apiParams.append('sort', sort);

    // 4. Fetch danh sách Bài viết từ Server
    const resArticles = await sendRequest<any>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/admin/articles/search?${apiParams.toString()}`,
        method: "GET",
        headers: { Authorization: `Bearer ${session?.access_token}` },
    });

    // Xử lý dữ liệu trả về (khớp với cấu trúc bạn đã cung cấp: { data: { data: [], total: ... } })
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
            total = (resArticles.data as any).estimatedTotalHits || 0;
        }
    }

    // 5. Truyền dữ liệu xuống Client Component
    return (
        <div>
            <ArticleTable 
                articles={articles}
                meta={{ current, pageSize, total }}
                websites={websites}
            />
        </div>
    );
};

export default ArticleManagePage;