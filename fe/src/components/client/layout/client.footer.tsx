'use client';

import React from 'react';
import { Layout, theme, Typography, Space } from 'antd';
import { GithubOutlined, MailOutlined } from '@ant-design/icons';

const { Footer } = Layout;
const { Text } = Typography;

const ClientFooter: React.FC = () => {
    const { token } = theme.useToken();

    return (
        <Footer style={{ 
            textAlign: 'center', 
            background: token.colorBgLayout,
            padding: '24px 50px',
            color: token.colorTextSecondary
        }}>
            <Space orientation="vertical" size="small">

                <Text type="secondary">
                    LVC ©{new Date().getFullYear()} - Nền tảng thu thập dữ liệu thông minh
                </Text>
                
                <Space size="large" separator={<span style={{ color: token.colorBorder }}>|</span>}>
                    <Space size={4} style={{ cursor: 'pointer' }}>
                        <GithubOutlined /> <span className="hover:underline">Mã nguồn</span>
                    </Space>
                    <Space size={4} style={{ cursor: 'pointer' }}>
                        <MailOutlined /> <span className="hover:underline">Liên hệ hỗ trợ</span>
                    </Space>
                </Space>
            </Space>
        </Footer>
    );
};

export default ClientFooter;