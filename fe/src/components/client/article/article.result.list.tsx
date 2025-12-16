'use client';

import React, { useEffect, useState, useRef, useMemo, useContext } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { 
    Breadcrumb, Empty, Button, Pagination, notification, Checkbox, 
    Space, Badge, Typography, Spin, Select, Card, Row, Col, Statistic, Progress, Flex, theme, Avatar, Tooltip, Tag
} from 'antd';
import { 
    HomeOutlined, ReadOutlined, FileExcelOutlined, LoadingOutlined, 
    SortAscendingOutlined, SortDescendingOutlined,
    PieChartOutlined, DatabaseOutlined, SyncOutlined,
    GlobalOutlined, ThunderboltFilled, CheckCircleFilled, FilterOutlined
} from '@ant-design/icons';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { IArticle } from '@/types/next-auth';
import ArticleItem from '@/components/client/article/article.item';
import { useChatbot } from '@/components/client/chatbot/chatbot.context';
import { sendRequest } from '@/utils/api';
import { ClientContext } from '@/components/client/layout/client.context';

const { Text, Title, Paragraph } = Typography;

interface IProps {
    articles: IArticle[];
    meta: {
        current: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
    searchId: string | null;
}

interface ISSEData {
    search_id: string;
    status: 'processing' | 'completed' | 'failed';
    total_saved: number;
    timestamp?: string;
}

interface IArticleHistoryResponse {
    data: IArticle[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

const StatCard = ({ title, value, icon, color, subTitle }: { title: string, value: number | string, icon: React.ReactNode, color: string, subTitle?: React.ReactNode }) => {
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
                {subTitle && <div style={{ marginTop: 4 }}>{subTitle}</div>}
            </Flex>
        </Card>
    );
};

const ArticleResultList = (props: IProps) => {
    const { articles: initialArticles, meta: initialMeta, searchId } = props;
    const { data: session } = useSession();
    const { token } = theme.useToken();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    
    const clientContext = useContext(ClientContext);
    const searchHistory = clientContext?.searchHistory || [];

    const [localArticles, setLocalArticles] = useState<IArticle[]>(initialArticles || []);
    const [localMeta, setLocalMeta] = useState(initialMeta || { current: 1, pageSize: 5, total: 0, totalPages: 0 });
    const [isProcessing, setIsProcessing] = useState<boolean>(true);
    const [streamMessage, setStreamMessage] = useState<string>("Đang khởi tạo kết nối...");
    const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
    const [isExporting, setIsExporting] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ sortBy: string, sortOrder: 'asc' | 'desc' }>({
        sortBy: 'publish_date',
        sortOrder: 'desc'
    });

    const { setPageContext } = useChatbot();
    const metaRef = useRef(localMeta);
    const articlesRef = useRef(localArticles);

    useEffect(() => {
        metaRef.current = localMeta;
        articlesRef.current = localArticles;
    }, [localMeta, localArticles]);

    useEffect(() => {
        if (initialArticles) setLocalArticles(initialArticles);
        if (initialMeta) setLocalMeta(initialMeta);
    }, [initialArticles, initialMeta]);

    useEffect(() => {
        if (searchId) {
            setPageContext({ 
                current_page: 'list_page', 
                search_id: searchId,
                sort_by: sortConfig.sortBy,
                sort_order: sortConfig.sortOrder
            });
        } else {
            setPageContext({ current_page: 'home_page' });
        }
    }, [searchId, setPageContext, sortConfig]);

    useEffect(() => {
        setSelectedRowKeys(new Set());
    }, [localArticles]);

    const stats = useMemo(() => {
        const positive = localArticles.filter(a => Number(a.ai_sentiment_score || 0) > 0).length;
        const negative = localArticles.filter(a => Number(a.ai_sentiment_score || 0) < 0).length;
        const neutral = localArticles.length - positive - negative;
        const sources = new Set(localArticles.map(a => a.website)).size;
        
        const total = localArticles.length || 1;
        const posPercent = Math.round((positive / total) * 100);
        const neuPercent = Math.round((neutral / total) * 100);
        const negPercent = 100 - posPercent - neuPercent;

        return { positive, negative, neutral, sources, posPercent, neuPercent, negPercent };
    }, [localArticles]);

