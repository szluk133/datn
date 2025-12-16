'use client';

import React, { useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { 
    Breadcrumb, Empty, Pagination, Typography, Button, Badge, Space, Flex, theme, Card, Row, Col, Input, Select, Tag
} from 'antd';
import { 
    HomeOutlined, StarFilled, SearchOutlined, DatabaseOutlined, 
    FilterOutlined, SortAscendingOutlined, SortDescendingOutlined,
    BookOutlined, AppstoreOutlined
} from '@ant-design/icons';
import Link from 'next/link';
import { IArticle } from '@/types/next-auth';
import ArticleItem from '@/components/client/article/article.item';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface IProps {
    articles: IArticle[];
    meta: {
        current: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}

const StatCard = ({ title, value, icon, color }: { title: string, value: number | string, icon: React.ReactNode, color: string }) => {
    const { token } = theme.useToken();
    return (
        <Card 
            variant="borderless"
            style={{ 
                height: '100%', 
                background: token.colorBgContainer,
                boxShadow: token.boxShadowTertiary,
                borderRadius: 16,
                position: 'relative',
                overflow: 'hidden'
            }}
            styles={{ body: { padding: '20px 24px' } }}
        >
            <div style={{ 
                position: 'absolute', top: -10, right: -10, 
                opacity: 0.1, transform: 'rotate(15deg)', 
                fontSize: 80, color: color 
            }}>
                {icon}
            </div>
            <Flex vertical gap={8}>
                <Flex align="center" gap={8}>
                    <div style={{ 
                        padding: 8, borderRadius: '50%', 
                        background: `${color}22`, color: color,
                        display: 'flex' 
                    }}>
                        {React.cloneElement(icon as React.ReactElement<any>, { style: { fontSize: 18 } })}
                    </div>
                    <Text type="secondary" style={{ fontSize: 13, fontWeight: 500, textTransform: 'uppercase' }}>{title}</Text>
                </Flex>
                <Title level={2} style={{ margin: 0, color: token.colorTextHeading }}>
                    {value}
                </Title>
            </Flex>
        </Card>
    );
};

const SavedArticleList = (props: IProps) => {
    const { token } = theme.useToken();
    const { articles, meta } = props;
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [searchText, setSearchText] = useState('');
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

    const isHomePage = pathname === '/model' || pathname === '/';

    const handlePageChange = (page: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('page', page.toString());
        router.push(`${pathname}?${params.toString()}`);
    };

    const filteredArticles = useMemo(() => {
        let result = [...articles];

        if (searchText) {
            const lower = searchText.toLowerCase();
            result = result.filter(a => 
                a.title?.toLowerCase().includes(lower) || 
                a.summary?.toLowerCase().includes(lower)
            );
        }

        result.sort((a, b) => {
            const dateA = dayjs(a.publish_date).valueOf();
            const dateB = dayjs(b.publish_date).valueOf();
            return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        });

        return result;
    }, [articles, searchText, sortOrder]);

    const breadcrumbItems = [
        { title: <Link href="/model"><HomeOutlined /></Link> },
        { title: <span style={{ fontWeight: 500 }}>Thư viện đã lưu</span> },
    ];

    const stats = useMemo(() => {
        const categories = new Set();
        articles.forEach(a => a.site_categories?.forEach(c => categories.add(c)));
        return {
            total: meta.total,
            categoriesCount: categories.size
        };
    }, [articles, meta.total]);

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>
            
            {!isHomePage && (
                <Flex justify="space-between" align="end" style={{ marginBottom: 24 }}>
                    <div>
                        <Breadcrumb items={breadcrumbItems} style={{ marginBottom: 12 }} />
                        <Title level={2} style={{ margin: 0, fontWeight: 700, letterSpacing: '-0.5px' }}>
                            Bộ sưu tập của tôi
                        </Title>
                        <Text type="secondary">
                            Quản lý <strong style={{ color: token.colorText }}>{meta.total}</strong> bài viết bạn đã đánh dấu quan trọng
                        </Text>
                    </div>
                    <Link href="/model/search">
                        <Button 
                            type="primary" 
                            size="large" 
                            icon={<SearchOutlined />}
                            shape="round"
                            style={{ 
                                boxShadow: '0 4px 14px rgba(24, 144, 255, 0.3)',
                                background: `linear-gradient(135deg, ${token.colorPrimary}, ${token.colorPrimaryActive})`,
                                border: 'none'
                            }}
                        >
                            Khám phá thêm
                        </Button>
                    </Link>
                </Flex>
            )}

            {articles.length > 0 && (
                <Row gutter={[20, 20]} style={{ marginBottom: 32 }}>
                    <Col xs={24} sm={12} md={8}>
                        <StatCard 
                            title="Đã lưu trữ" 
                            value={stats.total} 
                            icon={<StarFilled />} 
                            color="#faad14"
                        />
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                        <StatCard 
                            title="Chủ đề quan tâm" 
                            value={stats.categoriesCount || 0} 
                            icon={<AppstoreOutlined />} 
                            color="#722ed1"
                        />
                    </Col>
                    <Col xs={24} sm={24} md={8}>
                        <Card 
                            variant="borderless"
                            style={{ 
                                height: '100%', 
                                background: `linear-gradient(135deg, ${token.colorPrimaryBg}, #fff)`,
                                boxShadow: token.boxShadowTertiary,
                                borderRadius: 16,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <Flex vertical align="center" gap={12}>
                                <div style={{ 
                                    padding: 12, borderRadius: '50%', 
                                    background: '#fff', 
                                    boxShadow: token.boxShadowSecondary 
                                }}>
                                    <BookOutlined style={{ fontSize: 24, color: token.colorPrimary }} />
                                </div>
                                <Text type="secondary" style={{ textAlign: 'center' }}>
                                    "Kiến thức là kho báu, nhưng thực hành là chìa khóa."
                                </Text>
                            </Flex>
                        </Card>
                    </Col>
                </Row>
            )}

            {articles.length > 0 && (
                <div style={{ position: 'sticky', top: 20, zIndex: 100, marginBottom: 24 }}>
                    <Card
                        variant="borderless"
                        style={{ 
                            boxShadow: '0 8px 24px rgba(0,0,0,0.08)', 
                            borderRadius: 12,
                            backdropFilter: 'blur(10px)',
                            background: 'rgba(255, 255, 255, 0.95)'
                        }}
                        styles={{ body: { padding: '12px 20px' } }}
                    >
                        <Flex justify="space-between" align="center" wrap="wrap" gap={16}>
                            <Input 
                                prefix={<SearchOutlined style={{ color: token.colorTextPlaceholder }} />}
                                placeholder="Tìm trong danh sách đã lưu..." 
                                variant="filled"
                                allowClear
                                style={{ width: 300, borderRadius: 8 }}
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                            />
                            
                            <Space>
                                <Select
                                    value={sortOrder}
                                    onChange={setSortOrder}
                                    variant="borderless"
                                    style={{ width: 160 }}
                                    options={[
                                        { value: 'newest', label: <Space><SortDescendingOutlined /> Mới lưu gần đây</Space> },
                                        { value: 'oldest', label: <Space><SortAscendingOutlined /> Lưu lâu nhất</Space> },
                                    ]}
                                />
                                <Badge count={meta.total} color={token.colorPrimary} showZero>
                                    <Tag color="blue" style={{ margin: 0, borderRadius: 12 }}>Tổng số</Tag>
                                </Badge>
                            </Space>
                        </Flex>
                    </Card>
                </div>
            )}

            {articles.length > 0 ? (
                <>
                    {filteredArticles.length > 0 ? (
                        <Flex vertical gap={20}>
                            {filteredArticles.map((item) => (
                                <div key={item.id || item._id} style={{ transition: 'all 0.3s' }}>
                                    <ArticleItem
                                        article={item}
                                        initialIsSaved={true}
                                    />
                                </div>
                            ))}
                        </Flex>
                    ) : (
                        <Empty 
                            image={Empty.PRESENTED_IMAGE_SIMPLE} 
                            description="Không tìm thấy bài viết nào khớp với từ khóa." 
                        />
                    )}

                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 48 }}>
                        <Pagination
                            current={meta.current}
                            pageSize={meta.pageSize}
                            total={meta.total}
                            onChange={handlePageChange}
                            showSizeChanger={false}
                            showTotal={(total) => `Tổng cộng ${total} bài`}
                        />
                    </div>
                </>
            ) : (
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                        <Flex vertical align="center" gap={16}>
                            <Title level={4} style={{ margin: 0 }}>Thư viện trống</Title>
                            <Text type="secondary" style={{ maxWidth: 400, textAlign: 'center' }}>
                                Bạn chưa lưu bài viết nào. Hãy tìm kiếm và đánh dấu các bài viết thú vị để xem lại sau.
                            </Text>
                            <Link href="/model/search">
                                <Button 
                                    type="primary" 
                                    size="large" 
                                    icon={<SearchOutlined />} 
                                    style={{ marginTop: 8 }}
                                >
                                    Tìm kiếm bài viết ngay
                                </Button>
                            </Link>
                        </Flex>
                    }
                    style={{ 
                        background: token.colorBgContainer, 
                        padding: '80px 20px', 
                        borderRadius: 16, 
                        boxShadow: token.boxShadowTertiary 
                    }}
                />
            )}
        </div>
    );
};

export default SavedArticleList;