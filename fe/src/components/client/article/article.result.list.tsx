'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { List, Breadcrumb, Empty, Button, Pagination, notification, Checkbox, Space, Badge, Typography } from 'antd';
import { HomeOutlined, ReadOutlined, FileExcelOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { IArticle } from '@/types/next-auth';
import ArticleItem from '@/components/client/article/article.item';
import { useChatbot } from '@/components/client/chatbot/chatbot.context';

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

const ArticleResultList = (props: IProps) => {
    const { articles, meta, searchId } = props;
    const { data: session } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    
    const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
    const [isExporting, setIsExporting] = useState(false);
    const { setPageContext } = useChatbot();

    useEffect(() => {
        if (searchId) {
            setPageContext({ current_page: 'list_page', search_id: searchId });
        } else {
            setPageContext({ current_page: 'home_page' });
        }
        return () => setPageContext(null);
    }, [searchId, setPageContext]);

    useEffect(() => {
        setSelectedRowKeys(new Set());
    }, [articles]);

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
        if (e.target.checked) setSelectedRowKeys(new Set(articles.map(a => a.id || a._id)));
        else setSelectedRowKeys(new Set());
    };

    const isAllSelected = articles.length > 0 && articles.every(a => selectedRowKeys.has(a.id || a._id));

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <Breadcrumb items={breadcrumbItems} />
                <Space>
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
                        disabled={isExporting || (!searchId && selectedRowKeys.size === 0) || (articles.length === 0)}
                        style={selectedRowKeys.size > 0 ? { background: '#52c41a', borderColor: '#52c41a' } : {}}
                    >
                        {selectedRowKeys.size > 0 ? 'Xuất bài đã chọn (Excel)' : 'Xuất tất cả (Excel)'}
                    </Button>
                </Space>
            </div>

            {articles.length > 0 ? (
                <>  
                    <div style={{ marginBottom: '16px', padding: '8px 16px', background: '#fafafa', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
                        <Checkbox checked={isAllSelected} onChange={onSelectAll}>
                            <Text strong style={{ marginLeft: 8 }}>Chọn tất cả bài viết trên trang này</Text>
                        </Checkbox>
                    </div>
                    <List
                        itemLayout="vertical"
                        size="large"
                        dataSource={articles}
                        renderItem={(item) => (
                            <ArticleItem 
                                key={item.id || item._id} 
                                article={item} 
                                isSelected={selectedRowKeys.has(item.id || item._id)}
                                onToggleSelect={onToggleSelect}
                            />
                        )}
                    />
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