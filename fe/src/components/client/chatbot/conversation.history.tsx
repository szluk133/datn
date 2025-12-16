'use client';

import React, { useEffect } from 'react';
import { Layout, Menu, Button, Spin, Empty, Typography, theme, Flex } from 'antd';
import { PlusOutlined, MessageOutlined, HistoryOutlined } from '@ant-design/icons';
import { useChatbot } from './chatbot.context';
import type { MenuProps } from 'antd';

const { Title, Text } = Typography;

const ConversationHistory: React.FC<{ collapsed?: boolean }> = ({ collapsed }) => {
    const { token } = theme.useToken();
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
        label: (
            <Text ellipsis style={{ width: collapsed ? 0 : '100%', color: 'inherit' }}>
                {convo.title || "Cuộc trò chuyện mới"}
            </Text>
        ),
        icon: <MessageOutlined />,
        onClick: () => loadMessages(convo.conversation_id),
        style: {
            borderRadius: token.borderRadiusLG,
            margin: '4px 0',
        }
    }));

    return (
        <Flex vertical style={{ height: '100%', background: token.colorBgContainer }}>
            <div style={{ padding: '16px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                {collapsed ? (
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={startNewChat}
                        block
                        shape="circle"
                        title="Đoạn chat mới"
                    />
                ) : (
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={startNewChat}
                        block
                        style={{ 
                            borderRadius: 8, 
                            height: 40, 
                            background: token.colorPrimary,
                            fontWeight: 500
                        }}
                    >
                        Đoạn chat mới
                    </Button>
                )}
            </div>
            
            {!collapsed && (
                <div style={{ padding: '16px 16px 8px 24px' }}>
                    <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>
                        <HistoryOutlined style={{ marginRight: 6 }} /> Lịch sử trò chuyện
                    </Text>
                </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
                {isLoadingApi && conversations.length === 0 ? (
                    <Flex justify="center" align="center" style={{ marginTop: 20 }}>
                        <Spin />
                    </Flex>
                ) : conversations.length > 0 ? (
                    <Menu
                        mode="inline"
                        items={menuItems}
                        selectedKeys={[currentConversationId || '']}
                        style={{ border: 'none' }}
                        inlineCollapsed={collapsed}
                    />
                ) : (
                    !collapsed && (
                        <Empty 
                            image={Empty.PRESENTED_IMAGE_SIMPLE} 
                            description={<Text type="secondary">Chưa có hội thoại nào</Text>} 
                            style={{ marginTop: 30 }}
                        />
                    )
                )}
            </div>
        </Flex>
    );
};

export default ConversationHistory;