    const displayedArticles = useMemo(() => {
        const sorted = [...localArticles];
        sorted.sort((a, b) => {
            if (sortConfig.sortBy === 'publish_date') {
                const dateA = new Date(a.publish_date).getTime();
                const dateB = new Date(b.publish_date).getTime();
                return sortConfig.sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
            } else if (sortConfig.sortBy === 'sentiment') {
                const scoreA = a.ai_sentiment_score ?? 0;
                const scoreB = b.ai_sentiment_score ?? 0;
                return sortConfig.sortOrder === 'asc' ? scoreA - scoreB : scoreB - scoreA;
            }
            return 0;
        });
        return sorted;
    }, [localArticles, sortConfig]);

    const handleSortChange = (value: string) => {
        const [sortBy, sortOrder] = value.split('-');
        setSortConfig({ sortBy, sortOrder: sortOrder as 'asc' | 'desc' });
    };

    useEffect(() => {
        if (!searchId || !session?.access_token) return;

        let isMounted = true;
        const controller = new AbortController();
        const { signal } = controller;

        const streamUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/article/stream-status/${searchId}`;

        const fetchStream = async () => {
            const currentHistoryItem = searchHistory.find(item => item.search_id === searchId);

            if (currentHistoryItem?.status === 'completed') {
                if (isMounted) {
                    setIsProcessing(false);
                    setStreamMessage("Đã hoàn tất");
                }
                return;
            }
            
            if (isMounted) {
                setIsProcessing(true);
                setStreamMessage("Đang quét dữ liệu mới...");
            }

            try {
                const response = await fetch(streamUrl, {
                    headers: { 'Authorization': `Bearer ${session.access_token}`, 'Accept': 'text/event-stream' },
                    signal: signal,
                });

                if (!response.ok) {
                    if (isMounted) {
                        if (localArticles.length > 0) {
                            setIsProcessing(false);
                            setStreamMessage("Kết nối gián đoạn");
                        } else {
                            setStreamMessage("Đang đợi dữ liệu...");
                        }
                    }
                    return;
                }

                if (!response.body) throw new Error("ReadableStream not supported.");

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (isMounted) {
                    const { value, done } = await reader.read();
                    if (done) {
                        if (isMounted) {
                            setIsProcessing(false);
                            setStreamMessage("Hoàn tất");
                        }
                        break;
                    }

                    const chunk = decoder.decode(value, { stream: true });
                    buffer += chunk;
                    const lines = buffer.split('\n\n');
                    buffer = lines.pop() || ''; 

                    for (const line of lines) {
                        const dataMatch = line.match(/data: (.*)/);
                        if (dataMatch) {
                            const jsonStr = dataMatch[1].trim();
                            if (!jsonStr) continue;

                            let data: ISSEData;
                            try { data = JSON.parse(jsonStr); } catch (e) { continue; }
                            
                            if (data.status === 'completed') {
                                if (isMounted) {
                                    setIsProcessing(false);
                                    setStreamMessage("Hoàn tất thu thập");
                                    if (clientContext?.setSearchHistory) {
                                        clientContext.setSearchHistory(prev => 
                                            prev.map(item => item.search_id === searchId ? { ...item, status: 'completed' } : item)
                                        );
                                    }
                                }
                                controller.abort();
                                return;
                            }

                            if (isMounted && data.total_saved > 0) {
                                setLocalMeta(prev => {
                                    if (prev.total !== data.total_saved) {
                                        return {
                                            ...prev,
                                            total: data.total_saved,
                                            totalPages: Math.ceil(data.total_saved / prev.pageSize)
                                        };
                                    }
                                    return prev;
                                });
                            }

                            const currentMeta = metaRef.current;
                            const currentArticles = articlesRef.current;
                            if (isMounted && currentArticles.length < currentMeta.pageSize && data.total_saved > ((currentMeta.current - 1) * currentMeta.pageSize + currentArticles.length)) {
                                const resArticles = await sendRequest<IArticleHistoryResponse>({
                                    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/article/search-history/${searchId}?page=${currentMeta.current}&limit=${currentMeta.pageSize}`,
                                    method: 'GET',
                                    session: session,
                                });

