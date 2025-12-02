'use client';

import React from 'react';
import { Layout } from 'antd';
import { SessionProvider } from 'next-auth/react';
import ClientHeader from '@/components/client/layout/client.header';
import ClientSidebar from '@/components/client/layout/client.sidebar';
import ClientFooter from '@/components/client/layout/client.footer';
import { ClientContextProvider } from '@/components/client/layout/client.context';
import { ChatContextProvider, useChatbot } from '@/components/client/chatbot/chatbot.context';
import Chatbot from '@/components/client/chatbot/chatbot';

const { Content } = Layout;

const ClientLayoutContent = ({ children }: { children: React.ReactNode }) => {
    const { view } = useChatbot();

    return (
        // 1. Layout Gốc - Cố định chiều cao 100vh và ẩn scroll body
        <Layout style={{ height: '100vh', overflow: 'hidden' }}>
            
            {/* Header luôn cố định ở trên cùng */}
            <ClientHeader />

            {/* 3. Layout Con - Chứa Sidebar và Content */}
            <Layout
                style={{
                    width: view === 'full' ? '50%' : '100%',
                    transition: 'width 0.3s ease-in-out',
                    // Quan trọng: Trừ đi chiều cao Header (mặc định Antd là 64px)
                    // Điều này giúp Layout con nằm gọn trong màn hình
                    height: 'calc(100vh - 64px)', 
                }}
            >
                {/* Sidebar sẽ có thanh cuộn riêng (được cấu hình trong file client.sidebar.tsx) */}
                <ClientSidebar />
                
                {/* Content Wrapper - Vùng này sẽ cuộn độc lập */}
                <Layout style={{ 
                    padding: '0 24px 24px', 
                    overflowY: 'auto', // QUAN TRỌNG: Cho phép cuộn dọc nội dung
                    height: '100%',    // Chiếm toàn bộ chiều cao còn lại
                    background: '#f0f2f5' // Màu nền layout
                }}>
                    <Content
                        style={{
                            padding: 24,
                            margin: 0,
                            minHeight: 280,
                            background: '#fff',
                            borderRadius: 8,
                            marginTop: 24,
                            flex: 'none' // Đảm bảo content co giãn đúng theo nội dung
                        }}
                    >
                        {children}
                    </Content>
                    <ClientFooter />
                </Layout>
            </Layout>
        </Layout>
    );
}

const ClientLayout = ({ children }: { children: React.ReactNode }) => {
    return (
        <SessionProvider>
            <ChatContextProvider>
                <ClientContextProvider>
                    <ClientLayoutContent>{children}</ClientLayoutContent>
                    <Chatbot />
                </ClientContextProvider>
            </ChatContextProvider>
        </SessionProvider>
    );
};

export default ClientLayout;