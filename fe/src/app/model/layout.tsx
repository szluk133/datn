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
        <Layout style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: '0 0 auto' }}>
                <ClientHeader />
            </div>

            <Layout
                style={{
                    width: view === 'full' ? '50%' : '100%',
                    transition: 'width 0.3s ease-in-out',
                    flex: 1,
                    overflow: 'hidden',
                    position: 'relative'
                }}
            >
                <ClientSidebar />
                
                <Layout style={{ 
                    padding: '0 24px 24px', 
                    overflowY: 'auto',
                    height: '100%',
                    background: '#f0f2f5'
                }}>
                    <Content
                        style={{
                            padding: 24,
                            margin: 0,
                            minHeight: 280,
                            background: '#fff',
                            borderRadius: 8,
                            marginTop: 24,
                            flex: 'none'
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