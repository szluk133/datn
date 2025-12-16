'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button, Layout, Card, Typography, theme, Flex, Tooltip } from 'antd';
import { 
    MessageOutlined, 
    CloseOutlined, 
    ArrowsAltOutlined, 
    ShrinkOutlined, 
    RobotOutlined 
} from '@ant-design/icons';
import { useChatbot } from './chatbot.context';
import ChatWindow from './chat.window';
import ConversationHistory from './conversation.history';
import ChatInput from './chat.input';

const { Sider, Content } = Layout;
const { Text } = Typography;

const Chatbot: React.FC = () => {
    const { token } = theme.useToken();
    const { data: session, status } = useSession();
    const { view, setView } = useChatbot();
    const [historyCollapsed, setHistoryCollapsed] = useState(false);

    if (status !== 'authenticated') {
        return null;
    }

    if (view === 'icon') {
        return (
            <Tooltip title="Trợ lý AI" placement="left">
                <Button
                    type="primary"
                    shape="circle"
                    icon={<MessageOutlined style={{ fontSize: 24 }} />}
                    size="large"
                    style={{
                        position: 'fixed',
                        bottom: 30,
                        right: 30,
                        width: 60,
                        height: 60,
                        boxShadow: '0 6px 16px rgba(24, 144, 255, 0.35)',
                        zIndex: 1000,
                        background: `linear-gradient(135deg, ${token.colorPrimary}, ${token.colorPrimaryActive})`,
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    onClick={() => setView('window')}
                    className="chatbot-trigger"
                />
            </Tooltip>
        );
    }

    if (view === 'window') {
        return (
            <Card
                title={
                    <Flex align="center" gap={8}>
                        <RobotOutlined style={{ color: token.colorPrimary, fontSize: 18 }} />
                        <Text strong>Trợ lý ảo LVC</Text>
                    </Flex>
                }
                extra={
                    <Flex gap={4}>
                        <Tooltip title="Mở rộng">
                            <Button
                                type="text"
                                size="small"
                                icon={<ArrowsAltOutlined />}
                                onClick={() => setView('full')}
                            />
                        </Tooltip>
                        <Tooltip title="Thu nhỏ">
                            <Button
                                type="text"
                                size="small"
                                icon={<CloseOutlined />}
                                onClick={() => setView('icon')}
                            />
                        </Tooltip>
                    </Flex>
                }
                style={{
                    position: 'fixed',
                    bottom: 30,
                    right: 30,
                    width: 400,
                    height: 600,
                    maxHeight: '80vh',
                    boxShadow: '0 12px 48px rgba(0,0,0,0.12)',
                    zIndex: 1000,
                    borderRadius: 16,
                    overflow: 'hidden',
                    border: `1px solid ${token.colorBorderSecondary}`
                }}
                styles={{
                    header: {
                        borderBottom: `1px solid ${token.colorBorderSecondary}`,
                        padding: '12px 20px',
                        background: token.colorBgContainer,
                    },
                    body: {
                        padding: 0,
                        height: 'calc(100% - 57px)',
                        display: 'flex',
                        flexDirection: 'column',
                    }
                }}
            >
                <ChatWindow />
                <ChatInput />
            </Card>
        );
    }

    if (view === 'full') {
        return (
            <Layout
                style={{
                    position: 'fixed',
                    top: 64,
                    right: 0,
                    bottom: 0,
                    width: '60vw',
                    minWidth: 600,
                    maxWidth: 1000,
                    zIndex: 999,
                    boxShadow: '-8px 0 24px rgba(0,0,0,0.08)',
                    borderLeft: `1px solid ${token.colorBorderSecondary}`
                }}
            >
                <Sider
                    theme="light"
                    width={280}
                    collapsible
                    collapsedWidth={80}
                    collapsed={historyCollapsed}
                    onCollapse={(collapsed) => setHistoryCollapsed(collapsed)}
                    style={{ borderRight: `1px solid ${token.colorBorderSecondary}` }}
                >
                    <ConversationHistory collapsed={historyCollapsed} />
                </Sider>

                <Layout style={{ background: token.colorBgContainer }}>
                    <div style={{
                        padding: '16px 24px',
                        borderBottom: `1px solid ${token.colorBorderSecondary}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: token.colorBgLayout,
                    }}>
                        <Flex align="center" gap={10}>
                            <RobotOutlined style={{ fontSize: 20, color: token.colorPrimary }} />
                            <Text strong style={{ fontSize: 16 }}>Trợ lý tìm kiếm & Phân tích</Text>
                        </Flex>
                        
                        <Button
                            type="default"
                            icon={<ShrinkOutlined />}
                            onClick={() => setView('window')}
                        >
                            Thu nhỏ
                        </Button>
                    </div>

                    <Content style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                        <ChatWindow />
                        <ChatInput />
                    </Content>
                </Layout>
            </Layout>
        );
    }

    return null;
};

export default Chatbot;