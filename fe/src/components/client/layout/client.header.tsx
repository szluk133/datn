'use client';

import React from 'react';
import { Layout, Button, Space, Dropdown, MenuProps, Avatar } from 'antd';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation'; 
import { UserOutlined, LogoutOutlined, LoginOutlined } from '@ant-design/icons';

const { Header } = Layout;

const ClientHeader: React.FC = () => {
    const { data: session, status } = useSession();
    const loading = status === 'loading';

    const router = useRouter();
    const pathname = usePathname();

    const handleLogout = () => {
        signOut({ callbackUrl: '/auth/login' });
    };

    const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();

        if (pathname !== '/model/article') {
            router.back();
        } else {
            router.push('/model/article');
        }
    };

    const items: MenuProps['items'] = [
        {
            key: '1',
            icon: <UserOutlined />,
            label: (
                <span>Profile</span>
            ),
        },
        {
            key: '2',
            icon: <LogoutOutlined />,
            danger: true,
            label: 'Đăng xuất',
            onClick: handleLogout,
        },
    ];

    return (
        <Header style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#fff',
            borderBottom: '1px solid #f0f0f0'
        }}>
            <div className="logo" style={{ color: '#1890ff', fontWeight: 'bold', fontSize: '20px' }}>
                <a 
                    href="/model/article" 
                    onClick={handleLogoClick} 
                    style={{ color: 'inherit', textDecoration: 'none' }}
                >
                    LVC
                </a>
            </div>
            <div className="auth-controls">
                {loading ? (
                    <div />
                ) : session ? (
                    <Dropdown menu={{ items }} placement="bottomRight">
                        <Space style={{ cursor: 'pointer' }}>
                            <Avatar icon={<UserOutlined />} />
                            <span>{session.user?.name ?? session.user?.email}</span>
                        </Space>
                    </Dropdown>
                ) : (
                    <Space>
                        <Link href="/auth/login">
                            <Button icon={<LoginOutlined />}>Đăng nhập</Button>
                        </Link>
                        <Link href="/auth/register">
                            <Button type="primary">Đăng ký</Button>
                        </Link>
                    </Space>
                )}
            </div>
        </Header>
    );
};

export default ClientHeader;

