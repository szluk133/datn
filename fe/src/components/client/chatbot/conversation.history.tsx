'use client';

import React, { useEffect } from 'react';
import { Layout, Menu, Button, Spin, Empty, Typography } from 'antd';
import { PlusOutlined, HistoryOutlined } from '@ant-design/icons';
import { useChatbot } from './chatbot.context';
import type { MenuProps } from 'antd';

const { Title } = Typography;

const ConversationHistory: React.FC<{ collapsed?: boolean }> = ({ collapsed }) => {
    const {
        conversations,
        loadConversations,
        loadMessages,
        startNewChat,
        isLoadingApi,
        currentConversationId,
    } = useChatbot();

    useEffect(() => {
        if (conversations.length === 0) {
            loadConversations();
        }
    }, []);

    const menuItems: MenuProps['items'] = conversations.map(convo => ({
        key: convo.conversation_id,
        label: collapsed ? "" : (convo.title.length > 25 ? `${convo.title.substring(0, 25)}...` : convo.title),
        icon: collapsed ? <HistoryOutlined /> : null,
        onClick: () => loadMessages(convo.conversation_id),
        style: {
            borderRadius: '6px',
            fontSize: '14px',
            margin: '4px 0',
            paddingLeft: collapsed ? '16px' : '24px'
        }
    }));

    return (
        <Layout style={{ height: '100%', background: '#fff' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #e8e8e8' }}>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={startNewChat}
                    style={{ width: '100%' }}
                >
                    {!collapsed && "Đoạn chat mới"}
                </Button>
            </div>
            
            {!collapsed && (
                <Title
                    level={5}
                    style={{
                        padding: '16px 16px 8px 16px',
                        margin: 0,
                        color: '#666',
                        textTransform: 'uppercase',
                        fontSize: '12px'
                    }}
                >
                    <HistoryOutlined style={{ marginRight: '8px' }} /> Lịch sử
                </Title>
            )}

            {isLoadingApi && conversations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px' }}><Spin /></div>
            ) : conversations.length > 0 ? (
                <Menu
                    mode="inline"
                    items={menuItems}
                    selectedKeys={[currentConversationId || '']}
                    style={{ borderRight: 0, flex: 1, overflowY: 'auto', padding: '0 8px' }}
                    inlineCollapsed={collapsed}
                />
            ) : (
                !collapsed && <Empty description="Chưa có cuộc trò chuyện nào" style={{ padding: '20px' }} />
            )}
        </Layout>
    );
};

export default ConversationHistory;
