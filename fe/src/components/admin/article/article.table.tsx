'use client'

import React, { useEffect, useState, useRef } from 'react';
import { Table, Tag, Space, Button, Input, Select, Popconfirm, notification, Card, DatePicker, Row, Col, Slider, Typography } from 'antd';
import { SearchOutlined, DeleteOutlined, EyeInvisibleOutlined, EyeOutlined, FilterOutlined, ReloadOutlined } from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';
import { IAdminArticle, ITopic } from '@/types/next-auth';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import dayjs from 'dayjs';
import type { TablePaginationConfig, TableProps } from 'antd/es/table';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Text } = Typography;

interface IWebsite {
    _id: string;
    name: string;
    displayName: string;
}

interface IProps {
    articles: IAdminArticle[];
    websites: IWebsite[];
    meta: {
        current: number;
        pageSize: number;
        total: number;
    };
}

const convertByteIndexToCharIndex = (str: string, byteStart: number, byteLength: number) => {
    let currentByteCount = 0;
    let charStart = -1;
    let charEnd = -1;

    for (let i = 0; i < str.length; i++) {
        if (currentByteCount === byteStart) charStart = i;
        if (currentByteCount === byteStart + byteLength) {
            charEnd = i;
            break;
        }
        const code = str.charCodeAt(i);
        if (code <= 0x7f) currentByteCount += 1;
        else if (code <= 0x7ff) currentByteCount += 2;
        else if (code >= 0xd800 && code <= 0xdbff) { currentByteCount += 4; i++; }
        else currentByteCount += 3;
    }
    if (charStart !== -1 && charEnd === -1 && currentByteCount === byteStart + byteLength) charEnd = str.length;
    return { charStart, charEnd };
};

const HighlightText = ({ text, matches }: { text: string, matches?: { start: number, length: number }[] }) => {
    if (!text) return null;
    if (!matches || matches.length === 0) return <>{text}</>;

    const charMatches = matches.map(m => 
        convertByteIndexToCharIndex(text, m.start, m.length)
    ).filter(m => m.charStart !== -1 && m.charEnd !== -1);

    const sortedMatches = charMatches.sort((a, b) => a.charStart - b.charStart);
    const elements = [];
    let lastIndex = 0;

    sortedMatches.forEach((match, index) => {
        if (match.charStart > lastIndex) {
            elements.push(<span key={`text-${index}`}>{text.substring(lastIndex, match.charStart)}</span>);
        }
        elements.push(
            <mark key={`mark-${index}`} style={{ padding: 0, backgroundColor: '#ffe58f', fontWeight: 'bold', color: 'inherit' }}>
                {text.substring(match.charStart, match.charEnd)}
            </mark>
        );
        lastIndex = match.charEnd;
    });
    if (lastIndex < text.length) elements.push(<span key="text-end">{text.substring(lastIndex)}</span>);
    return <>{elements}</>;
};

