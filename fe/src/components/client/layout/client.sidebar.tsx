'use client';

import React, { useContext, useEffect, useState } from 'react';
import { Layout, Menu, Spin, Empty, Typography, Tooltip } from 'antd';
import { 
    HistoryOutlined,
    CalendarOutlined, 
    GlobalOutlined, 
    TagOutlined 
} from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { MenuProps } from 'antd';
import { ClientContext } from '@/components/client/layout/client.context'; 
import { sendRequest } from '@/utils/api';
import { ISearchHistory } from '@/types/next-auth';
import dayjs from 'dayjs';

const { Sider } = Layout;
const { Title } = Typography;

const ClientSidebar = () => {
    const { data: session } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();

    // Lấy Context để nhận dữ liệu history mới nhất từ ArticleList
    const clientContext = useContext(ClientContext);
    
    const [isCollapsed, setIsCollapsed] = useState(false);

    if (!clientContext) {
        throw new Error("ClientSidebar must be used within a ClientContextProvider");
    }

    const {
        searchHistory,
        setSearchHistory,
        isLoadingHistory,
        setIsLoadingHistory,
    } = clientContext;

    const currentSearchId = searchParams?.get('id') || null;
    const [selectedMenuKey, setSelectedMenuKey] = useState<string | null>(null);

    useEffect(() => {
        setSelectedMenuKey(currentSearchId);
    }, [currentSearchId]);

    // Hàm helper: Trích xuất timestamp để sắp xếp
    const getItemTime = (item: any): number => {
        // 1. Ưu tiên lấy từ search_id (định dạng yyyyMMddHHmmss...)
        if (item.search_id && typeof item.search_id === 'string') {
            const match = item.search_id.match(/^(\d{14})/); 
            if (match) {
                const dateStr = match[1];
                const y = parseInt(dateStr.substring(0, 4));
                const m = parseInt(dateStr.substring(4, 6)) - 1; 
                const d = parseInt(dateStr.substring(6, 8));
                const h = parseInt(dateStr.substring(8, 10));
                const min = parseInt(dateStr.substring(10, 12));
                const s = parseInt(dateStr.substring(12, 14));
                const t = new Date(y, m, d, h, min, s).getTime();
                if (!isNaN(t)) return t;
            }
        }
        // 2. Fallback sang createdAt
        if (item.createdAt) {
            const t = new Date(item.createdAt).getTime();
            if (!isNaN(t)) return t;
        }
        return 0; 
    };

    // Effect: Fetch lịch sử khi component mount (lần đầu vào trang)
    useEffect(() => {
        const fetchHistory = async () => {
            if (session?.user?._id) {
                const currentTs = new Date().getTime();
                // Thêm timestamp để tránh cache
                const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/article/history/${session.user._id}?_t=${currentTs}`;

                try {
                    const res = await sendRequest<ISearchHistory[]>({
                        url: url,
                        method: 'GET',
                        session: session,
                    });

                    if (res?.data && Array.isArray(res.data)) {
                        // Sắp xếp Client-side để đảm bảo mới nhất lên đầu
                        const sortedHistory = [...res.data].sort((a, b) => {
                            return getItemTime(b) - getItemTime(a);
                        });
                        setSearchHistory(sortedHistory);
                    } else {
                        setSearchHistory([]);
                    }
                } catch (error) {
                    console.error("[Sidebar Fetch Error]", error);
                    setSearchHistory([]);
                } finally {
                    setIsLoadingHistory(false);
                }
            } else {
                setIsLoadingHistory(false);
            }
        };

        // Chỉ fetch nếu chưa có dữ liệu hoặc user thay đổi
        if (session?.user?._id && searchHistory.length === 0) {
            setIsLoadingHistory(true);
            fetchHistory();
        } 
        else if (!session?.user?._id) {
            setSearchHistory([]);
            setIsLoadingHistory(false);
        }
        // Nếu đã có data (do ArticleList setContext hoặc lần load trước), tắt loading
        else if (session?.user?._id && searchHistory.length > 0 && isLoadingHistory) {
            setIsLoadingHistory(false);
        }
    
    }, [session?.user?._id, searchHistory.length]); 

    const handleHistoryClick = (searchId: string) => {
        router.push(`/model/article?id=${searchId}`);
    };

    const menuItems: MenuProps['items'] = searchHistory.map((item) => {
        const labelContent = (
            <div style={{ lineHeight: '1.6', padding: '8px 0', whiteSpace: 'normal', fontSize: '0.9em' }}>
                <Tooltip title={`${item.keyword_search} ${item.keyword_content ? `~ ${item.keyword_content}` : ''}`}>
                    <span style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 'bold', marginBottom: '4px' }}>
                        <TagOutlined style={{ marginRight: '6px' }} />
                        {item.keyword_search}
                        {item.keyword_content && <span style={{ marginLeft: '4px', color: '#555', fontWeight: 'normal' }}>{`~ ${item.keyword_content}`}</span>}
                    </span>
                </Tooltip>

                <Tooltip title={item.websites_crawled && item.websites_crawled.length > 0 ? item.websites_crawled.join(', ') : 'Tất cả'}>
                    <span style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#666', fontSize: '0.95em', marginBottom: '4px' }}>
                        <GlobalOutlined style={{ marginRight: '6px' }} />
                        {item.websites_crawled && item.websites_crawled.length > 0 ? item.websites_crawled.join(', ') : 'Tất cả website'}
                    </span>
                </Tooltip>
                
                <Tooltip title={item.time_range || 'Không rõ'}>
                    <span style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#666', fontSize: '0.95em' }}>
                        <CalendarOutlined style={{ marginRight: '6px' }} />
                        {item.time_range && item.time_range.includes(' - ') ? 
                            dayjs(item.time_range.split(' - ')[0], 'DD/MM/YYYY').format('DD/MM/YY') + ' - ' + dayjs(item.time_range.split(' - ')[1], 'DD/MM/YYYY').format('DD/MM/YY') 
                            : (item.time_range || 'Không rõ')}
                    </span>
                </Tooltip>
            </div>
        );

        return {
            key: item.search_id,
            icon: <HistoryOutlined />,
            label: labelContent,
            onClick: () => handleHistoryClick(item.search_id),
            style: {
                height: 'auto',
                minHeight: '80px',
                display: 'flex',
                alignItems: 'center',
                paddingTop: '8px',
                paddingBottom: '8px'
            }
        };
    });

    return (
        <Sider 
            width={250} 
            theme="light" 
            style={{ 
                borderRight: '1px solid #f0f0f0',
                overflowY: 'auto', 
                height: '100%',
                scrollbarWidth: 'thin',
            }}
            collapsible={true}
            collapsed={isCollapsed}
            onCollapse={(collapsed) => setIsCollapsed(collapsed)}
            collapsedWidth={80}
        >
            <Title level={4} style={{ padding: '16px', margin: 0, borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
                <HistoryOutlined /> 
                {!isCollapsed && <span style={{ marginLeft: '10px' }}>Lịch sử tìm kiếm</span>}
            </Title>
            {isLoadingHistory ? (
                <div style={{ textAlign: 'center', padding: '20px' }}><Spin /></div>
            ) : searchHistory.length > 0 ? (
                <Menu
                    mode="inline"
                    style={{ borderRight: 0 }}
                    items={menuItems}
                    selectedKeys={selectedMenuKey ? [selectedMenuKey] : []} 
                />
            ) : (
                <div style={{ padding: '20px' }}>
                    {!isCollapsed && <Empty description="Chưa có lịch sử tìm kiếm." />}
                </div>
            )}
        </Sider>
    );
};

export default ClientSidebar;