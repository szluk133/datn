'use client';

import React, { useEffect, useState, useRef, useMemo, useContext } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { 
    Breadcrumb, Empty, Button, Pagination, notification, Checkbox, 
    Space, Badge, Typography, Spin, Select, Card, Row, Col, Progress, Flex, theme, Avatar, Tooltip, Tag, Divider
} from 'antd';
import { 
    HomeOutlined, FileExcelOutlined, LoadingOutlined, 
    PieChartOutlined, DatabaseOutlined, SyncOutlined,
    GlobalOutlined, ThunderboltFilled, FilterOutlined,
    BarChartOutlined
} from '@ant-design/icons';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { IArticle } from '@/types/next-auth';
import ArticleItem from '@/components/client/article/article.item';
import { useChatbot } from '@/components/client/chatbot/chatbot.context';
import { sendRequest } from '@/utils/api';
import { ClientContext } from '@/components/client/layout/client.context';
import { SentimentStats } from '@/app/model/article/page'; 
import dayjs from 'dayjs';

const { Text, Title } = Typography;

interface IProps {
    articles: IArticle[];
    meta: {
        current: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
    searchId: string | null;
    sentimentStats?: SentimentStats;
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
    sentiment_stats?: SentimentStats;
}

// --- Components Thống kê được nâng cấp ---

const StatCard = ({ title, value, icon, gradient, subTitle }: { title: string, value: number | string, icon: React.ReactNode, gradient: string, subTitle?: React.ReactNode }) => {
    return (
        <Card 
            variant="borderless"
            style={{ 
                height: '100%', 
                background: '#fff',
                boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)',
                borderRadius: 24,
                position: 'relative',
                overflow: 'hidden',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease'
            }}
            hoverable
            styles={{ body: { padding: '24px' } }}
        >
            {/* Background decoration */}
            <div style={{ 
                position: 'absolute', top: -20, right: -20, 
                width: 120, height: 120, borderRadius: '50%',
                background: gradient, opacity: 0.1, filter: 'blur(20px)'
            }} />
            
            <Flex vertical gap={12} style={{ position: 'relative', zIndex: 1 }}>
                <Flex align="center" gap={12}>
                    <div style={{ 
                        padding: 10, borderRadius: 14, 
                        background: gradient, color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}>
                        {React.cloneElement(icon as React.ReactElement<any>, { style: { fontSize: 20 } })}
                    </div>
                    <Text type="secondary" style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</Text>
                </Flex>
                <div>
                    <Title level={2} style={{ margin: 0, fontWeight: 700, fontSize: 36 }}>
                        {value}
                    </Title>
                    {subTitle && <div style={{ marginTop: 8 }}>{subTitle}</div>}
                </div>
            </Flex>
        </Card>
    );
};

const SourceStatCard = ({ sources }: { sources: string[] }) => {
    const gradient = "linear-gradient(135deg, #13c2c2, #36cfc9)";
    
    return (
        <Card 
            variant="borderless"
            style={{ 
                height: '100%', 
                background: '#fff',
                boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)',
                borderRadius: 24,
                position: 'relative',
                overflow: 'hidden'
            }}
            hoverable
            styles={{ body: { padding: '24px' } }}
        >
            <div style={{ 
                position: 'absolute', bottom: -30, right: -20, 
                fontSize: 120, color: '#13c2c2', opacity: 0.05
            }}>
                <GlobalOutlined />
            </div>

            <Flex vertical gap={16} style={{ height: '100%' }}>
                <Flex align="center" gap={12}>
                    <div style={{ 
                        padding: 10, borderRadius: 14, 
                        background: gradient, color: '#fff',
                        display: 'flex', boxShadow: '0 4px 12px rgba(19, 194, 194, 0.3)'
                    }}>
                        <GlobalOutlined style={{ fontSize: 20 }} />
                    </div>
                    <Text type="secondary" style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Nguồn tin ({sources.length})
                    </Text>
                </Flex>
                
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }} className="custom-scrollbar">
                    {sources.length > 0 ? (
                        <Flex wrap="wrap" gap={8}>
                            {sources.map((source, idx) => (
                                <Tag key={idx} style={{ 
                                    margin: 0, padding: '4px 10px', borderRadius: 8, border: 'none',
                                    background: '#e6fffb', color: '#006d75', fontSize: 13
                                }}>
                                    {source}
                                </Tag>
                            ))}
                        </Flex>
                    ) : (
                        <Flex justify="center" align="center" style={{ height: '100%' }}>
                            <Text type="secondary" italic>Đang cập nhật...</Text>
                        </Flex>
                    )}
                </div>
            </Flex>
        </Card>
    );
};

