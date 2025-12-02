import { auth } from "@/auth";
import { sendRequest } from "@/utils/api";
import { IArticle } from "@/types/next-auth";
import ArticleResultList from "@/components/client/article/article.result.list";

interface IPaginatedArticleResponse {
    data: IArticle[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
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
    const limit = 5; // Mặc định như logic cũ

    let articles: IArticle[] = [];
    let meta = { current: 1, pageSize: 5, total: 0, totalPages: 0 };

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
            }
        } catch (error) {
            console.error("Error fetching articles:", error);
        }
    }

    return (
        <div>
            <ArticleResultList 
                articles={articles} 
                meta={meta} 
                searchId={searchId} 
            />
        </div>
    );
};

export default ArticleResultsPage;


// 'use client';

// import React, { useEffect, useState, Suspense } from 'react';
// import { useSearchParams, useRouter } from 'next/navigation';
// import { List, Spin, Breadcrumb, Empty, Result, Button, Pagination, notification, Checkbox, Space, Typography, Badge } from 'antd';
// import { HomeOutlined, ReadOutlined, FileExcelOutlined } from '@ant-design/icons';
// import Link from 'next/link';
// import { useSession } from 'next-auth/react';
// import { sendRequest } from '@/utils/api';
// import { IArticle } from '@/types/next-auth';
// import ArticleItem from '@/components/client/article/article.item';
// import { useChatbot } from '@/components/client/chatbot/chatbot.context';

// const { Text } = Typography;

// interface IPaginatedArticleResponse {
//     data: IArticle[];
//     total: number;
//     page: number;
//     limit: number;
//     totalPages: number;
// }

// const ArticleResultsContent = () => {
//     const [articles, setArticles] = useState<IArticle[]>([]);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState<string | null>(null);
//     const [paginationInfo, setPaginationInfo] = useState({
//         page: 1,
//         limit: 5,
//         total: 0,
//         totalPages: 1,
//     });
//     const [searchId, setSearchId] = useState<string | null>(null);
//     const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
//     const [isExporting, setIsExporting] = useState(false);

//     const searchParams = useSearchParams();
//     const router = useRouter();
//     const { data: session, status } = useSession();

//     const { setPageContext } = useChatbot();

//     // Reset selection khi đổi params
//     useEffect(() => {
//         setSelectedRowKeys(new Set());
//     }, [searchParams]);

//     // Set Page Context cho Kịch bản 2 (List Page)
//     useEffect(() => {
//         const historyIdParam = searchParams.get('id');
        
//         if (historyIdParam) {
//             setSearchId(historyIdParam);
//             // Gửi context chính xác cho Chatbot
//             setPageContext({ 
//                 current_page: 'list_page',
//                 search_id: historyIdParam 
//             });
//         } else {
//             // Nếu không có ID search, coi như đang ở trang list chung chung hoặc home
//             setPageContext({ current_page: 'home_page' });
//         }

//         return () => {
//             setPageContext(null); // Cleanup
//         };
//     }, [searchParams, setPageContext]);

//     // Fetch data logic
//     useEffect(() => {
//         const historyIdParam = searchParams.get('id');
//         const pageParam = searchParams.get('page') || '1';

//         const fetchHistoryDetails = async (id: string, page: number) => {
//             if (!session) {
//                 setError("Phiên đăng nhập không hợp lệ.");
//                 setLoading(false);
//                 return;
//             }
//             setLoading(true);
//             setError(null);
//             try {
//                 const res = await sendRequest<IPaginatedArticleResponse>({
//                     url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/article/search-history/${id}?page=${page}&limit=5`,
//                     method: 'GET',
//                     session: session,
//                 });

//                 if (res.data) {
//                     setArticles(res.data.data);
//                     setPaginationInfo({
//                         page: res.data.page,
//                         limit: res.data.limit,
//                         total: res.data.total,
//                         totalPages: res.data.totalPages,
//                     });
//                 } else {
//                     if (res.statusCode === 401) {
//                         setError("Phiên đăng nhập hết hạn.");
//                     } else {
//                         setError(res.message || 'Không thể tải lịch sử tìm kiếm.');
//                     }
//                     setArticles([]);
//                 }
//             } catch (e: any) {
//                 setError(e.message || "Lỗi kết nối.");
//                 setArticles([]);
//             } finally {
//                 setLoading(false);
//             }
//         };

//         if (historyIdParam) {
//             if (status === 'loading') setLoading(true);
//             else if (status === 'authenticated' && session) fetchHistoryDetails(historyIdParam, parseInt(pageParam, 10));
//             else if (status === 'unauthenticated') {
//                 setError("Bạn cần đăng nhập.");
//                 setLoading(false);
//                 setArticles([]);
//             }
//         } else {
//             setArticles([]);
//             setLoading(false);
//         }
//     }, [searchParams, session, status, router]);

//     const handlePageChange = (page: number) => {
//         if (searchId) {
//             router.push(`/model/article?id=${searchId}&page=${page}`);
//         }
//     };

//     const onToggleSelect = (id: string) => {
//         const newSelection = new Set(selectedRowKeys);
//         if (newSelection.has(id)) newSelection.delete(id);
//         else newSelection.add(id);
//         setSelectedRowKeys(newSelection);
//     };

//     const onSelectAll = (e: any) => {
//         if (e.target.checked) setSelectedRowKeys(new Set(articles.map(a => a.id)));
//         else setSelectedRowKeys(new Set());
//     };

