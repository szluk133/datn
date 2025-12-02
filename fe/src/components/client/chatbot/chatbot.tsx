'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button, Layout, Card, Typography } from 'antd';
import { MessageOutlined, CloseOutlined, ArrowsAltOutlined, ShrinkOutlined } from '@ant-design/icons';
import { useChatbot } from './chatbot.context';
import ChatWindow from './chat.window';
import ConversationHistory from './conversation.history';
import ChatInput from './chat.input';

const { Sider, Content } = Layout;

const Chatbot: React.FC = () => {
    const { data: session, status } = useSession();
    const { view, setView } = useChatbot();
    const [historyCollapsed, setHistoryCollapsed] = useState(false);

    if (status !== 'authenticated') {
        return null;
    }

    // Dạng 1: Icon ở góc
    if (view === 'icon') {
        return (
            <Button
                type="primary"
                shape="circle"
                icon={<MessageOutlined />}
                size="large"
                style={{
                    position: 'fixed',
                    bottom: 24,
                    right: 24,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                }}
                onClick={() => {
                    setView('window');
                }}
            />
        );
    }

    // Dạng 2: Khung chat nhỏ ở góc
    if (view === 'window') {
        return (
            <Card
                title="Chatbot"
                extra={
                    <>
                        <Button
                            type="text"
                            icon={<ArrowsAltOutlined />}
                            onClick={() => setView('full')}
                            style={{ marginRight: 8 }}
                        />
                        <Button
                            type="text"
                            icon={<CloseOutlined />}
                            onClick={() => setView('icon')}
                        />
                    </>
                }
                style={{
                    position: 'fixed',
                    bottom: 24,
                    right: 24,
                    width: 380,
                    maxHeight: '70vh',
                    minHeight: 400,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: '12px',
                    overflow: 'hidden',
                }}
                styles={{
                    header: {
                        borderBottom: '1px solid #f0f0f0',
                        padding: '16px 20px',
                    },
                    body: {
                        padding: 0,
                        flex: 1,
                        overflow: 'hidden',
                    }
                }}
            >
                <Layout style={{ height: '100%', background: '#fff' }}>
                    <Content style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <ChatWindow />
                    </Content>
                    <ChatInput />
                </Layout>
            </Card>
        );
    }

    // Dạng 3: Chiếm 1/2 màn hình
    if (view === 'full') {
        return (
            <Layout
                style={{
                    position: 'fixed',
                    top: 64,
                    right: 0,
                    bottom: 0,
                    width: '50vw',
                    minWidth: 600,
                    zIndex: 999,
                    boxShadow: '-4px 0 12px rgba(0,0,0,0.1)',
                    background: '#f0f2f5',
                    borderLeft: '1px solid #ddd'
                }}
            >
                <Sider
                    theme="light"
                    width={250}
                    collapsible
                    collapsedWidth={80}
                    collapsed={historyCollapsed}
                    onCollapse={(collapsed) => setHistoryCollapsed(collapsed)}
                    style={{ borderRight: '1px solid #f0f0f0' }}
                >
                    {React.createElement(ConversationHistory as any, { collapsed: historyCollapsed })}
                </Sider>
                <Layout style={{ background: '#fff' }}>
                    <div style={{
                        padding: '16px 24px',
                        borderBottom: '1px solid #f0f0f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: '#fafafa',
                    }}>
                        <Typography.Title level={4} style={{ margin: 0 }}>
                            Chatbot
                        </Typography.Title>
                        <Button
                            type="text"
                            icon={<ShrinkOutlined />}
                            onClick={() => setView('window')}
                        />
                    </div>

                    <Content style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <ChatWindow />
                    </Content>
                    <ChatInput />
                    
                </Layout>
            </Layout>
        );
    }

    return null;
};

export default Chatbot;

