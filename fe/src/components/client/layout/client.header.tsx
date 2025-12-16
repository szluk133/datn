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
    StarOutlined
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

    useEffect(() => {
        if (pathname === '/model') {
            setCurrentKey('home');
        } else if (pathname?.startsWith('/model/search')) {
            setCurrentKey('search');
        } else if (pathname?.startsWith('/model/saved-articles')) {
            setCurrentKey('saved');
        } else if (pathname?.startsWith('/model/article')) {
            setCurrentKey('article');
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
        },
    ];

    const navItems: MenuProps['items'] = [
        { label: 'Trang chủ', key: 'home', icon: <HomeOutlined /> },
        { label: 'Công cụ Crawler', key: 'search', icon: <SearchOutlined /> },
        { label: 'Thư viện đã lưu', key: 'saved', icon: <StarOutlined /> },
    ];

    return (
        <Header style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
        }}>
            <Link href="/model" onClick={handleLogoClick} style={{ textDecoration: 'none', minWidth: 200 }}>
                <Flex align="center" gap={10}>
                    <div style={{ 
                        background: token.colorFillQuaternary, 
                        padding: 6, 
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <RocketTwoTone twoToneColor={token.colorPrimary} style={{ fontSize: 22 }} />
                    </div>
                    <Text strong style={{ fontSize: 20, color: token.colorTextHeading, letterSpacing: -0.5, fontFamily: 'sans-serif' }}>
                        LVC <span style={{ fontWeight: 400, color: token.colorTextSecondary }}>Crawler</span>
                    </Text>
                </Flex>
            </Link>

            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <Menu 
                    mode="horizontal" 
                    selectedKeys={[currentKey]} 
                    items={navItems} 
                    onClick={handleMenuClick}
                    style={{ 
                        borderBottom: 'none', 
                        background: 'transparent',
                        width: 'auto',
                        minWidth: 400,
                        display: 'flex',
                        justifyContent: 'center',
                        fontSize: 15,
                        fontWeight: 500
                    }}
                />
            </div>

            <div style={{ minWidth: 200, display: 'flex', justifyContent: 'flex-end' }}>
                {loading ? (
                    <div style={{ width: 100 }} /> 
                ) : session ? (
                    <Dropdown menu={{ items: userMenu }} placement="bottomRight" trigger={['click']}>
                        <Space 
                            style={{ 
                                cursor: 'pointer', 
                                padding: '6px 16px',
                                borderRadius: 12,
                                transition: 'all 0.3s',
                                border: `1px solid ${token.colorBorderSecondary}`,
                                backgroundColor: token.colorBgContainer
                            }} 
                            className="hover:shadow-sm"
                        >
                            <Avatar 
                                style={{ backgroundColor: token.colorPrimary, verticalAlign: 'middle' }} 
                                icon={<UserOutlined />} 
                                size={32}
                                src={session.user?.image}
                            />
                            <Flex vertical gap={0} style={{ lineHeight: 1.3, textAlign: 'left', minWidth: 80 }}>
                                <Text strong style={{ fontSize: 14, color: token.colorTextHeading }} ellipsis>
                                    {session.user?.name ?? "User"}
                                </Text>
                                <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
                                    {session.user?.email}
                                </Text>
                            </Flex>
                            <DownOutlined style={{ fontSize: 10, color: token.colorTextDescription, marginLeft: 4 }} />
                        </Space>
                    </Dropdown>
                ) : (
                    <Space size="middle">
                        <Link href="/auth/login">
                            <Button type="text" icon={<LoginOutlined />}>Đăng nhập</Button>
                        </Link>
                        <Link href="/auth/register">
                            <Button type="primary" shape="round" style={{ padding: '0 24px' }}>Đăng ký</Button>
                        </Link>
                    </Space>
                )}
            </div>
        </Header>
    );
};

export default ClientHeader;