                                if (resArticles.data) {
                                    setLocalArticles(resArticles.data.data);
                                    setLocalMeta({
                                        current: resArticles.data.page,
                                        pageSize: resArticles.data.limit,
                                        total: resArticles.data.total,
                                        totalPages: resArticles.data.totalPages
                                    });
                                }
                            }
                            
                            if (isMounted) setStreamMessage(`Đã tìm thấy: ${data.total_saved} bài viết...`);
                        }
                    }
                }

            } catch (error: any) {
                if (error.name !== 'AbortError' && isMounted) {
                    if (localArticles.length > 0) setIsProcessing(false);
                    else setStreamMessage("Mất kết nối máy chủ");
                }
            }
        };

        fetchStream();
        return () => { isMounted = false; controller.abort(); };
    }, [searchId, session, searchHistory]);

    const handlePageChange = (page: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('page', page.toString());
        router.push(`${pathname}?${params.toString()}`);
    };

    const onToggleSelect = (id: string) => {
        const newSelection = new Set(selectedRowKeys);
        if (newSelection.has(id)) newSelection.delete(id);
        else newSelection.add(id);
        setSelectedRowKeys(newSelection);
    };

    const onSelectAll = (e: any) => {
        if (e.target.checked) setSelectedRowKeys(new Set(localArticles.map(a => a.id || a._id)));
        else setSelectedRowKeys(new Set());
    };

    const isAllSelected = localArticles.length > 0 && localArticles.every(a => selectedRowKeys.has(a.id || a._id));

    const handleExport = async () => {
        if (!session) return;
        setIsExporting(true);
        try {
            const token = session.access_token;
            let url = '';
            let options: RequestInit = { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } };
            let fileName = 'Export.xlsx';

            if (selectedRowKeys.size > 0) {
                notification.info({ title: 'Đang chuẩn bị...', description: `Đang xuất ${selectedRowKeys.size} bài viết.` });
                url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/article/export/selected`;
                options = {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ articleIds: Array.from(selectedRowKeys) })
                };
                fileName = `Export_Selection_${dayjs().format('DDMMYYYY')}.xlsx`;
            } else if (searchId) {
                notification.info({ title: 'Đang chuẩn bị...', description: 'Đang xuất toàn bộ danh sách.' });
                url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/article/export/${searchId}`;
                fileName = `Export_All_${searchId}.xlsx`;
            }

            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`Lỗi ${response.status}`);
            
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = downloadUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            a.remove();
            notification.success({ title: 'Tải xuống thành công!' });

        } catch (error: any) {
            notification.error({ title: 'Xuất file thất bại', description: error.message });
        } finally {
            setIsExporting(false);
        }
    };

    const dayjs = require('dayjs');

    const breadcrumbItems = [
        { title: <Link href="/model"><HomeOutlined /></Link> },
        { title: <span style={{ fontWeight: 500 }}>Kết quả tìm kiếm</span> },
    ];

    return (
        <div style={{ maxWidth: 1300, margin: '0 auto', paddingBottom: 60 }}>
            <Flex justify="space-between" align="end" style={{ marginBottom: 24 }}>
                <div>
                    <Breadcrumb items={breadcrumbItems} style={{ marginBottom: 12 }} />
                    <Title level={2} style={{ margin: 0, fontWeight: 700, letterSpacing: '-0.5px' }}>
                        Tổng quan kết quả
                    </Title>
                    <Text type="secondary">
                        Tìm thấy <strong style={{ color: token.colorText }}>{localMeta.total}</strong> bài viết phù hợp với tiêu chí của bạn
                    </Text>
                </div>
            </Flex>

            {localArticles.length > 0 && (
                <Row gutter={[20, 20]} style={{ marginBottom: 32 }}>
                    <Col xs={24} sm={8} lg={6}>
                        <StatCard 
                            title="Tổng bài viết" 
                            value={localMeta.total} 
                            icon={<DatabaseOutlined />} 
                            color={token.colorPrimary}
                            subTitle={
                                isProcessing ? 
                                <Space size={4} style={{ fontSize: 12, color: token.colorSuccess }}>
                                    <SyncOutlined spin /> Đang cập nhật
                                </Space> : null
                            }
                        />
                    </Col>
                    <Col xs={24} sm={8} lg={6}>
                        <StatCard 
                            title="Nguồn tin" 
                            value={stats.sources} 
                            icon={<GlobalOutlined />} 
                            color="#13c2c2"
                        />
                    </Col>
                    <Col xs={24} sm={24} lg={12}>
                        <Card 
                            variant="borderless" 
                            style={{ 
                                height: '100%', 
                                background: token.colorBgContainer,
                                boxShadow: token.boxShadowTertiary,
                                borderRadius: 16
                            }}
                            styles={{ body: { padding: '20px 24px' } }}
                        >
                            <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
                                <Flex align="center" gap={8}>
                                    <div style={{ padding: 8, borderRadius: '50%', background: '#fff7e6', color: '#fa8c16' }}>
                                        <PieChartOutlined style={{ fontSize: 18 }} />
                                    </div>
                                    <Text type="secondary" style={{ fontSize: 13, fontWeight: 500, textTransform: 'uppercase' }}>Phân tích cảm xúc</Text>
                                </Flex>
                            </Flex>
                            
                            <Flex vertical gap={8}>
                                <div style={{ display: 'flex', height: 12, borderRadius: 100, overflow: 'hidden' }}>
                                    <div style={{ flex: stats.positive, background: token.colorSuccess, transition: 'flex 0.5s' }} />
                                    <div style={{ flex: stats.neutral, background: token.colorWarning, transition: 'flex 0.5s' }} />
                                    <div style={{ flex: stats.negative, background: token.colorError, transition: 'flex 0.5s' }} />
                                </div>
                                <Flex justify="space-between" style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 4 }}>
                                    <Space><Badge color={token.colorSuccess} text={`Tích cực (${stats.positive})`} /></Space>
                                    <Space><Badge color={token.colorWarning} text={`Trung tính (${stats.neutral})`} /></Space>
                                    <Space><Badge color={token.colorError} text={`Tiêu cực (${stats.negative})`} /></Space>
                                </Flex>
                            </Flex>
                        </Card>
                    </Col>
                </Row>
            )}

            {isProcessing && (
                <div 
                    style={{ 
                        background: `linear-gradient(90deg, ${token.colorPrimaryBg}, #fff)`,
                        border: `1px solid ${token.colorPrimaryBorder}`,
                        borderRadius: 12,
                        padding: '12px 20px',
                        marginBottom: 24,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                    }}
                >
                    <div style={{ position: 'relative' }}>
                        <div style={{ 
                            position: 'absolute', inset: 0, borderRadius: '50%', 
                            background: token.colorPrimary, opacity: 0.2, animation: 'ping 1.5s infinite' 
                        }} />
                        <Avatar style={{ background: token.colorPrimary }} icon={<ThunderboltFilled />} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <Text strong style={{ fontSize: 15 }}>Hệ thống đang hoạt động</Text>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Text type="secondary" style={{ fontSize: 13 }}>{streamMessage}</Text>
                            <Progress 
                                percent={99} 
                                status="active" 
                                showInfo={false} 
                                strokeColor={{ from: token.colorPrimary, to: token.colorSuccess }}
                                size={[100, 6]} 
                            />
                        </div>
                    </div>
                    <style jsx>{`
                        @keyframes ping {
                            0% { transform: scale(1); opacity: 0.2; }
                            75% { transform: scale(1.5); opacity: 0; }
                            100% { transform: scale(1.5); opacity: 0; }
                        }
                    `}</style>
                </div>
            )}

            <div style={{ 
                position: 'sticky', 
                top: 20, 
                zIndex: 100, 
                marginBottom: 24 
            }}>
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
                        <Space size="middle">
                            <Checkbox 
                                checked={isAllSelected} 
                                onChange={onSelectAll} 
                                disabled={localArticles.length === 0}
                                style={{ fontSize: 14, fontWeight: 500 }}
                            >
                                Chọn tất cả
                            </Checkbox>
                            
                            <Select
                                defaultValue="publish_date-desc"
                                style={{ width: 190 }}
                                variant="borderless"
                                onChange={handleSortChange}
                                suffixIcon={<FilterOutlined style={{ color: token.colorTextSecondary }} />}
                                options={[
                                    { value: 'publish_date-desc', label: 'Mới nhất trước' },
                                    { value: 'publish_date-asc', label: 'Cũ nhất trước' },
                                    { value: 'sentiment-desc', label: 'Tích cực giảm dần' },
                                    { value: 'sentiment-asc', label: 'Tiêu cực giảm dần' },
                                ]}
                                styles={{ popup: { root: { borderRadius: 12, padding: 8 } } }}
                            />
                        </Space>

                        <Space>
                            {selectedRowKeys.size > 0 && (
                                <Tag color="blue" style={{ margin: 0, padding: '4px 10px', fontSize: 13, borderRadius: 20 }}>
                                    Đã chọn {selectedRowKeys.size} bài
                                </Tag>
                            )}
                            <Button
                                type={selectedRowKeys.size > 0 ? "primary" : "default"}
                                icon={<FileExcelOutlined />}
                                loading={isExporting}
                                onClick={handleExport}
                                disabled={isExporting || (localArticles.length === 0)}
                                shape="round"
                                style={selectedRowKeys.size > 0 ? { 
                                    background: `linear-gradient(135deg, ${token.colorSuccess}, #52c41a)`, 
                                    border: 'none',
                                    boxShadow: '0 4px 10px rgba(82, 196, 26, 0.3)'
                                } : {}}
                            >
                                {selectedRowKeys.size > 0 ? 'Xuất lựa chọn' : 'Xuất Excel'}
                            </Button>
                        </Space>
                    </Flex>
                </Card>
            </div>

            {localArticles.length > 0 || isProcessing ? (
                <div className="article-list-animate">
                    <Flex vertical gap={20}>
                        {displayedArticles.map((item) => (
                            <div key={item.id || item._id} style={{ transition: 'all 0.3s' }}>
                                <ArticleItem
                                    article={item}
                                    isSelected={selectedRowKeys.has(item.id || item._id)}
                                    onToggleSelect={onToggleSelect}
                                />
                            </div>
                        ))}
                    </Flex>

                    {isProcessing && localArticles.length < localMeta.pageSize && (
                        <div style={{ textAlign: 'center', padding: '40px', marginTop: 20, opacity: 0.7 }}>
                            <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} />
                            <div style={{ marginTop: 12, color: token.colorTextSecondary }}>Đang tải thêm bài viết...</div>
                        </div>
                    )}

                    <Flex justify="center" style={{ marginTop: 48 }}>
                        <Pagination
                            current={localMeta.current}
                            pageSize={localMeta.pageSize}
                            total={localMeta.total}
                            onChange={handlePageChange}
                            showSizeChanger={false}
                            itemRender={(_, type, originalElement) => {
                                if (type === 'prev') return <Button type="text">Trước</Button>;
                                if (type === 'next') return <Button type="text">Sau</Button>;
                                return originalElement;
                            }}
                        />
                    </Flex>
                </div>
            ) : (
                <Empty 
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                        <Flex vertical align="center" gap={16}>
                            <Title level={4} style={{ margin: 0 }}>Chưa có dữ liệu</Title>
                            <Text type="secondary" style={{ maxWidth: 400, textAlign: 'center' }}>
                                Chúng tôi không tìm thấy bài báo nào khớp với yêu cầu của bạn. Hãy thử thay đổi bộ lọc hoặc từ khóa.
                            </Text>
                            <Link href="/model">
                                <Button type="primary" size="large" icon={<SyncOutlined />}>Tạo tìm kiếm mới</Button>
                            </Link>
                        </Flex>
                    }
                    style={{ 
                        background: token.colorBgContainer, 
                        padding: '60px 20px', 
                        borderRadius: 16,
                        boxShadow: token.boxShadowTertiary 
                    }}
                />
            )}
        </div>
    );
};

export default ArticleResultList;