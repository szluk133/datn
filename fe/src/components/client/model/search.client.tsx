'use client'

import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Input, Select, Card, DatePicker, Row, Col, Slider, Typography, theme, Empty, Tooltip, Space, Flex } from 'antd';
import { SearchOutlined, FilterOutlined, ReloadOutlined, SmileFilled, FrownFilled, MehFilled, InfoCircleOutlined } from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';
import { IAdminArticle, ITopic } from '@/types/next-auth';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import dayjs from 'dayjs';
import type { TableProps } from 'antd/es/table';
import type { SorterResult } from 'antd/es/table/interface';
import Link from 'next/link';
import BookmarkButton from '@/components/client/article/bookmark.btn';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Text, Title } = Typography;

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

// Hàm highlight text giữ nguyên
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

const SearchClient = (props: IProps) => {
    const { token } = theme.useToken();
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

    // State mới cho Label
    const [sentimentLabel, setSentimentLabel] = useState<string | undefined>(searchParams.get('sentimentLabel') || undefined);

    // State cho Confidence (Độ tin cậy): 0 -> 1
    const [confidenceRange, setConfidenceRange] = useState<[number, number]>(() => {
        const min = searchParams.get('minSentiment');
        const max = searchParams.get('maxSentiment');
        // Mặc định là 0 - 1 (Toàn bộ dải độ tin cậy)
        return [min ? parseFloat(min) : 0, max ? parseFloat(max) : 1];
    });

    const [topicsList, setTopicsList] = useState<ITopic[]>([]);
    
    const [isAdvancedVisible, setIsAdvancedVisible] = useState(() => {
        const hasDate = searchParams.get('startDate') || searchParams.get('endDate');
        const hasSentiment = searchParams.get('minSentiment') || searchParams.get('maxSentiment') || searchParams.get('sentimentLabel');
        const hasSort = searchParams.get('sort');
        return !!(hasDate || hasSentiment || hasSort);
    });

    useEffect(() => {
        setSort(searchParams.get('sort') || undefined);
        setKeyword(searchParams.get('q') || '');
        setWebsite(searchParams.get('website') || undefined);
        setTopic(searchParams.get('topic') || undefined);
        setSentimentLabel(searchParams.get('sentimentLabel') || undefined);
        
        const start = searchParams.get('startDate');
        const end = searchParams.get('endDate');
        if (start || end) setDateRange([start ? dayjs(start) : null, end ? dayjs(end) : null]);
        
        const min = searchParams.get('minSentiment');
        const max = searchParams.get('maxSentiment');
        if (min || max) setConfidenceRange([min ? parseFloat(min) : 0, max ? parseFloat(max) : 1]);
        
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

    const handleTableChange: TableProps<IAdminArticle>['onChange'] = (pagination, filters, sorter) => {
        const params = new URLSearchParams(searchParams.toString());
        if (pagination.current) {
            params.set('page', pagination.current.toString());
            params.set('limit', (pagination.pageSize || 10).toString());
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

        // Handle Label
        if (sentimentLabel) params.set('sentimentLabel', sentimentLabel); else params.delete('sentimentLabel');

        // Handle Confidence (chỉ set khi khác mặc định 0-1)
        if (confidenceRange[0] !== 0 || confidenceRange[1] !== 1) {
            params.set('minSentiment', confidenceRange[0].toString());
            params.set('maxSentiment', confidenceRange[1].toString());
        } else {
            params.delete('minSentiment');
            params.delete('maxSentiment');
        }

        params.set('page', '1');
        router.replace(`${pathname}?${params.toString()}`);
    };

    const handleReset = () => {
        router.replace(pathname);
        setKeyword('');
        setWebsite(undefined);
        setTopic(undefined);
        setSort(undefined);
        setDateRange([null, null]);
        setSentimentLabel(undefined);
        setConfidenceRange([0, 1]);
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
            width: 400,
            render: (text: string, record: any) => {
                const matchesPosition = record._matchesPosition;
                const articleId = record.article_id || record.id || record._id;
                return (
                    <div style={{ wordWrap: 'break-word', wordBreak: 'break-word' }}>
                        <Link href={`/model/article/${articleId}`} style={{ fontWeight: 500, display: 'block', marginBottom: 4, color: token.colorPrimary }}>
                            <HighlightText text={text} matches={matchesPosition?.title} />
                        </Link>
                        {matchesPosition?.summary && (
                            <div style={{ fontSize: '12px', color: '#666', background: '#f9f9f9', padding: '4px 8px', borderRadius: 4, marginBottom: 4, fontStyle: 'italic' }}>
                                <span style={{ fontWeight: 600 }}>Trong tóm tắt: </span>
                                <HighlightText 
                                    text={record.summary?.length > 150 ? record.summary.substring(0, 150) + "..." : record.summary} 
                                    matches={matchesPosition?.summary} 
                                />
                            </div>
                        )}
                        {!matchesPosition?.summary && record.summary && (
                            <div style={{ fontSize: '12px', color: '#666' }}>
                                {record.summary.substring(0, 150)}...
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
            width: 120,
            render: (text: string) => <Tag color="blue">{text}</Tag>,
        },
        {
            title: 'Cảm xúc & Độ tin cậy',
            dataIndex: 'ai_sentiment_score',
            key: 'sentiment',
            width: 180,
            sorter: true,
            sortOrder: sentimentSortOrder, 
            render: (_: any, record: any) => {
                // Logic hiển thị mới: Dùng Label làm chính, Score làm độ tin cậy
                const label = record.ai_sentiment_label || 'Unknown';
                const score = record.ai_sentiment_score ?? 0;
                
                let color = 'default';
                let icon = <MehFilled />;
                let labelVi = 'Chưa phân tích';
                
                // Chuẩn hóa label về chữ thường để so sánh
                const lowerLabel = label.toLowerCase();

                if (['positive', 'tích cực'].includes(lowerLabel)) {
                    color = 'success';
                    icon = <SmileFilled />;
                    labelVi = 'Tích cực';
                } else if (['negative', 'tiêu cực'].includes(lowerLabel)) {
                    color = 'error';
                    icon = <FrownFilled />;
                    labelVi = 'Tiêu cực';
                } else if (['neutral', 'trung tính'].includes(lowerLabel)) {
                    color = 'warning';
                    icon = <MehFilled />;
                    labelVi = 'Trung tính';
                }

                if (record.ai_sentiment_score === undefined) {
                    return <span style={{ color: '#ccc' }}>N/A</span>;
                }

                return (
                    <Flex vertical gap={4} align="start">
                        <Tag color={color} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {icon} {labelVi}
                        </Tag>
                        <Tooltip title="Độ tin cậy của AI">
                            <Space size={4} style={{ fontSize: 12, color: token.colorTextSecondary }}>
                                <InfoCircleOutlined /> 
                                {(score * 100).toFixed(0)}%
                            </Space>
                        </Tooltip>
                    </Flex>
                );
            }
        },
        {
            title: '',
            key: 'action',
            width: 50,
            fixed: 'right' as const,
            render: (_: any, record: any) => {
                const articleId = record.article_id || record.id || record._id;
                return (
                    <div className="row-action">
                        <BookmarkButton 
                            articleId={articleId} 
                            articleTitle={record.title}
                            articleUrl={record.url}
                            website={record.website}
                            siteCategories={record.site_categories}
                            summary={record.summary}
                            aiSentimentScore={record.ai_sentiment_score}
                            aiSentimentLabel={record.ai_sentiment_label} // Truyền thêm label
                            publishDate={record.publish_date}
                            size="middle"
                            type="text"
                        />
                    </div>
                );
            }
        }
    ];

    return (
        <Card 
            title={<Title level={4} style={{ margin: 0 }}>Tìm kiếm bài báo</Title>}
            variant="borderless"
            style={{ borderRadius: token.borderRadiusLG, boxShadow: token.boxShadowTertiary }}
        >
            <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
                    <Input 
                        placeholder="Tìm kiếm từ khóa..." 
                        style={{ width: 250 }} 
                        prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                        value={keyword}
                        onChange={e => setKeyword(e.target.value)}
                        onPressEnter={handleSearch}
                        allowClear
                    />
                    <Select
                        placeholder="Nguồn Website"
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
                        placeholder={website ? "Chủ đề" : "Chọn web trước..."}
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

                    <Button 
                        icon={<FilterOutlined />} 
                        onClick={() => setIsAdvancedVisible(!isAdvancedVisible)}
                        type={isAdvancedVisible ? 'default' : 'dashed'}
                        style={{ borderColor: isAdvancedVisible ? token.colorPrimary : undefined, color: isAdvancedVisible ? token.colorPrimary : undefined }}
                    >
                        {isAdvancedVisible ? 'Ẩn bộ lọc' : 'Bộ lọc nâng cao'}
                    </Button>
                </div>

                {isAdvancedVisible && (
                    <div style={{ 
                        background: '#f9f9f9', 
                        padding: '16px 20px', 
                        borderRadius: 8, 
                        marginTop: 12,
                        border: '1px solid #f0f0f0'
                    }}>
                        <Row gutter={[24, 16]} align="middle">
                            <Col xs={24} md={12} lg={8}>
                                <Text strong style={{ display: 'block', marginBottom: 8 }}>Khoảng thời gian:</Text>
                                <RangePicker 
                                    style={{ width: '100%' }}
                                    value={dateRange}
                                    onChange={(dates) => setDateRange(dates as any)}
                                    format="DD/MM/YYYY"
                                    placeholder={['Từ ngày', 'Đến ngày']}
                                />
                            </Col>
                            <Col xs={24} md={12} lg={10}>
                                <Text strong style={{ display: 'block', marginBottom: 8 }}>Bộ lọc cảm xúc AI:</Text>
                                <Row gutter={12}>
                                    <Col span={10}>
                                        <Select
                                            placeholder="Chọn nhãn"
                                            style={{ width: '100%' }}
                                            allowClear
                                            value={sentimentLabel}
                                            onChange={setSentimentLabel}
                                            options={[
                                                { value: 'Positive', label: <Space><SmileFilled style={{ color: '#52c41a' }} /> Tích cực</Space> },
                                                { value: 'Negative', label: <Space><FrownFilled style={{ color: '#ff4d4f' }} /> Tiêu cực</Space> },
                                                { value: 'Neutral', label: <Space><MehFilled style={{ color: '#faad14' }} /> Trung tính</Space> },
                                            ]}
                                        />
                                    </Col>
                                    <Col span={14}>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span style={{ fontSize: 12, color: '#888', marginRight: 8, whiteSpace: 'nowrap' }}>Độ tin cậy:</span>
                                            <Slider
                                                range
                                                min={0}
                                                max={1}
                                                step={0.05}
                                                style={{ flex: 1 }}
                                                value={confidenceRange}
                                                onChange={(val) => setConfidenceRange(val as [number, number])}
                                                tooltip={{ formatter: (val) => `${Math.round((val || 0) * 100)}%` }}
                                            />
                                        </div>
                                    </Col>
                                </Row>
                            </Col>
                            <Col xs={24} md={12} lg={6}>
                                <Text strong style={{ display: 'block', marginBottom: 8 }}>Sắp xếp:</Text>
                                <Select 
                                    placeholder="Sắp xếp kết quả" 
                                    style={{ width: '100%' }} 
                                    allowClear
                                    value={sort}
                                    onChange={val => setSort(val)}
                                >
                                    <Option value="ai_sentiment_score:desc">Độ tin cậy cao nhất</Option>
                                    <Option value="ai_sentiment_score:asc">Độ tin cậy thấp nhất</Option>
                                    <Option value="publish_date:desc">Mới nhất</Option>
                                    <Option value="publish_date:asc">Cũ nhất</Option>
                                </Select>
                            </Col>
                        </Row>
                    </div>
                )}
            </div>

            <Table 
                columns={columns as any} 
                dataSource={articles} 
                rowKey={(r: any) => r.article_id || r.id || r._id} 
                onChange={handleTableChange}
                pagination={{ 
                    current: meta.current,
                    pageSize: meta.pageSize,
                    total: meta.total,
                    showSizeChanger: true,
                    pageSizeOptions: ['10', '20', '50', '100'],
                    showTotal: (total) => `Tổng ${total} bài viết`
                }}
                scroll={{ x: 1000 }}
                size="small"
                locale={{ emptyText: <Empty description="Không tìm thấy bài báo nào" /> }}
                rowClassName="article-row"
            />

            <style jsx global>{`
                .article-row .row-action {
                    opacity: 0;
                    transition: opacity 0.2s ease-in-out;
                }
                .article-row:hover .row-action {
                    opacity: 1;
                }
            `}</style>
        </Card>
    );
};

export default SearchClient;