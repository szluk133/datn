'use client';

import React, { useContext, useEffect, useState } from 'react';
import { Layout, Menu, Spin, Empty, Typography, Tooltip, Button, Flex, theme } from 'antd';
import { 
    HistoryOutlined,
    CalendarOutlined, 
    GlobalOutlined, 
    TagOutlined,
    PlusOutlined,
    RightOutlined
} from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { MenuProps } from 'antd';
import { ClientContext } from '@/components/client/layout/client.context'; 
import { sendRequest } from '@/utils/api';
import { ISearchHistory } from '@/types/next-auth';
import dayjs from 'dayjs';
import Link from 'next/link';

const { Sider } = Layout;
const { Title, Text } = Typography;

const ClientSidebar = () => {
    const { token } = theme.useToken();
    const { data: session } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

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
        if (pathname === '/model/article' && currentSearchId) {
            setSelectedMenuKey(currentSearchId);
        } else {
            setSelectedMenuKey(null);
        }
    }, [currentSearchId, pathname]);

    const getItemTime = (item: any): number => {
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
        if (item.createdAt) {
            const t = new Date(item.createdAt).getTime();
            if (!isNaN(t)) return t;
        }
        return 0; 
    };

    useEffect(() => {
        const fetchHistory = async () => {
            if (session?.user?._id) {
                const currentTs = new Date().getTime();
                const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/article/history/${session.user._id}?_t=${currentTs}`;

                try {
                    const res = await sendRequest<ISearchHistory[]>({
                        url: url,
                        method: 'GET',
                        session: session,
                    });

                    if (res?.data && Array.isArray(res.data)) {
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

        if (session?.user?._id && searchHistory.length === 0) {
            setIsLoadingHistory(true);
            fetchHistory();
        } 
        else if (!session?.user?._id) {
            setSearchHistory([]);
            setIsLoadingHistory(false);
        }
        else if (session?.user?._id && searchHistory.length > 0 && isLoadingHistory) {
            setIsLoadingHistory(false);
        }
    
    }, [session?.user?._id, searchHistory.length]); 

    const handleHistoryClick = (searchId: string) => {
        router.push(`/model/article?id=${searchId}`);
    };

    const menuItems: MenuProps['items'] = searchHistory.map((item) => {
        const labelContent = (
            <Flex vertical gap={4} style={{ padding: '8px 0', overflow: 'hidden' }}>
                
                <Tooltip title={`${item.keyword_search} ${item.keyword_content ? `~ ${item.keyword_content}` : ''}`} placement="right">
                    <Flex align="center" gap={6} style={{ width: '100%' }}>
                        <TagOutlined style={{ color: token.colorPrimary, fontSize: 13, flexShrink: 0 }} />
                        <Text strong ellipsis style={{ fontSize: 13, color: token.colorText, flex: 1 }}>
                            {item.keyword_search}
                            {item.keyword_content && <span style={{ fontWeight: 'normal', color: token.colorTextSecondary }}> ~ {item.keyword_content}</span>}
                        </Text>
                    </Flex>
                </Tooltip>

                <Tooltip title={item.websites_crawled && item.websites_crawled.length > 0 ? item.websites_crawled.join(', ') : 'Tất cả website'} placement="right">
                    <Flex align="center" gap={6} style={{ width: '100%' }}>
                        <GlobalOutlined style={{ color: token.colorTextSecondary, fontSize: 12, flexShrink: 0 }} />
                        <Text ellipsis style={{ fontSize: 12, color: token.colorTextSecondary, flex: 1 }}>
                            {item.websites_crawled && item.websites_crawled.length > 0 ? item.websites_crawled.join(', ') : 'Tất cả website'}
                        </Text>
                    </Flex>
                </Tooltip>

                <Tooltip title={item.time_range || 'Không rõ khoảng thời gian'} placement="right">
                    <Flex align="center" gap={6} style={{ width: '100%' }}>
                        <CalendarOutlined style={{ color: token.colorTextSecondary, fontSize: 12, flexShrink: 0 }} />
                        <Text ellipsis style={{ fontSize: 12, color: token.colorTextSecondary, flex: 1 }}>
                            {item.time_range && item.time_range.includes(' - ') ? 
                                dayjs(item.time_range.split(' - ')[0], 'DD/MM/YYYY').format('DD/MM/YY') + ' - ' + dayjs(item.time_range.split(' - ')[1], 'DD/MM/YYYY').format('DD/MM/YY') 
                                : (item.time_range || 'Không rõ')}
                        </Text>
                    </Flex>
                </Tooltip>
            </Flex>
        );

        return {
            key: item.search_id,
            icon: <HistoryOutlined style={{ fontSize: 16, marginTop: 10 }} />, 
            label: labelContent,
            onClick: () => handleHistoryClick(item.search_id),
            style: {
                height: 'auto',
                marginBottom: 8,
                lineHeight: 1.5,
                borderRadius: token.borderRadiusLG,
                paddingLeft: 12 
            }
        };
    });

    return (
        <Sider 
            width={260} 
            theme="light" 
            style={{ 
                borderRight: `1px solid ${token.colorBorderSecondary}`,
                height: '100vh',
                position: 'sticky',
                top: 0,
                left: 0,
                zIndex: 10,
                boxShadow: isCollapsed ? 'none' : token.boxShadowTertiary
            }}
            collapsible={true}
            collapsed={isCollapsed}
            onCollapse={(collapsed) => setIsCollapsed(collapsed)}
            collapsedWidth={80}
            breakpoint="lg"
            trigger={
                <div style={{ 
                    borderTop: `1px solid ${token.colorBorderSecondary}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 48
                }}>
                    {isCollapsed ? <RightOutlined /> : <span style={{ fontSize: 12 }}>Thu gọn</span>}
                </div>
            }
        >
            <Flex vertical style={{ height: '100%' }}>
                <div style={{ padding: '20px 16px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                    <Flex align="center" justify={isCollapsed ? 'center' : 'start'} gap={10} style={{ marginBottom: isCollapsed ? 0 : 16 }}>
                        <div style={{ 
                            background: token.colorFillSecondary, 
                            padding: 6, 
                            borderRadius: 6, 
                            display: 'flex' 
                        }}>
                            <HistoryOutlined style={{ fontSize: 18, color: token.colorPrimary }} />
                        </div>
                        {!isCollapsed && <Title level={5} style={{ margin: 0 }}>Lịch sử tìm kiếm</Title>}
                    </Flex>

                    {!isCollapsed ? (
                        <Link href="/model/search" style={{ width: '100%' }}>
                            <Button 
                                type="primary" 
                                block 
                                icon={<PlusOutlined />}
                                style={{ 
                                    background: `linear-gradient(135deg, ${token.colorPrimary}, ${token.colorPrimaryActive})`,
                                    border: 'none',
                                    height: 40,
                                    fontWeight: 500,
                                    boxShadow: token.boxShadow
                                }}
                            >
                                Tìm kiếm mới
                            </Button>
                        </Link>
                    ) : (
                        <Tooltip title="Tìm kiếm mới" placement="right">
                            <Link href="/model/search">
                                <Button 
                                    type="primary" 
                                    shape="circle" 
                                    icon={<PlusOutlined />} 
                                    size="large"
                                    style={{ marginTop: 16 }}
                                />
                            </Link>
                        </Tooltip>
                    )}
                </div>

                <div style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    padding: '12px 8px',
                    scrollbarWidth: 'thin',
                }}>
                    {isLoadingHistory ? (
                        <Flex justify="center" align="center" style={{ height: 100 }}>
                            <Spin size="small" />
                                <span>Đang tải...</span>
                        </Flex>
                    ) : searchHistory.length > 0 ? (
                        <Menu
                            mode="inline"
                            style={{ border: 'none' }}
                            items={menuItems}
                            selectedKeys={selectedMenuKey ? [selectedMenuKey] : []} 
                        />
                    ) : (
                        <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                            {!isCollapsed && (
                                <Empty 
                                    image={Empty.PRESENTED_IMAGE_SIMPLE} 
                                    description={<Text type="secondary" style={{ fontSize: 13 }}>Chưa có lịch sử</Text>} 
                                />
                            )}
                        </div>
                    )}
                </div>
            </Flex>
        </Sider>
    );
};

export default ClientSidebar;