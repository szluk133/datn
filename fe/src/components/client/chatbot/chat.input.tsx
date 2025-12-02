'use client';

import React, { useState } from 'react';
import { Input, Button } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useChatbot } from './chatbot.context';

const { TextArea } = Input;

const ChatInput: React.FC = () => {
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
            borderTop: '1px solid #e8e8e8',
            background: '#fafafa',
            display: 'flex',
            alignItems: 'center',
        }}>
            <TextArea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Nhập câu hỏi của bạn..."
                autoSize={{ minRows: 1, maxRows: 3 }}
                disabled={isLoadingApi}
                style={{
                    flex: 1,
                    marginRight: '12px',
                    borderRadius: '8px',
                    padding: '8px 12px',
                }}
            />
            <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSend}
                loading={isLoadingApi}
            >
                Gửi
            </Button>
        </div>
    );
};

export default ChatInput;
