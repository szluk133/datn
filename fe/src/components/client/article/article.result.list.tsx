'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { List, Breadcrumb, Empty, Button, Pagination, notification, Checkbox, Space, Badge, Typography, Spin, Alert, Select } from 'antd';
import { HomeOutlined, ReadOutlined, FileExcelOutlined, LoadingOutlined, SyncOutlined, SortAscendingOutlined, SortDescendingOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { IArticle } from '@/types/next-auth';
import ArticleItem from '@/components/client/article/article.item';
import { useChatbot } from '@/components/client/chatbot/chatbot.context';
import { sendRequest } from '@/utils/api';

const { Text } = Typography;

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

const ArticleResultList = (props: IProps) => {
    const { articles: initialArticles, meta: initialMeta, searchId } = props;
    const { data: session } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    
    const [localArticles, setLocalArticles] = useState<IArticle[]>(initialArticles || []);
    const [localMeta, setLocalMeta] = useState(initialMeta || { current: 1, pageSize: 10, total: 0, totalPages: 0 });
    const [isProcessing, setIsProcessing] = useState<boolean>(true);
    const [streamMessage, setStreamMessage] = useState<string>("Đang kết nối luồng dữ liệu...");
    
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

    const getSortedArticles = () => {
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
    };
    
    const displayedArticles = getSortedArticles();

    const handleSortChange = (value: string) => {
        const [sortBy, sortOrder] = value.split('-');
        setSortConfig({
            sortBy: sortBy,
            sortOrder: sortOrder as 'asc' | 'desc'
        });
    };

    useEffect(() => {
        if (!searchId || !session?.access_token) return;

        let isMounted = true;
        const controller = new AbortController();
        const { signal } = controller;

        const streamUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/article/stream-status/${searchId}`;

        const fetchStream = async () => {
            try {
                console.log("Starting Fetch Stream:", streamUrl);
                setStreamMessage("Đang kết nối...");
                setIsProcessing(true);

                const response = await fetch(streamUrl, {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Accept': 'text/event-stream',
                    },
                    signal: signal,
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        setStreamMessage("Lỗi xác thực (401). Vui lòng đăng nhập lại.");
                    } else {
                        setStreamMessage(`Lỗi kết nối: ${response.status} ${response.statusText}`);
                    }
                    setIsProcessing(false);
                    return;
                }

                if (!response.body) throw new Error("ReadableStream not supported.");

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (isMounted) {
                    const { value, done } = await reader.read();
                    if (done) {
                        setIsProcessing(false);
                        setStreamMessage("Hoàn tất (Stream ended).");
                        break;
                    }

                    const chunk = decoder.decode(value, { stream: true });
                    buffer += chunk;

                    const lines = buffer.split('\n\n');
                    buffer = lines.pop() || ''; 

                    for (const line of lines) {
                        const dataMatch = line.match(/data: (.*)/);
                        const eventMatch = line.match(/event: (.*)/);

                        if (dataMatch) {
                            try {
                                const jsonStr = dataMatch[1].trim();
                                if (!jsonStr) continue;

                                const data: ISSEData = JSON.parse(jsonStr);
                                
                                const isEndEvent = eventMatch && eventMatch[1].trim() === 'end';
                                
                                if (isEndEvent || data.status === 'completed') {
                                    setIsProcessing(false);
                                    setStreamMessage("Hoàn tất.");
                                    controller.abort();
                                    return;
                                }

                                if (data.total_saved > 0) {
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
                                const expectedItems = (currentMeta.current - 1) * currentMeta.pageSize + currentArticles.length;
                                const isPageNotFull = currentArticles.length < currentMeta.pageSize;

                                if (isPageNotFull && data.total_saved > expectedItems) {
                                    console.log("Fetching new articles...");
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

                                setStreamMessage(`Đang xử lý... Đã tìm thấy ${data.total_saved} bài.`);

                            } catch (parseError) {
                                console.error("Error parsing stream data:", parseError);
                            }
                        }
                    }
                }

            } catch (error: any) {
                if (error.name === 'AbortError') {
                    console.log('Stream aborted');
                } else {
                    console.error("Stream Error:", error);
                    setStreamMessage("Mất kết nối tới máy chủ.");
                    setIsProcessing(false);
                }
            }
        };

        fetchStream();

        return () => {
            isMounted = false;
            controller.abort();
            console.log("Cleanup stream");
        };
    }, [searchId, session]);


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
                notification.info({ message: 'Đang xuất dữ liệu...', description: `Đang tải file Excel.` });
                url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/article/export/selected`;
                options = {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ articleIds: Array.from(selectedRowKeys) })
                };
                fileName = `Export_Selected_${new Date().getTime()}.xlsx`;
            } else if (searchId) {
                notification.info({ message: 'Đang xuất toàn bộ...', description: 'Đang tải file Excel.' });
                url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/article/export/${searchId}`;
                fileName = `Export_Full_${searchId}.xlsx`;
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
            notification.success({ message: 'Thành công' });

        } catch (error: any) {
            notification.error({ message: 'Thất bại', description: error.message });
        } finally {
            setIsExporting(false);
        }
    };

    const breadcrumbItems = [
        { title: <Link href="/model"><HomeOutlined /></Link> },
        { title: <span><ReadOutlined /> Kết quả tìm kiếm</span> },
    ];

    return (
        <div>
            {/* Header: Breadcrumb & Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <Breadcrumb items={breadcrumbItems} />
                <Space>
                    <Select
                        defaultValue="publish_date-desc"
                        style={{ width: 220 }}
                        onChange={handleSortChange}
                        options={[
                            { value: 'publish_date-desc', label: <span><SortDescendingOutlined /> Mới nhất trước</span> },
                            { value: 'publish_date-asc', label: <span><SortAscendingOutlined /> Cũ nhất trước</span> },
                            { value: 'sentiment-desc', label: <span><SortDescendingOutlined /> Cảm xúc tích cực nhất</span> },
                            { value: 'sentiment-asc', label: <span><SortAscendingOutlined /> Cảm xúc tiêu cực nhất</span> },
                        ]}
                    />
                    {selectedRowKeys.size > 0 && (
                        <Badge count={selectedRowKeys.size} style={{ backgroundColor: '#52c41a' }}>
                            <span style={{ marginRight: 8, fontWeight: 500, color: '#1890ff' }}>Đã chọn {selectedRowKeys.size} bài</span>
                        </Badge>
                    )}
                    <Button
                        type={selectedRowKeys.size > 0 ? "primary" : "default"}
                        icon={<FileExcelOutlined />}
                        loading={isExporting}
                        onClick={handleExport}
                        disabled={isExporting || (!searchId && selectedRowKeys.size === 0) || (localArticles.length === 0)}
                        style={selectedRowKeys.size > 0 ? { background: '#52c41a', borderColor: '#52c41a' } : {}}
                    >
                        {selectedRowKeys.size > 0 ? 'Xuất bài đã chọn (Excel)' : 'Xuất tất cả (Excel)'}
                    </Button>
                </Space>
            </div>

            {/* Trạng thái SSE / Processing */}
            {isProcessing && (
                <Alert
                    title={
                        <Space>
                            <SyncOutlined spin style={{ color: '#1890ff' }} />
                            <Text strong>{streamMessage}</Text>
                        </Space>
                    }
                    type="info"
                    showIcon={false}
                    style={{ marginBottom: 16, border: '1px solid #91caff', background: '#e6f7ff' }}
                />
            )}

            {/* Danh sách kết quả */}
            {localArticles.length > 0 || isProcessing ? (
                <>  
                    <div style={{ marginBottom: '16px', padding: '8px 16px', background: '#fafafa', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
                        <Checkbox checked={isAllSelected} onChange={onSelectAll} disabled={localArticles.length === 0}>
                            <Text strong style={{ marginLeft: 8 }}>Chọn tất cả bài viết trên trang này</Text>
                        </Checkbox>
                    </div>
                    
                    <Space
                        orientation="vertical"
                        size="large"
                        style={{ width: '100%' }}
                    >
                        {displayedArticles.map((item) => (
                            <ArticleItem
                                key={item.id || item._id}
                                article={item}
                                isSelected={selectedRowKeys.has(item.id || item._id)}
                                onToggleSelect={onToggleSelect}
                            />
                        ))}
                    </Space>

                    
                    {/* Hiển thị Spinner ở cuối nếu đang xử lý và danh sách chưa đầy */}
                    {isProcessing && localArticles.length < localMeta.pageSize && (
                        <div style={{ textAlign: 'center', padding: '20px', background: 'transparent', marginBottom: '24px' }}>
                            <Spin
                                indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />}
                                tip="Đang tải thêm bài viết..."
                            >
                                <div style={{ minHeight: 24 }} />
                            </Spin>
                        </div>
                    )}

                    <div style={{ textAlign: 'center', marginTop: '24px' }}>
                        <Pagination
                            current={localMeta.current}
                            pageSize={localMeta.pageSize}
                            total={localMeta.total}
                            onChange={handlePageChange}
                            showSizeChanger={false}
                        />
                    </div>
                </>
            ) : (
                <Empty description="Không có bài báo nào được tìm thấy.">
                    <Link href="/model">
                        <Button type="primary">Thực hiện tìm kiếm mới</Button>
                    </Link>
                </Empty>
            )}
        </div>
    );
};

export default ArticleResultList;