const ArticleTable = (props: IProps) => {
    const { articles, websites, meta } = props;
    const { data: session } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [keyword, setKeyword] = useState(searchParams.get('q') || '');
    const [website, setWebsite] = useState<string | undefined>(searchParams.get('website') || undefined);
    const [topic, setTopic] = useState<string | undefined>(searchParams.get('topic') || undefined);
    const [sort, setSort] = useState<string | undefined>(searchParams.get('sort') || undefined);
    
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>(() => {
        const start = searchParams.get('startDate');
        const end = searchParams.get('endDate');
        return [start ? dayjs(start) : null, end ? dayjs(end) : null];
    });

    const [sentimentRange, setSentimentRange] = useState<[number, number]>(() => {
        const min = searchParams.get('minSentiment');
        const max = searchParams.get('maxSentiment');
        return [min ? parseFloat(min) : -1, max ? parseFloat(max) : 1];
    });

    const [topicsList, setTopicsList] = useState<ITopic[]>([]);
    
    const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
    const [isAdvancedVisible, setIsAdvancedVisible] = useState(false);

    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    useEffect(() => {
        setSort(searchParams.get('sort') || undefined);
        setKeyword(searchParams.get('q') || '');
        setWebsite(searchParams.get('website') || undefined);
        setTopic(searchParams.get('topic') || undefined);
        
        const start = searchParams.get('startDate');
        const end = searchParams.get('endDate');
        if (start || end) {
            setDateRange([start ? dayjs(start) : null, end ? dayjs(end) : null]);
        }
        
        const min = searchParams.get('minSentiment');
        const max = searchParams.get('maxSentiment');
        if (min || max) {
            setSentimentRange([min ? parseFloat(min) : -1, max ? parseFloat(max) : 1]);
        }
        
    }, [searchParams]);

    useEffect(() => {
        const fetchTopics = async () => {
            if (!session || !website) {
                setTopicsList([]);
                return;
            }
            try {
                const res = await sendRequest<ITopic[]>({
                    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/admin/topics/by-website?website=${website}`,
                    method: "GET",
                    session: session,
                });
                if (res.data) setTopicsList(res.data);
            } catch (error) {
                console.error("Lỗi tải topics");
            }
        };
        fetchTopics();
    }, [website, session]);

    const handleTableChange: TableProps<IAdminArticle>['onChange'] = (
        pagination,
        filters,
        sorter
    ) => {
        const params = new URLSearchParams(searchParams.toString());

        if (pagination.current) {
            params.set('page', pagination.current.toString());
            params.set('limit', (pagination.pageSize || 20).toString());
        }

        const sortResult = sorter as SorterResult<IAdminArticle>;
        
        if (sortResult && sortResult.order) {
            const sortOrder = sortResult.order === 'ascend' ? 'asc' : 'desc';
            params.set('sort', `${sortResult.field}:${sortOrder}`);
        } else {
            params.delete('sort');
        }

        router.replace(`${pathname}?${params.toString()}`);
    };

    const handleSearch = () => {
        const params = new URLSearchParams(searchParams.toString());
        
        if (keyword) params.set('q', keyword); else params.delete('q');
        if (website) params.set('website', website); else params.delete('website');
        if (topic) params.set('topic', topic); else params.delete('topic');
        
        if (sort) params.set('sort', sort); else params.delete('sort');

        if (dateRange[0] && dateRange[1]) {
            params.set('startDate', dateRange[0].format('YYYY-MM-DD'));
            params.set('endDate', dateRange[1].format('YYYY-MM-DD'));
        } else {
            params.delete('startDate');
            params.delete('endDate');
        }

        if (sentimentRange[0] !== -1 || sentimentRange[1] !== 1) {
            params.set('minSentiment', sentimentRange[0].toString());
            params.set('maxSentiment', sentimentRange[1].toString());
        } else {
            params.delete('minSentiment');
            params.delete('maxSentiment');
        }
        
        params.set('page', '1');
        router.replace(`${pathname}?${params.toString()}`);
    };

    const handleReset = () => {
        router.replace(pathname);
    };

    const handleStatusChange = async (articleId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'visible' ? 'hidden' : 'visible';
        setLoadingActionId(articleId);
        try {
            const res = await sendRequest<any>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/admin/articles/${articleId}/status`,
                method: "PATCH",
                body: { status: newStatus },
                session: session,
            });
            if (res.data) {
                notification.success({ message: `Đã cập nhật trạng thái` });
                router.refresh();
            }
        } catch (error) {
            notification.error({ message: 'Lỗi cập nhật trạng thái' });
        } finally {
            if (isMounted.current) {
                setLoadingActionId(null);
            }
        }
    };

    const handleDelete = async (articleId: string) => {
        setLoadingActionId(articleId);
        try {
            await sendRequest<any>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/admin/articles/${articleId}`,
                method: "DELETE",
                session: session,
            });
            notification.success({ message: 'Đã xóa bài viết' });
            router.refresh();
        } catch (error) {
            notification.error({ message: 'Lỗi xóa bài viết' });
        } finally {
            if (isMounted.current) {
                setLoadingActionId(null);
            }
        }
    };

    const currentSort = searchParams.get('sort');
    let sentimentSortOrder: 'ascend' | 'descend' | null = null;
    let dateSortOrder: 'ascend' | 'descend' | null = null;

    if (currentSort === 'ai_sentiment_score:asc') sentimentSortOrder = 'ascend';
    if (currentSort === 'ai_sentiment_score:desc') sentimentSortOrder = 'descend';
    if (currentSort === 'publish_date:asc') dateSortOrder = 'ascend';
    if (currentSort === 'publish_date:desc') dateSortOrder = 'descend';

    const columns = [
        {
            title: 'Tiêu đề & Nội dung',
            dataIndex: 'title',
            key: 'title',
            width: 350,
            render: (text: string, record: any) => {
                const matchesPosition = record._matchesPosition;
                return (
                    <div style={{ wordWrap: 'break-word', wordBreak: 'break-word' }}>
                        <a href={record.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 500, display: 'block', marginBottom: 4 }}>
                            <HighlightText text={text} matches={matchesPosition?.title} />
                        </a>
                        {matchesPosition?.summary && (
                            <div style={{ fontSize: '12px', color: '#666', background: '#f9f9f9', padding: '4px 8px', borderRadius: 4, marginBottom: 4, fontStyle: 'italic' }}>
                                <span style={{ fontWeight: 600 }}>Trong tóm tắt: </span>
                                <HighlightText 
                                    text={record.summary?.length > 150 ? record.summary.substring(0, 150) + "..." : record.summary} 
                                    matches={matchesPosition?.summary} 
                                />
                            </div>
                        )}
                        {matchesPosition?.ai_summary && !matchesPosition?.summary && (
                            <div style={{ fontSize: '12px', color: '#666', background: '#f9f9f9', padding: '4px 8px', borderRadius: 4, marginBottom: 4, fontStyle: 'italic' }}>
                                <span style={{ fontWeight: 600 }}>Trong AI tóm tắt: </span>
                                <HighlightText 
                                    text={record.ai_summary?.length > 150 ? record.ai_summary.substring(0, 150) + "..." : record.ai_summary} 
                                    matches={matchesPosition?.ai_summary} 
                                />
                            </div>
                        )}
                    </div>
                )
            },
        },
        {
            title: 'Ngày đăng',
            dataIndex: 'publish_date',
            key: 'publish_date',
            width: 140,
            sorter: true,
            sortOrder: dateSortOrder,
            render: (date: string) => <span style={{ fontSize: '13px' }}>{dayjs(date).format('DD/MM/YYYY HH:mm')}</span>
        },
        {
            title: 'Nguồn',
            dataIndex: 'website',
            key: 'website',
            width: 100,
            render: (text: string) => <Tag color="blue">{text}</Tag>,
        },
        {
            title: 'Danh mục',
            dataIndex: 'site_categories',
            key: 'categories',
            width: 150,
            render: (cats: string[]) => (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {cats?.slice(0, 3).map(c => <Tag key={c} style={{ fontSize: 11 }}>{c}</Tag>)}
                    {cats?.length > 3 && <Tag style={{ fontSize: 11 }}>...</Tag>}
                </div>
            ),
        },
        {
            title: 'Cảm xúc',
            dataIndex: 'ai_sentiment_score',
            key: 'sentiment',
            width: 100,
            sorter: true,
            sortOrder: sentimentSortOrder, 
            render: (score: number) => {
                let color = 'default';
                if (score >= 0.25) color = 'success';
                else if (score <= -0.25) color = 'error';
                else if (score !== undefined) color = 'warning';
                return score !== undefined ? (
                    <Tag color={color} style={{ minWidth: 50, textAlign: 'center' }}>
                        {score.toFixed(2)}
                    </Tag>
                ) : <span style={{ color: '#ccc' }}>N/A</span>;
            }
        },
        {
            title: 'Hành động',
            key: 'action',
            width: 90,
            render: (_: any, record: IAdminArticle) => {
                const articleId = (record as any).article_id || record.id || record._id;
                const isLoading = loadingActionId === articleId;

                return (
                    <Space size="small">
                        <Button 
                            size="small" 
                            loading={isLoading}
                            icon={record.status === 'visible' ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                            onClick={() => handleStatusChange(articleId, record.status || 'visible')}
                            disabled={loadingActionId !== null && !isLoading}
                        />
                        <Popconfirm title="Chắc chắn xóa?" onConfirm={() => handleDelete(articleId)}>
                            <Button 
                                size="small" 
                                danger 
                                loading={isLoading} 
                                icon={<DeleteOutlined />} 
                                disabled={loadingActionId !== null && !isLoading}
                            />
                        </Popconfirm>
                    </Space>
                )
            },
        },
    ];

    return (
        <Card 
            title={
                <Space>
                    <span>Quản lý Bài viết</span>
                    <Button 
                        type={isAdvancedVisible ? "primary" : "default"}
                        size="small" 
                        icon={<FilterOutlined />} 
                        onClick={() => setIsAdvancedVisible(!isAdvancedVisible)}
                        ghost={!isAdvancedVisible}
                    >
                        Bộ lọc nâng cao
                    </Button>
                </Space>
            } 
            variant="borderless"
        >
            <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                    <Input 
                        placeholder="Tìm kiếm từ khóa..." 
                        style={{ width: 250 }} 
                        value={keyword}
                        onChange={e => setKeyword(e.target.value)}
                        onPressEnter={handleSearch}
                        allowClear
                    />
                    <Select
                        placeholder="Chọn Website nguồn"
                        style={{ width: 180 }}
                        allowClear
                        value={website}
                        onChange={(val) => { setWebsite(val); setTopic(undefined); }}
                    >
                        {websites.map(ws => (
                            <Option key={ws._id} value={ws.name}>{ws.displayName}</Option>
                        ))}
                    </Select>
                    <Select 
                        placeholder={website ? "Lọc theo chủ đề" : "Chọn web trước..."}
                        style={{ width: 180 }} 
                        allowClear
                        value={topic}
                        onChange={val => setTopic(val)}
                        disabled={!website} 
                        loading={Boolean(website) && topicsList.length === 0}
                    >
                        {topicsList.map((t, index) => (
                            <Option key={t._id || index} value={t.name}>{t.name}</Option>
                        ))}
                    </Select>
                    <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                        Tìm kiếm
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={handleReset}>
                        Reset
                    </Button>
                </div>

                {/* Advanced Search */}
                {isAdvancedVisible && (
                    <div style={{ 
                        background: '#f5f5f5', 
                        padding: '12px 16px', 
                        borderRadius: 8, 
                        marginTop: 10,
                        border: '1px solid #e8e8e8'
                    }}>
                        <Row gutter={[24, 16]} align="middle">
                            <Col xs={24} md={12} lg={10}>
                                <Text strong style={{ marginRight: 8 }}>Khoảng thời gian:</Text>
                                <RangePicker 
                                    style={{ width: '100%' }}
                                    value={dateRange}
                                    onChange={(dates) => setDateRange(dates as any)}
                                    format="DD/MM/YYYY"
                                    placeholder={['Từ ngày', 'Đến ngày']}
                                />
                            </Col>
                            <Col xs={24} md={12} lg={8}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <Text strong style={{ marginRight: 16, whiteSpace: 'nowrap' }}>Chỉ số cảm xúc:</Text>
                                    <div style={{ flex: 1 }}>
                                        <Slider
                                            range
                                            min={-1}
                                            max={1}
                                            step={0.1}
                                            value={sentimentRange}
                                            onChange={(val) => setSentimentRange(val as [number, number])}
                                            marks={{
                                                '-1': { style: { color: '#ff4d4f' }, label: 'Tiêu cực' },
                                                '0': 'Trung tính',
                                                '1': { style: { color: '#52c41a' }, label: 'Tích cực' }
                                            }}
                                        />
                                    </div>
                                </div>
                            </Col>
                            <Col xs={24} md={12} lg={6}>
                                <Text strong style={{ marginRight: 8 }}>Sắp xếp:</Text>
                                <Select 
                                    placeholder="Sắp xếp kết quả" 
                                    style={{ width: '100%' }} 
                                    allowClear
                                    value={sort}
                                    onChange={val => setSort(val)}
                                >
                                    <Option value="ai_sentiment_score:desc">Tích cực nhất (Giảm dần)</Option>
                                    <Option value="ai_sentiment_score:asc">Tiêu cực nhất (Tăng dần)</Option>
                                    <Option value="publish_date:desc">Mới nhất</Option>
                                    <Option value="publish_date:asc">Cũ nhất</Option>
                                </Select>
                            </Col>
                        </Row>
                    </div>
                )}
            </div>

            <Table 
                columns={columns} 
                dataSource={articles} 
                rowKey={(r: any) => r.article_id || r.id || r._id} 
                loading={loadingActionId !== null && articles.some(a => (a as any).article_id === loadingActionId) ? false : false} // Tắt loading tổng của table
                onChange={handleTableChange}
                pagination={{ 
                    current: meta.current,
                    pageSize: meta.pageSize,
                    total: meta.total,
                    showSizeChanger: true,
                    pageSizeOptions: ['10', '20', '50', '100'],
                }}
                scroll={{ x: 1000 }}
                size="small"
            />
        </Card>
    );
};

export default ArticleTable;