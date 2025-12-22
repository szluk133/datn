'use client';

import React from 'react';
import { Layout, theme, Typography, Space, Divider } from 'antd';
import { GithubOutlined, MailOutlined, HeartFilled } from '@ant-design/icons';

const { Footer } = Layout;
const { Text, Link } = Typography;

const ClientFooter: React.FC = () => {
    const { token } = theme.useToken();

    return (
        <Footer style={{ 
            textAlign: 'center', 
            background: '#fafafa',
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            padding: '32px 50px',
            color: token.colorTextSecondary
        }}>
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                
                <Space separator={<Divider orientation="vertical" />} align="center">
                    <Text strong style={{ fontSize: 15, color: token.colorText }}>LVC Crawler</Text>
                    <Text type="secondary">Nền tảng thu thập dữ liệu thông minh</Text>
                </Space>

                <Text type="secondary" style={{ fontSize: 13 }}>
                    © {new Date().getFullYear()} Phát triển với <HeartFilled style={{ color: '#ff4d4f', fontSize: 12 }} /> bởi đội ngũ LVC
                </Text>
                
                <Space size="large" style={{ marginTop: 8 }}>
                    <Link href="#" style={{ color: token.colorTextSecondary }} className="footer-link">
                        <Space size={6}>
                            <GithubOutlined /> <span>Github</span>
                        </Space>
                    </Link>
                    <Link href="mailto:support@lvc.com" style={{ color: token.colorTextSecondary }} className="footer-link">
                        <Space size={6}>
                            <MailOutlined /> <span>Liên hệ hỗ trợ</span>
                        </Space>
                    </Link>
                </Space>
            </Space>

            <style jsx global>{`
                .footer-link:hover {
                    color: ${token.colorPrimary} !important;
                    text-decoration: underline;
                }
            `}</style>
        </Footer>
    );
};

export default ClientFooter;