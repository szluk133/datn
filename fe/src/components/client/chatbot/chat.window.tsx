'use client';

import React, { useRef, useEffect } from 'react';
import { Spin, Typography, Empty } from 'antd';
import { useChatbot } from './chatbot.context';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link'; 
import { SourceDto } from '@/types/next-auth'; 

const { Text } = Typography;

const AnswerRenderer: React.FC<{ answer: string; sources: SourceDto[] | null }> = ({ answer, sources }) => {
    if (!sources || sources.length === 0 || answer === '...') {
        return <ReactMarkdown>{answer}</ReactMarkdown>;
    }
    const citationRegex = /(\(Nguồn: \[([^\]]+)\]\))/g;
    const parts = answer.split(citationRegex);
    return (
        <span>
            {parts.map((part, index) => {
                if ((index - 2) % 3 === 0) {
                    const fullCitation = parts[index - 1]; 
                    const title = part; 
                    const source = sources.find(s => s.title.trim() === title.trim());

                    if (source) {
                        return (
                            <Link href={`/model/article/${source.article_id}`} key={index} passHref legacyBehavior>
                                <Typography.Link target="_blank" rel="noopener noreferrer" style={{ whiteSpace: 'nowrap' }}>
                                    {fullCitation}
                                </Typography.Link>
                            </Link>
                        );
                    }
                    return <span key={index}>{fullCitation}</span>;
                }
                
                if ((index - 1) % 3 === 0) {
                    return null;
                }

                if (index % 3 === 0 && part) {
                    return <ReactMarkdown key={index} components={{ p: 'span' }}>{part}</ReactMarkdown>;
                }
                
                return null;
            })}
        </span>
    );
};


const ChatWindow: React.FC = () => {
    const { messages, isLoadingApi } = useChatbot();
    const messagesEndRef = useRef<null | HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const chatContainerStyle: React.CSSProperties = {
        flex: 1,
        overflowY: 'auto',
        padding: '20px 16px',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
    };

    const bubbleBaseStyle: React.CSSProperties = {
        padding: '10px 16px',
        borderRadius: '18px',
        maxWidth: '85%',
        marginBottom: '12px',
        fontSize: '15px',
        lineHeight: '1.5',
        wordBreak: 'break-word',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    };

    const userMessageStyle: React.CSSProperties = {
        ...bubbleBaseStyle,
        alignSelf: 'flex-end',
        background: '#e6f7ff',
        color: '#222',
    };

    const botMessageStyle: React.CSSProperties = {
        ...bubbleBaseStyle,
        alignSelf: 'flex-start',
        background: '#f5f5f5',
        color: '#222',
    };


    if (messages.length === 0 && !isLoadingApi) {
        return (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Empty description="Bắt đầu cuộc trò chuyện mới" />
            </div>
        )
    }

    return (
        <div style={chatContainerStyle}>
            {messages.map((item, index) => (
                <React.Fragment key={item._id || `msg-${index}`}>
                    <div style={userMessageStyle}>
                        <ReactMarkdown>{item.query}</ReactMarkdown>
                    </div>
                    
                    <div style={botMessageStyle}>
                        {item.answer === '...' ? (
                            <Spin size="small" />
                        ) : (
                            <AnswerRenderer answer={item.answer} sources={item.sources} />
                        )}
                    </div>
                </React.Fragment>
            ))}
            
            {isLoadingApi && messages.length > 0 && messages[messages.length - 1]?.answer !== '...' && (
                <div style={{ ...botMessageStyle, width: 'fit-content' }}>
                    <Spin size="small" />
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>
    );
};

export default ChatWindow;
