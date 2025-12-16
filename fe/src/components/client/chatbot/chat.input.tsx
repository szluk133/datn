'use client';

import React, { useState } from 'react';
import { Input, Button, Flex, theme } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useChatbot } from './chatbot.context';

const { TextArea } = Input;

const ChatInput: React.FC = () => {
    const { token } = theme.useToken();
    const [question, setQuestion] = useState('');
    const { sendMessage, isLoadingApi } = useChatbot();

    const handleSend = () => {
        if (question.trim() && !isLoadingApi) {
            sendMessage(question);
            setQuestion('');
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div style={{
            padding: '16px',
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgContainer,
        }}>
            <Flex gap={12} align="flex-end">
                <TextArea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Nhập câu hỏi của bạn..."
                    autoSize={{ minRows: 1, maxRows: 4 }}
                    disabled={isLoadingApi}
                    variant="filled"
                    style={{
                        borderRadius: 12,
                        resize: 'none',
                        padding: '10px 12px',
                        fontSize: 15
                    }}
                />
                <Button
                    type="primary"
                    shape="circle"
                    size="large"
                    icon={<SendOutlined style={{ marginLeft: 2 }} />}
                    onClick={handleSend}
                    loading={isLoadingApi}
                    disabled={!question.trim()}
                    style={{ marginBottom: 2 }}
                />
            </Flex>
        </div>
    );
};

export default ChatInput;