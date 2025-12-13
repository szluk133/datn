'use client';

import React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Breadcrumb, Empty, Pagination, Typography, Button, Badge, Space, Flex } from 'antd';
import { HomeOutlined, StarOutlined, SearchOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { IArticle } from '@/types/next-auth';
import ArticleItem from '@/components/client/article/article.item';

const { Title } = Typography;

interface IProps {
    articles: IArticle[];
    meta: {
        current: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}

const SavedArticleList = (props: IProps) => {
    const { articles, meta } = props;
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const isHomePage = pathname === '/model' || pathname === '/';

    const handlePageChange = (page: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('page', page.toString());
        router.push(`${pathname}?${params.toString()}`);
    };

    const breadcrumbItems = [
        { title: <Link href="/model"><HomeOutlined /></Link> },
        { title: <span><StarOutlined /> Bài viết đã lưu</span> },
    ];

    return (
        <div>
            {!isHomePage && (
                <div style={{ marginBottom: 16 }}>
                    <Breadcrumb items={breadcrumbItems} style={{ marginBottom: 16 }} />
                    <Title level={3}>Bài viết đã lưu của tôi</Title>
                </div>
            )}

            {articles.length > 0 && (
                <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center' }}>
                    <Badge count={meta.total} style={{ backgroundColor: '#1890ff' }} showZero>
                        <span style={{ marginRight: 8, fontWeight: 500, fontSize: 15, color: '#262626' }}>
                            Tổng số bài viết đã lưu
                        </span>
                    </Badge>
                </div>
            )}

            {articles.length > 0 ? (
                <>
                    {/* --- Thay List bằng Flex --- */}
                    <Flex vertical gap={16}>
                        {articles.map((item) => (
                            <ArticleItem
                                key={item.id || item._id}
                                article={item}
                                initialIsSaved={true}
                            />
                        ))}
                    </Flex>

                    <div style={{ textAlign: 'center', marginTop: '24px' }}>
                        <Pagination
                            current={meta.current}
                            pageSize={meta.pageSize}
                            total={meta.total}
                            onChange={handlePageChange}
                            showSizeChanger={false}
                        />
                    </div>
                </>
            ) : (
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                        <span style={{ fontSize: 16, color: '#888' }}>
                            Bạn chưa lưu bài viết nào.
                        </span>
                    }
                >
                    <Link href="/model/search">
                        <Button type="primary" icon={<SearchOutlined />}>
                            Tìm kiếm bài viết mới
                        </Button>
                    </Link>
                </Empty>
            )}
        </div>
    );
};

export default SavedArticleList;