const SentimentSection = ({ 
    title, stats, icon, color, token
}: { 
    title: string, stats: { positive: number, negative: number, neutral: number }, icon: React.ReactNode, color: string, token: any
}) => {
    const total = stats.positive + stats.negative + stats.neutral || 1;
    const posPercent = (stats.positive / total) * 100;
    const neuPercent = (stats.neutral / total) * 100;
    const negPercent = (stats.negative / total) * 100;

    return (
        <div style={{ width: '100%' }}>
            <Flex align="center" gap={8} style={{ marginBottom: 12 }}>
                <div style={{ color: color }}>{icon}</div>
                <Text style={{ fontSize: 14, fontWeight: 600, color: token.colorTextHeading }}>{title}</Text>
            </Flex>
            
            <Flex vertical gap={10}>
                <div style={{ 
                    display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)'
                }}>
                    <Tooltip title={`Tích cực: ${stats.positive} (${posPercent.toFixed(1)}%)`}>
                        <div style={{ width: `${posPercent}%`, background: token.colorSuccess, transition: 'width 1s ease-in-out' }} />
                    </Tooltip>
                    <Tooltip title={`Trung tính: ${stats.neutral} (${neuPercent.toFixed(1)}%)`}>
                        <div style={{ width: `${neuPercent}%`, background: token.colorWarning, transition: 'width 1s ease-in-out' }} />
                    </Tooltip>
                    <Tooltip title={`Tiêu cực: ${stats.negative} (${negPercent.toFixed(1)}%)`}>
                        <div style={{ width: `${negPercent}%`, background: token.colorError, transition: 'width 1s ease-in-out' }} />
                    </Tooltip>
                </div>
                <Flex justify="space-between" style={{ fontSize: 12 }}>
                    <Badge color={token.colorSuccess} text={<span style={{ color: token.colorTextSecondary }}>Tích cực: <b>{stats.positive}</b></span>} />
                    <Badge color={token.colorWarning} text={<span style={{ color: token.colorTextSecondary }}>Trung tính: <b>{stats.neutral}</b></span>} />
                    <Badge color={token.colorError} text={<span style={{ color: token.colorTextSecondary }}>Tiêu cực: <b>{stats.negative}</b></span>} />
                </Flex>
            </Flex>
        </div>
    );
};

