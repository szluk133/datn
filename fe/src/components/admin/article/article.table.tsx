'use client'

import React, { useEffect, useState } from 'react';
import { Table, Tag, Space, Button, Input, Select, Popconfirm, notification, Card } from 'antd';
import { SearchOutlined, DeleteOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';
import { IAdminArticle, ITopic } from '@/types/next-auth';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

const { Option } = Select;

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

    const [topicsList, setTopicsList] = useState<ITopic[]>([]);
    const [loadingAction, setLoadingAction] = useState(false);

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

    const handleSearch = () => {
        const params = new URLSearchParams(searchParams.toString());
        
        if (keyword) params.set('q', keyword); else params.delete('q');
        if (website) params.set('website', website); else params.delete('website');
        if (topic) params.set('topic', topic); else params.delete('topic');
        if (sort) params.set('sort', sort); else params.delete('sort');
        
        params.set('page', '1');
        
        router.replace(`${pathname}?${params.toString()}`);
    };

    const handleTableChange = (page: number, pageSize: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('page', page.toString());
        params.set('limit', pageSize.toString());
        router.replace(`${pathname}?${params.toString()}`);
    };

    const handleWebsiteChange = (val: string | undefined) => {
        setWebsite(val);
        setTopic(undefined);
    };

    const handleStatusChange = async (articleId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'visible' ? 'hidden' : 'visible';
        setLoadingAction(true);
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
            setLoadingAction(false);
        }
    };

    const handleDelete = async (articleId: string) => {
        setLoadingAction(true);
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
            setLoadingAction(false);
        }
    };

    const columns = [
        {
            title: 'Tiêu đề',
            dataIndex: 'title',
            key: 'title',
            width: 300,
            render: (text: string, record: IAdminArticle) => (
                <div style={{ wordWrap: 'break-word', wordBreak: 'break-word' }}>
                    <a href={record.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 500 }}>{text}</a>
                </div>
            ),
        },
        {
            title: 'Nguồn',
            dataIndex: 'website',
            key: 'website',
            width: 120,
            render: (text: string) => <Tag color="blue">{text}</Tag>,
        },
        {
            title: 'Danh mục',
            dataIndex: 'site_categories',
            key: 'categories',
            width: 200,
            render: (cats: string[]) => (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {cats?.slice(0, 3).map(c => <Tag key={c}>{c}</Tag>)}
                    {cats?.length > 3 && <Tag>...</Tag>}
                </div>
            ),
        },
        {
            title: 'Cảm xúc',
            dataIndex: 'ai_sentiment_score',
            key: 'sentiment',
            width: 100,
            sorter: true,
            render: (score: number) => {
                let color = 'default';
                if (score > 0.2) color = 'success';
                if (score < -0.2) color = 'error';
                return <Tag color={color}>{score ? score.toFixed(2) : 'N/A'}</Tag>;
            }
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: (status: string) => (
                <Tag color={status === 'hidden' ? 'warning' : 'success'}>
                    {status === 'hidden' ? 'Ẩn' : 'Hiện'}
                </Tag>
            ),
        },
        {
            title: 'Hành động',
            key: 'action',
            width: 100,
            render: (_: any, record: IAdminArticle) => {
                const articleId = (record as any).article_id || record.id || record._id;
                return (
                    <Space size="small">
                        <Button 
                            size="small" 
                            loading={loadingAction}
                            icon={record.status === 'visible' ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                            onClick={() => handleStatusChange(articleId, record.status || 'visible')}
                        />
                        <Popconfirm title="Chắc chắn xóa?" onConfirm={() => handleDelete(articleId)}>
                            <Button size="small" danger loading={loadingAction} icon={<DeleteOutlined />} />
                        </Popconfirm>
                    </Space>
                )
            },
        },
    ];

    return (
        <Card title="Quản lý Bài viết" variant="borderless">
            <div style={{ marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
                    onChange={handleWebsiteChange}
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

                <Select 
                    placeholder="Sắp xếp cảm xúc" 
                    style={{ width: 160 }} 
                    allowClear
                    value={sort}
                    onChange={val => setSort(val)}
                >
                    <Option value="ai_sentiment_score:desc">Tích cực nhất</Option>
                    <Option value="ai_sentiment_score:asc">Tiêu cực nhất</Option>
                </Select>

                <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                    Tìm kiếm
                </Button>
            </div>

            <Table 
                columns={columns} 
                dataSource={articles} 
                rowKey={(r: any) => r.article_id || r.id || r._id} 
                loading={loadingAction} 
                pagination={{ 
                    current: meta.current,
                    pageSize: meta.pageSize,
                    total: meta.total,
                    showSizeChanger: true,
                    onChange: handleTableChange
                }}
                scroll={{ x: 1000 }}
            />
        </Card>
    );
};

export default ArticleTable;