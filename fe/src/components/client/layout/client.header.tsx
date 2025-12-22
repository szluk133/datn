'use client';

import React, { useEffect, useState } from 'react';
import { Layout, Button, Space, Dropdown, MenuProps, Avatar, Flex, theme, Typography, Menu } from 'antd';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation'; 
import { 
    UserOutlined, 
    LogoutOutlined, 
    LoginOutlined, 
    RocketTwoTone, 
    DownOutlined,
    HomeOutlined,
    SearchOutlined,
    ReadOutlined,
    DatabaseOutlined
} from '@ant-design/icons';

const { Header } = Layout;
const { Text } = Typography;

const ClientHeader: React.FC = () => {
    const { token } = theme.useToken();
    const { data: session, status } = useSession();
    const loading = status === 'loading';

    const router = useRouter();
    const pathname = usePathname();
    const [currentKey, setCurrentKey] = useState<string>('home');
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            const isScrolled = window.scrollY > 10;
            if (isScrolled !== scrolled) {
                setScrolled(isScrolled);
            }
        };

        window.addEventListener('scroll', handleScroll);

        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, [scrolled]);

    useEffect(() => {
        if (pathname === '/model') {
            setCurrentKey('home');
        } else if (pathname?.startsWith('/model/search-available')) {
            setCurrentKey('search-available');
        } else if (pathname?.startsWith('/model/search')) {
            setCurrentKey('search');
        } else if (pathname?.startsWith('/model/saved-articles')) {
            setCurrentKey('saved');
        } else {
            setCurrentKey('');
        }
    }, [pathname]);

    const handleLogout = () => {
        signOut({ callbackUrl: '/auth/login' });
    };

    const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        router.push('/model');
    };

    const handleMenuClick: MenuProps['onClick'] = (e) => {
        switch (e.key) {
            case 'home':
                router.push('/model');
                break;
            case 'search-available':
                router.push('/model/search-available');
                break;
            case 'search':
                router.push('/model/search');
                break;
            case 'saved':
                router.push('/model/saved-articles');
                break;
            default:
                break;
        }
    };

    const userMenu: MenuProps['items'] = [
        {
            key: 'profile',
            icon: <UserOutlined />,
            label: <Text strong>Hồ sơ cá nhân</Text>,
            style: { padding: '10px 16px' }
        },
        {
            type: 'divider',
        },
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            danger: true,
            label: 'Đăng xuất',
            onClick: handleLogout,
            style: { padding: '10px 16px' }
        },
    ];

    const navItems: MenuProps['items'] = [
        { 
            label: 'Trang chủ', 
            key: 'home', 
            icon: <HomeOutlined /> 
        },
        { 
            label: 'Dữ liệu có sẵn', 
            key: 'search-available', 
            icon: <DatabaseOutlined /> 
        },
        { 
            label: 'Tìm kiếm nâng cao', 
            key: 'search', 
            icon: <SearchOutlined /> 
        },
        { 
            label: 'Thư viện đã lưu', 
            key: 'saved', 
            icon: <ReadOutlined /> 
        },
    ];

    return (
        <Header style={{
            background: scrolled 
                ? 'rgba(255, 255, 255, 0.98)' 
                : 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)', 
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderBottom: `1px solid ${scrolled ? 'rgba(0,0,0,0.06)' : 'transparent'}`,
            padding: '0 32px',
            position: 'sticky',
            top: 0,
            zIndex: 1000,
            boxShadow: scrolled ? '0 4px 20px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.02)',
            height: 72,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
            <Link href="/model" onClick={handleLogoClick} style={{ textDecoration: 'none', minWidth: 220 }}>
                <Flex align="center" gap={12}>
                    <div style={{ 
                        background: '#fff',
                        padding: 8, 
                        borderRadius: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                    }}>
                        <RocketTwoTone twoToneColor={token.colorPrimary} style={{ fontSize: 24 }} />
                    </div>
                    <Text strong style={{ 
                        fontSize: 24, 
                        letterSpacing: -0.5, 
                        fontFamily: 'sans-serif',
                        color: token.colorTextHeading
                    }}>
                        LVC <span style={{ fontWeight: 400, color: token.colorPrimary }}>Crawler</span>
                    </Text>
                </Flex>
            </Link>

            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0, margin: '0 20px' }}>
                <Menu 
                    mode="horizontal" 
                    selectedKeys={[currentKey]} 
                    items={navItems} 
                    onClick={handleMenuClick}
                    disabledOverflow={true}
                    style={{ 
                        borderBottom: 'none', 
                        background: 'transparent',
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        fontSize: 15,
                        fontWeight: 600, 
                        lineHeight: '70px'
                    }}
                    className="custom-header-menu"
                />
            </div>

            <div style={{ minWidth: 220, display: 'flex', justifyContent: 'flex-end' }}>
                {loading ? (
                    <div style={{ width: 100 }} /> 
                ) : session ? (
                    <Dropdown 
                        menu={{ items: userMenu }} 
                        placement="bottomRight" 
                        trigger={['click']}
                        styles={{  root: { paddingTop: 12,  }, }}
                    >
                        <Space 
                            style={{ 
                                cursor: 'pointer', 
                                padding: '6px 8px 6px 16px',
                                borderRadius: 30,
                                transition: 'all 0.3s',
                                border: '1px solid rgba(255,255,255,0.4)',
                                backgroundColor: 'rgba(255,255,255,0.6)',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                            }} 
                            className="user-dropdown-trigger"
                        >
                            <Flex vertical gap={0} style={{ lineHeight: 1.2, textAlign: 'right', minWidth: 80 }}>
                                <Text strong style={{ fontSize: 14, color: token.colorTextHeading }} ellipsis>
                                    {session.user?.name ?? "User"}
                                </Text>
                                <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
                                    {session.user?.email}
                                </Text>
                            </Flex>
                            <Avatar 
                                style={{ 
                                    backgroundColor: token.colorPrimary, 
                                    verticalAlign: 'middle',
                                    border: '2px solid #fff',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                }} 
                                icon={<UserOutlined />} 
                                size={36}
                                src={session.user?.image}
                            />
                            <DownOutlined style={{ fontSize: 10, color: token.colorTextDescription, marginLeft: 2 }} />
                        </Space>
                    </Dropdown>
                ) : (
                    <Space size="middle">
                        <Link href="/auth/login">
                            <Button type="text" icon={<LoginOutlined />} style={{ fontWeight: 600 }}>Đăng nhập</Button>
                        </Link>
                        <Link href="/auth/register">
                            <Button 
                                type="primary" 
                                shape="round" 
                                size="large"
                                style={{ 
                                    padding: '0 28px',
                                    background: `linear-gradient(135deg, ${token.colorPrimary}, ${token.colorPrimaryActive})`,
                                    border: 'none',
                                    boxShadow: `0 4px 14px ${token.colorPrimary}40`
                                }}
                            >
                                Đăng ký
                            </Button>
                        </Link>
                    </Space>
                )}
            </div>

            <style jsx global>{`
                /* Menu Item Style Upgrade */
                .custom-header-menu .ant-menu-item {
                    transition: all 0.3s !important;
                    margin: 0 6px !important;
                    border-radius: 50px !important; /* Pill shape */
                    color: ${token.colorText} !important; /* Màu chữ đậm hơn một chút để nổi trên nền xanh */
                }
                
                .custom-header-menu .ant-menu-item:hover {
                    color: ${token.colorPrimary} !important;
                    background: rgba(255,255,255,0.5) !important; /* Hover nền trắng mờ */
                }

                /* Active State Highlighting */
                .custom-header-menu .ant-menu-item-selected {
                    color: #fff !important;
                    background: ${token.colorPrimary} !important; 
                    box-shadow: 0 4px 12px ${token.colorPrimary}50 !important;
                }
                
                .custom-header-menu .ant-menu-item::after {
                    display: none !important; 
                }

                .user-dropdown-trigger:hover {
                    background: #fff !important;
                    box-shadow: 0 6px 16px rgba(0,0,0,0.1) !important;
                    transform: translateY(-1px);
                }
            `}</style>
        </Header>
    );
};

export default ClientHeader;