import { auth } from "@/auth";
import { sendRequest } from "@/utils/api";
import { IArticle } from "@/types/next-auth";
import ArticleBody from "@/components/client/article/ArticleBody";
import ArticleDetailBreadcrumb from "@/components/client/article/article.breadcrumb"; // Import component mới
import { Card, Result, Button } from "antd";
import Link from "next/link";

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
            <Result
                status="404"
                title="404"
                subTitle="Xin lỗi, bài viết bạn tìm kiếm không tồn tại."
                extra={<Link href="/model/article"><Button type="primary">Quay lại danh sách</Button></Link>}
            />
        );
    }

    return (
        <div>
            {/* Sử dụng Client Component cho Breadcrumb để có tính năng router.back() */}
            <ArticleDetailBreadcrumb title={article.title} />

            <Card>
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
                
                <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ marginTop: '16px', display: 'inline-block', marginLeft: 20 }}>
                    Xem bài viết gốc
                </a>
            </Card>
        </div>
    );
};

export default ArticleDetailPage;


// 'use client';

// import React, { useEffect, useState } from 'react';
// import { Card, Typography, Spin, Breadcrumb, Tag } from 'antd';
// import { HomeOutlined, ReadOutlined } from '@ant-design/icons';
// import Link from 'next/link';
// import { useSession } from 'next-auth/react';
// import { sendRequest } from '@/utils/api';
// import { IArticle } from '@/types/next-auth';
// import { useParams } from 'next/navigation';

// import { useChatbot } from '@/components/client/chatbot/chatbot.context';
// import ArticleBody from '@/components/client/article/ArticleBody';

// const { Title, Text } = Typography;

// const ArticleDetailPage = () => {
//     const [article, setArticle] = useState<IArticle | null>(null);
//     const [loading, setLoading] = useState(true);

//     const params = useParams();
//     const articleId = params.articleId as string;

//     const { data: session, status } = useSession();

//     const { setPageContext } = useChatbot();

//     useEffect(() => {
//         if (status !== 'authenticated' || !articleId || articleId === 'undefined') {
//             if (status !== 'loading') {
//                 setLoading(false);
//             }
//             return;
//         }

//         setPageContext({ article_id: articleId });

//         const fetchArticleDetails = async () => {
//             const res = await sendRequest<IArticle>({
//                 url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/article/${articleId}`,
//                 method: 'GET',
//                 session: session
//             });

//             if (res?.data) {
//                 setArticle(res.data);
//             }
//             setLoading(false);
//         };

//         fetchArticleDetails();

//         return () => {
//             setPageContext(null);
//         };

//     }, [articleId, session, status, setPageContext]);

//     const breadcrumbItems = [
//         {
//             title: <Link href="/model"><HomeOutlined /></Link>,
//         },
//         {
//             title: <Link href="/model/article"><span><ReadOutlined /> Bài báo</span></Link>,
//         },
//         {
//             title: article ? <span>{article.title}</span> : <Spin size="small" />,
//         },
//     ];

//     if (loading) {
//         return <div style={{ textAlign: 'center', padding: '100px' }}><Spin size="large" /></div>;
//     }

//     if (!article) {
//         return <Title level={3}>Không tìm thấy bài báo</Title>;
//     }

//     return (
//         <div>
//             <Breadcrumb items={breadcrumbItems} style={{ marginBottom: '16px' }} />
//             <Card>
//                 <Title level={2}>{article.title}</Title>
//                 <div style={{ marginBottom: '20px' }}>
//                     <Text type="secondary">Ngày đăng: {new Date(article.publish_date).toLocaleDateString('vi-VN')}</Text>
//                     <Tag color="blue" style={{ marginLeft: '10px' }}>{article.website}</Tag>
//                 </div>

//                 <ArticleBody content={article.content || ''} />

//                 <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ marginTop: '16px', display: 'inline-block' }}>
//                     Xem bài viết gốc
//                 </a>
//             </Card>
//         </div>
//     );
// };

// export default ArticleDetailPage;




// // 'use client';

// // import React, { useEffect, useState } from 'react';
// // import { Card, Typography, Spin, Breadcrumb, Tag } from 'antd';
// // import { HomeOutlined, ReadOutlined } from '@ant-design/icons';
// // import Link from 'next/link';
// // import { useSession } from 'next-auth/react';
// // import { sendRequest } from '@/utils/api';
// // import { IArticle } from '@/types/next-auth';
// // import { useParams } from 'next/navigation';

// // const { Title, Paragraph, Text } = Typography;

// // const ArticleDetailPage = () => {
// //     const [article, setArticle] = useState<IArticle | null>(null);
// //     const [loading, setLoading] = useState(true);

// //     const params = useParams();
// //     const articleId = params.articleId as string;

// //     const { data: session, status } = useSession(); // Lấy cả `status`

// //     useEffect(() => {
// //         // --- Guard Clause cực kỳ nghiêm ngặt ---
// //         // 1. Chỉ chạy khi status không còn là 'loading'
// //         // 2. Yêu cầu status phải là 'authenticated' (đã đăng nhập)
// //         // 3. Yêu cầu articleId phải là một chuỗi hợp lệ
// //         if (status !== 'authenticated' || !articleId || articleId === 'undefined') {
// //             // Nếu status đã xác định (không phải loading) nhưng vẫn không đủ điều kiện,
// //             // thì dừng loading để hiển thị "Không tìm thấy".
// //             if (status !== 'loading') {
// //                 setLoading(false);
// //             }
// //             return; // Dừng effect ngay lập tức
// //         }

// //         const fetchArticleDetails = async () => {
// //             // Không cần setLoading(true) ở đây vì đã set ở state ban đầu
// //             const res = await sendRequest<IArticle>({
// //                 url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/article/${articleId}`,
// //                 method: 'GET',
// //                 session: session // session ở đây chắc chắn tồn tại
// //             });

// //             if (res?.data) {
// //                 setArticle(res.data);
// //             }
// //             setLoading(false);
// //         };

// //         fetchArticleDetails();

// //     }, [articleId, session, status]); // Thêm `status` vào dependency array

// //     const breadcrumbItems = [
// //         {
// //             title: <Link href="/model"><HomeOutlined /></Link>,
// //         },
// //         {
// //             title: <Link href="/model/article"><span><ReadOutlined /> Bài báo</span></Link>,
// //         },
// //         {
// //             title: article ? <span>{article.title}</span> : <Spin size="small" />,
// //         },
// //     ];

// //     if (loading) {
// //         return <div style={{ textAlign: 'center', padding: '100px' }}><Spin size="large" /></div>;
// //     }

// //     if (!article) {
// //         return <Title level={3}>Không tìm thấy bài báo</Title>;
// //     }

// //     return (
// //         <div>
// //             <Breadcrumb items={breadcrumbItems} style={{ marginBottom: '16px' }} />
// //             <Card>
// //                 <Title level={2}>{article.title}</Title>
// //                 <div style={{ marginBottom: '20px' }}>
// //                     <Text type="secondary">Ngày đăng: {new Date(article.publish_date).toLocaleDateString('vi-VN')}</Text>
// //                     <Tag color="blue" style={{ marginLeft: '10px' }}>{article.website}</Tag>
// //                 </div>
// //                 <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
// //                     {article.content}
// //                 </Paragraph>
// //                 <a href={article.url} target="_blank" rel="noopener noreferrer">Xem bài viết gốc</a>
// //             </Card>
// //         </div>
// //     );
// // };

// // export default ArticleDetailPage;

