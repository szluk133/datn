'use client';

import React, { useContext, useEffect, useState } from 'react';
import { Layout, Menu, Spin, Empty, Typography, Tooltip, Button, Flex, theme, Badge } from 'antd';
import { 
    HistoryOutlined,
    CalendarOutlined, 
    GlobalOutlined, 
    TagOutlined,
    PlusOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    SearchOutlined,
    ClockCircleFilled
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

    const toggleCollapsed = () => {
        setIsCollapsed(!isCollapsed);
    };

    const menuItems: MenuProps['items'] = searchHistory.map((item, index) => {
        const isSelected = selectedMenuKey === item.search_id;
        
        const tagColors = ['#ff7a45', '#ffa940', '#73d13d', '#36cfc9', '#4096ff', '#9254de', '#f759ab'];
        const accentColor = tagColors[index % tagColors.length];

        const labelContent = (
            <Flex vertical gap={6} style={{ padding: '8px 4px', overflow: 'hidden' }}>
                <Flex align="center" justify="space-between" style={{ width: '100%' }}>
                    <Tooltip title={item.keyword_search} placement="right" mouseEnterDelay={0.5}>
                        <Text strong ellipsis style={{ fontSize: 13, color: token.colorTextHeading, flex: 1 }}>
                            {item.keyword_search}
                        </Text>
                    </Tooltip>
                    {isSelected && <Badge status="processing" color={token.colorPrimary} />}
                </Flex>

                <div style={{ paddingLeft: 2 }}>
                    <Flex vertical gap={4}>
                        <Flex align="center" gap={8} style={{ width: '100%' }}>
                            <TagOutlined style={{ fontSize: 11, color: accentColor }} />
                            <Text ellipsis style={{ fontSize: 11, color: token.colorTextSecondary, flex: 1 }}>
                                {item.keyword_content || "Không có từ khóa phụ"}
                            </Text>
                        </Flex>

                        <Flex align="center" gap={8} style={{ width: '100%' }}>
                            <GlobalOutlined style={{ fontSize: 11, color: token.colorTextDescription }} />
                            <Text ellipsis style={{ fontSize: 11, color: token.colorTextSecondary, flex: 1 }}>
                                {item.websites_crawled && item.websites_crawled.length > 0 ? `${item.websites_crawled.length} nguồn` : 'Tất cả nguồn'}
                            </Text>
                        </Flex>

                        <Flex align="center" gap={8} style={{ width: '100%' }}>
                            <CalendarOutlined style={{ fontSize: 11, color: token.colorTextDescription }} />
                            <Text ellipsis style={{ fontSize: 11, color: token.colorTextTertiary, flex: 1 }}>
                                {dayjs(getItemTime(item)).format('DD/MM/YYYY HH:mm')}
                            </Text>
                        </Flex>
                    </Flex>
                </div>
            </Flex>
        );

        return {
            key: item.search_id,
            icon: (
                <div style={{ 
                    marginTop: 8, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: isSelected ? token.colorPrimary : `rgba(255,255,255,0.5)`,
                    color: isSelected ? '#fff' : accentColor,
                    boxShadow: isSelected ? 'none' : `0 2px 6px ${accentColor}20`,
                    transition: 'all 0.3s'
                }}>
                    <SearchOutlined style={{ fontSize: 16 }} />
                </div>
            ), 
            label: labelContent,
            onClick: () => handleHistoryClick(item.search_id),
            className: `history-card-item ${isSelected ? 'selected' : ''}`,
            style: {
                height: 'auto',
                marginBottom: 8,
                borderRadius: 12,
                paddingLeft: 12,
                border: isSelected ? `1px solid ${token.colorPrimary}60` : '1px solid rgba(255,255,255,0.6)',
                background: isSelected 
                    ? '#ffffff' 
                    : 'rgba(255, 255, 255, 0.6)', 
                boxShadow: isSelected 
                    ? `0 6px 16px -6px ${token.colorPrimary}40` 
                    : 'none',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }
        };
    });

    return (
        <Sider 
            width={280} 
            theme="light" 
            style={{ 
                borderRight: `1px solid rgba(0,0,0,0.06)`,
                height: '100%', 
                background: '#e6f7ff',
                overflow: 'hidden'
            }}
            collapsible={true}
            collapsed={isCollapsed}
            onCollapse={(collapsed) => setIsCollapsed(collapsed)}
            collapsedWidth={80}
            trigger={null} 
        >
            <Flex vertical style={{ height: '100%' }}>
                <div style={{ 
                    padding: '24px 16px 16px', 
                    background: '#e6f7ff',
                    flexShrink: 0,
                    borderBottom: '1px solid rgba(5, 5, 5, 0.06)'
                }}>
                    <Flex align="center" justify="space-between" style={{ marginBottom: 20 }}>
                        {!isCollapsed && (
                            <Flex align="center" gap={10}>
                                <div style={{ 
                                    background: '#fff', 
                                    padding: 8, 
                                    borderRadius: 12, 
                                    display: 'flex',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                                }}>
                                    <ClockCircleFilled style={{ fontSize: 20, color: token.colorPrimary }} />
                                </div>
                                <Title level={5} style={{ margin: 0, fontSize: 18, color: token.colorTextHeading }}>Lịch sử</Title>
                            </Flex>
                        )}
                        
                        <Button 
                            type="text" 
                            shape="circle"
                            icon={isCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} 
                            onClick={toggleCollapsed}
                            style={{ 
                                marginLeft: isCollapsed ? 'auto' : 0, 
                                marginRight: isCollapsed ? 'auto' : 0,
                                color: token.colorTextSecondary,
                                background: 'rgba(255,255,255,0.5)'
                            }}
                        />
                    </Flex>

                    {!isCollapsed ? (
                        <Link href="/model/search" style={{ width: '100%' }}>
                            <Button 
                                type="primary" 
                                block 
                                icon={<PlusOutlined />}
                                size="large"
                                style={{ 
                                    background: `linear-gradient(90deg, ${token.colorPrimary}, #096dd9)`,
                                    border: 'none',
                                    height: 48,
                                    fontSize: 15,
                                    fontWeight: 600,
                                    borderRadius: 14,
                                    boxShadow: `0 8px 16px -4px ${token.colorPrimary}60`,
                                    transition: 'all 0.3s'
                                }}
                                className="sidebar-action-btn"
                            >
                                TÌM KIẾM MỚI
                            </Button>
                        </Link>
                    ) : (
                        <Tooltip title="Tạo tìm kiếm mới" placement="right">
                            <Link href="/model/search">
                                <Button 
                                    type="primary" 
                                    shape="circle" 
                                    icon={<PlusOutlined />} 
                                    size="large"
                                    style={{ 
                                        display: 'flex', margin: '0 auto',
                                        background: `linear-gradient(135deg, ${token.colorPrimary}, #096dd9)`,
                                        border: 'none',
                                        boxShadow: `0 4px 12px ${token.colorPrimary}50`
                                    }}
                                />
                            </Link>
                        </Tooltip>
                    )}
                </div>

                <div className="custom-scrollbar" style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    padding: '8px 12px',
                    scrollbarWidth: 'thin',
                    height: '100%'
                }}>
                    {isLoadingHistory ? (
                        <Flex justify="center" align="center" style={{ height: 150, flexDirection: 'column', gap: 12 }}>
                            <Spin size="default" />
                            <Text type="secondary" style={{ fontSize: 13 }}>Đang tải lịch sử...</Text>
                        </Flex>
                    ) : searchHistory.length > 0 ? (
                        <Menu
                            mode="inline"
                            style={{ 
                                border: 'none', 
                                background: 'transparent'
                            }}
                            items={menuItems}
                            selectedKeys={selectedMenuKey ? [selectedMenuKey] : []} 
                        />
                    ) : (
                        <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                            {!isCollapsed && (
                                <Empty 
                                    image={Empty.PRESENTED_IMAGE_SIMPLE} 
                                    description={<Text type="secondary" style={{ fontSize: 13 }}>Chưa có lịch sử tìm kiếm</Text>} 
                                />
                            )}
                        </div>
                    )}
                </div>
            </Flex>

            <style jsx global>{`
                /* Hiệu ứng hover cho thẻ item */
                .history-card-item {
                    margin-top: 0; 
                }
                
                .history-card-item:hover {
                    background: #bae7ff !important; /* MÀU NỀN ĐẬM HƠN (Xanh đậm) khi hover */
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
                    border-color: ${token.colorPrimary} !important;
                    z-index: 1;
                }

                .sidebar-action-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 12px 20px -4px ${token.colorPrimary}80 !important;
                }
                
                /* Tùy chỉnh thanh cuộn tinh tế hơn */
                .custom-scrollbar::-webkit-scrollbar {
                    width: 5px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: rgba(0, 0, 0, 0.1);
                    border-radius: 20px;
                }
                .custom-scrollbar:hover::-webkit-scrollbar-thumb {
                    background-color: rgba(0, 0, 0, 0.2);
                }
                
                .ant-menu-item-selected {
                    background-color: transparent !important;
                }
                
                .ant-menu-inline-collapsed > .ant-menu-item .ant-menu-item-title {
                    display: none;
                }
            `}</style>
        </Sider>
    );
};

export default ClientSidebar;