//     const isAllSelected = articles.length > 0 && articles.every(a => selectedRowKeys.has(a.id));

//     const downloadFile = async (url: string, method: 'GET' | 'POST', body: any = null, fileName: string) => {
//         try {
//             const options: RequestInit = {
//                 method,
//                 headers: {
//                     'Authorization': `Bearer ${session?.access_token}`,
//                     ...(body ? { 'Content-Type': 'application/json' } : {}),
//                 },
//                 ...(body ? { body: JSON.stringify(body) } : {}),
//             };
//             const response = await fetch(url, options);
//             if (!response.ok) throw new Error(`Lỗi ${response.status}`);
//             const blob = await response.blob();
//             const downloadUrl = window.URL.createObjectURL(blob);
//             const a = document.createElement('a');
//             a.style.display = 'none';
//             a.href = downloadUrl;
//             a.download = fileName;
//             document.body.appendChild(a);
//             a.click();
//             window.URL.revokeObjectURL(downloadUrl);
//             a.remove();
//             return true;
//         } catch (error) {
//             throw error;
//         }
//     };

//     const handleExport = async () => {
//         if (!session) return;
//         setIsExporting(true);
//         try {
//             if (selectedRowKeys.size > 0) {
//                 notification.info({ message: 'Đang xuất dữ liệu...', description: `Đang tải file Excel.` });
//                 const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/article/export/selected`;
//                 const body = { articleIds: Array.from(selectedRowKeys) };
//                 await downloadFile(url, 'POST', body, `Export_Selected_${new Date().getTime()}.xlsx`);
//                 notification.success({ message: 'Thành công' });
//             } else if (searchId) {
//                 notification.info({ message: 'Đang xuất toàn bộ...', description: 'Đang tải file Excel.' });
//                 const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/article/export/${searchId}`;
//                 await downloadFile(url, 'GET', null, `Export_Full_${searchId}.xlsx`);
//                 notification.success({ message: 'Thành công' });
//             }
//         } catch (error: any) {
//             notification.error({ message: 'Thất bại', description: error.message });
//         } finally {
//             setIsExporting(false);
//         }
//     };

//     const breadcrumbItems = [
//         { title: <Link href="/model"><HomeOutlined /></Link> },
//         { title: <span><ReadOutlined /> Kết quả tìm kiếm</span> },
//     ];

//     if (loading) return <div style={{ textAlign: 'center', padding: '100px' }}><Spin size="large" /></div>;
//     if (error) return <Result status="error" title="Đã có lỗi xảy ra" subTitle={error} />;

//     return (
//         <div>
//             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
//                 <Breadcrumb items={breadcrumbItems} />
//                 <Space>
//                     {selectedRowKeys.size > 0 && (
//                         <Badge count={selectedRowKeys.size} style={{ backgroundColor: '#52c41a' }}>
//                             <span style={{ marginRight: 8, fontWeight: 500, color: '#1890ff' }}>Đã chọn {selectedRowKeys.size} bài</span>
//                         </Badge>
//                     )}
//                     <Button
//                         type={selectedRowKeys.size > 0 ? "primary" : "default"}
//                         icon={<FileExcelOutlined />}
//                         loading={isExporting}
//                         onClick={handleExport}
//                         disabled={isExporting || (!searchId && selectedRowKeys.size === 0) || (paginationInfo.total === 0 && selectedRowKeys.size === 0)}
//                         style={selectedRowKeys.size > 0 ? { background: '#52c41a', borderColor: '#52c41a' } : {}}
//                     >
//                         {selectedRowKeys.size > 0 ? 'Xuất bài đã chọn (Excel)' : 'Xuất tất cả (Excel)'}
//                     </Button>
//                 </Space>
//             </div>
//             {articles.length > 0 ? (
//                 <>  
//                     <div style={{ marginBottom: '16px', padding: '8px 16px', background: '#fafafa', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
//                         <Checkbox checked={isAllSelected} onChange={onSelectAll}>
//                             <Text strong style={{ marginLeft: 8 }}>Chọn tất cả bài viết trên trang này</Text>
//                         </Checkbox>
//                     </div>
//                     <List
//                         itemLayout="vertical"
//                         size="large"
//                         dataSource={articles}
//                         renderItem={(item) => (
//                             <ArticleItem 
//                                 key={item.id} 
//                                 article={item} 
//                                 isSelected={selectedRowKeys.has(item.id)}
//                                 onToggleSelect={onToggleSelect}
//                             />
//                         )}
//                     />
//                     <div style={{ textAlign: 'center', marginTop: '24px' }}>
//                         <Pagination
//                             current={paginationInfo.page}
//                             pageSize={paginationInfo.limit}
//                             total={paginationInfo.total}
//                             onChange={handlePageChange}
//                             showSizeChanger={false}
//                         />
//                     </div>
//                 </>
//             ) : (
//                 <Empty description={error ? " " : "Không có bài báo nào được tìm thấy."}>
//                     <Link href="/model">
//                         <Button type="primary">Thực hiện tìm kiếm mới</Button>
//                     </Link>
//                 </Empty>
//             )}
//         </div>
//     );
// };

// const ArticleResultsPage = () => {
//     return (
//         <Suspense fallback={<div style={{ textAlign: 'center', padding: '100px' }}><Spin size="large" /></div>}>
//             <ArticleResultsContent />
//         </Suspense>
//     )
// }

// export default ArticleResultsPage;