const ArticleResultList = (props: IProps) => {
    const { articles: initialArticles, meta: initialMeta, searchId, sentimentStats: initialStats } = props;
    const { data: session } = useSession();
    const { token } = theme.useToken();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    
    const clientContext = useContext(ClientContext);
    const searchHistory = clientContext?.searchHistory || [];

    const [localArticles, setLocalArticles] = useState<IArticle[]>(initialArticles || []);
    const [localMeta, setLocalMeta] = useState(initialMeta || { current: 1, pageSize: 5, total: 0, totalPages: 0 });
    const [localStats, setLocalStats] = useState<SentimentStats | undefined>(initialStats);
    
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
        if (initialStats) setLocalStats(initialStats);
    }, [initialArticles, initialMeta, initialStats]);

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

    const globalSentiment = useMemo(() => {
        if (!localStats) return null;
        return {
            positive: localStats.positive,
            negative: localStats.negative,
            neutral: localStats.neutral
        };
    }, [localStats]);

    // Updated page sentiment to check labels
    const pageSentiment = useMemo(() => {
        let positive = 0;
        let negative = 0;
        let neutral = 0;

        localArticles.forEach(a => {
            const label = (a.ai_sentiment_label || '').toLowerCase();
            if (['tích cực', 'positive'].includes(label)) positive++;
            else if (['tiêu cực', 'negative'].includes(label)) negative++;
            else neutral++; // Count neutral or undefined as neutral for charts
        });

        return { positive, negative, neutral };
    }, [localArticles]);

    const sourceList = useMemo(() => {
        const sources = new Set(localArticles.map(a => a.website));
        return Array.from(sources);
    }, [localArticles]);

    // Sorting logic updated for Label prioritization
    const displayedArticles = useMemo(() => {
        const sorted = [...localArticles];
        sorted.sort((a, b) => {
            if (sortConfig.sortBy === 'publish_date') {
                const dateA = new Date(a.publish_date).getTime();
                const dateB = new Date(b.publish_date).getTime();
                return sortConfig.sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
            } else if (sortConfig.sortBy === 'sentiment') {
                // Map Label to numerical value for sorting: Positive (1), Neutral (0), Negative (-1)
                // Multiply by confidence score to break ties or weight them
                const getScore = (article: IArticle) => {
                    const label = (article.ai_sentiment_label || '').toLowerCase();
                    const confidence = article.ai_sentiment_score || 0;
                    
                    if (['tích cực', 'positive'].includes(label)) return 1 + confidence; // > 1
                    if (['tiêu cực', 'negative'].includes(label)) return -1 - confidence; // < -1
                    return 0; // Neutral around 0
                };

                const scoreA = getScore(a);
                const scoreB = getScore(b);
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
                                    if (resArticles.data.sentiment_stats) {
                                        setLocalStats(resArticles.data.sentiment_stats);
                                    }
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

    const breadcrumbItems = [
        { title: <Link href="/model"><HomeOutlined /></Link> },
        { title: <span style={{ fontWeight: 500 }}>Kết quả tìm kiếm</span> },
    ];

    return (
        <div style={{ maxWidth: 1300, margin: '0 auto', paddingBottom: 60 }}>
            {/* Styles for animation - Combined all keyframes here to avoid nested styled-jsx error */}
            <style jsx global>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .article-item-animate {
                    animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    opacity: 0;
                }
                @keyframes ping {
                    0% { transform: scale(1); opacity: 0.2; }
                    75% { transform: scale(1.4); opacity: 0; }
                    100% { transform: scale(1.4); opacity: 0; }
                }
            `}</style>

            <Flex justify="space-between" align="end" style={{ marginBottom: 28 }}>
                <div>
                    <Breadcrumb items={breadcrumbItems} style={{ marginBottom: 12 }} />
                    <Title level={2} style={{ margin: 0, fontWeight: 700, letterSpacing: '-0.5px', background: 'linear-gradient(45deg, #1f1f1f, #595959)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Tổng quan kết quả
                    </Title>
                    <Text type="secondary" style={{ fontSize: 15 }}>
                        Tìm thấy <strong style={{ color: token.colorPrimary, fontSize: 18 }}>{localMeta.total}</strong> bài viết phù hợp
                    </Text>
                </div>
            </Flex>

            {localArticles.length > 0 && (
                <Row gutter={[24, 24]} style={{ marginBottom: 36 }}>
                    <Col xs={24} sm={12} md={6} lg={6}>
                        <StatCard 
                            title="Tổng bài viết" 
                            value={localMeta.total} 
                            icon={<DatabaseOutlined />} 
                            gradient="linear-gradient(135deg, #40a9ff, #096dd9)"
                            subTitle={
                                isProcessing ? 
                                <Tag color="processing" icon={<SyncOutlined spin />}>Đang cập nhật</Tag> : null
                            }
                        />
                    </Col>
                    
                    <Col xs={24} sm={12} md={6} lg={6}>
                        <SourceStatCard sources={sourceList} />
                    </Col>

                    <Col xs={24} sm={24} md={12} lg={12}>
                        <Card 
                            variant="borderless"
                            style={{ 
                                height: '100%', 
                                background: '#fff',
                                boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)',
                                borderRadius: 24,
                            }}
                            styles={{ body: { padding: '24px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' } }}
                        >
                            <Row gutter={24}>
                                <Col span={12}>
                                    {globalSentiment ? (
                                        <SentimentSection
                                            title="Tổng quan cảm xúc"
                                            stats={globalSentiment}
                                            icon={<PieChartOutlined />}
                                            color="#fa8c16"
                                            token={token}
                                        />
                                    ) : (
                                        <div style={{ textAlign: 'center', color: token.colorTextDisabled }}>Chưa có dữ liệu</div>
                                    )}
                                </Col>
                                <Col span={1} style={{ display: 'flex', justifyContent: 'center' }}>
                                    <Divider orientation="vertical" style={{ height: '100%' }} />
                                </Col>
                                <Col span={11}>
                                    <SentimentSection
                                        title="Cảm xúc trang này"
                                        stats={pageSentiment}
                                        icon={<BarChartOutlined />}
                                        color="#722ed1"
                                        token={token}
                                    />
                                </Col>
                            </Row>
                        </Card>
                    </Col>
                </Row>
            )}

            {isProcessing && (
                <div 
                    style={{ 
                        background: 'rgba(255, 255, 255, 0.8)',
                        backdropFilter: 'blur(10px)',
                        border: `1px solid ${token.colorPrimaryBorder}`,
                        borderRadius: 16,
                        padding: '16px 24px',
                        marginBottom: 24,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 20,
                        boxShadow: '0 8px 30px rgba(0,0,0,0.08)'
                    }}
                >
                    <div style={{ position: 'relative' }}>
                        <div style={{ 
                            position: 'absolute', inset: -4, borderRadius: '50%', 
                            background: token.colorPrimary, opacity: 0.2, animation: 'ping 2s infinite' 
                        }} />
                        <Avatar size={48} style={{ background: `linear-gradient(135deg, ${token.colorPrimary}, #1890ff)` }} icon={<ThunderboltFilled style={{ fontSize: 24 }} />} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <Flex justify="space-between" align="center">
                            <Text strong style={{ fontSize: 16 }}>Hệ thống đang hoạt động</Text>
                            <Text type="secondary">{Math.round((localArticles.length / (localMeta.total || 1)) * 100)}%</Text>
                        </Flex>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                            <Text type="secondary" style={{ fontSize: 13 }}>{streamMessage}</Text>
                            <Progress 
                                percent={99} 
                                status="active" 
                                showInfo={false} 
                                strokeColor={{ from: token.colorPrimary, to: '#52c41a' }}
                                size={[0, 8]}
                                style={{ flex: 1 }}
                            />
                        </div>
                    </div>
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
                        boxShadow: '0 8px 24px rgba(0,0,0,0.06)', 
                        borderRadius: 16,
                        background: 'rgba(255, 255, 255, 0.85)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.3)'
                    }}
                    styles={{ body: { padding: '16px 24px' } }}
                >
                    <Flex justify="space-between" align="center" wrap="wrap" gap={16}>
                        <Space size="large">
                            <Checkbox 
                                checked={isAllSelected} 
                                onChange={onSelectAll} 
                                disabled={localArticles.length === 0}
                                style={{ fontSize: 15, fontWeight: 500 }}
                            >
                                Chọn tất cả
                            </Checkbox>
                            
                            <Divider orientation="vertical" />

                            <Flex align="center" gap={8}>
                                <Text type="secondary"><FilterOutlined /> Sắp xếp:</Text>
                                <Select
                                    defaultValue="publish_date-desc"
                                    style={{ width: 200 }}
                                    variant="borderless"
                                    onChange={handleSortChange}
                                    options={[
                                        { value: 'publish_date-desc', label: 'Mới nhất trước' },
                                        { value: 'publish_date-asc', label: 'Cũ nhất trước' },
                                        { value: 'sentiment-desc', label: 'Tích cực giảm dần' },
                                        { value: 'sentiment-asc', label: 'Tiêu cực giảm dần' },
                                    ]}
                                    popupMatchSelectWidth={false}
                                />
                            </Flex>
                        </Space>

                        <Space>
                            {selectedRowKeys.size > 0 && (
                                <span style={{ marginRight: 8, fontSize: 14, color: token.colorPrimary, fontWeight: 600 }}>
                                    Đã chọn: {selectedRowKeys.size}
                                </span>
                            )}
                            <Button
                                type={selectedRowKeys.size > 0 ? "primary" : "default"}
                                icon={<FileExcelOutlined />}
                                loading={isExporting}
                                onClick={handleExport}
                                disabled={isExporting || (localArticles.length === 0)}
                                shape="round"
                                size="large"
                                style={selectedRowKeys.size > 0 ? { 
                                    background: `linear-gradient(135deg, ${token.colorSuccess}, #52c41a)`, 
                                    border: 'none',
                                    boxShadow: '0 4px 15px rgba(82, 196, 26, 0.35)'
                                } : {}}
                            >
                                {selectedRowKeys.size > 0 ? 'Xuất lựa chọn' : 'Xuất Excel'}
                            </Button>
                        </Space>
                    </Flex>
                </Card>
            </div>

            {localArticles.length > 0 || isProcessing ? (
                <div>
                    <Flex vertical gap={24}>
                        {displayedArticles.map((item, index) => (
                            <div 
                                key={item.id || item._id} 
                                className="article-item-animate"
                                style={{ animationDelay: `${index * 0.05}s` }}
                            >
                                <ArticleItem
                                    article={item}
                                    isSelected={selectedRowKeys.has(item.id || item._id)}
                                    onToggleSelect={onToggleSelect}
                                />
                            </div>
                        ))}
                    </Flex>

                    {isProcessing && localArticles.length < localMeta.pageSize && (
                        <div style={{ textAlign: 'center', padding: '40px', marginTop: 20 }}>
                            <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} />
                            <div style={{ marginTop: 16, color: token.colorTextSecondary, fontWeight: 500 }}>Đang tải thêm dữ liệu...</div>
                        </div>
                    )}

                    <Flex justify="center" style={{ marginTop: 60 }}>
                        <Pagination
                            current={localMeta.current}
                            pageSize={localMeta.pageSize}
                            total={localMeta.total}
                            onChange={handlePageChange}
                            showSizeChanger={false}
                            itemRender={(_, type, originalElement) => {
                                if (type === 'prev') return <Button type="default" shape="round">Trước</Button>;
                                if (type === 'next') return <Button type="default" shape="round">Sau</Button>;
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
                                Chúng tôi không tìm thấy bài báo nào khớp với yêu cầu của bạn.
                            </Text>
                            <Link href="/model">
                                <Button type="primary" size="large" icon={<SyncOutlined />} shape="round">Tạo tìm kiếm mới</Button>
                            </Link>
                        </Flex>
                    }
                    style={{ 
                        background: '#fff', 
                        padding: '80px 20px', 
                        borderRadius: 24,
                        boxShadow: '0 10px 30px rgba(0,0,0,0.03)' 
                    }}
                />
            )}
        </div>
    );
};

export default ArticleResultList;