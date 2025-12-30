'use client';

import React, { useRef, useEffect } from 'react';
import { Spin, Typography, Avatar, Flex, theme, Space } from 'antd';
import { useChatbot } from './chatbot.context';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link'; 
import { SourceDto } from '@/types/next-auth'; 
import { UserOutlined, RobotOutlined } from '@ant-design/icons';
import { useSession } from 'next-auth/react';

const { Text } = Typography;

const AnswerRenderer: React.FC<{ answer: string; sources: SourceDto[] | null }> = ({ answer, sources }) => {
    const { token } = theme.useToken();
    
    if (!sources || sources.length === 0 || answer === '...') {
        return <ReactMarkdown>{answer}</ReactMarkdown>;
    }
    
    const citationRegex = /(\((?:Source|Nguồn|source|nguồn):\s*\[?)([^\])]+)(\]?\))/g;

    const parts = answer.split(citationRegex);
    
    return (
        <div style={{ lineHeight: 1.6 }}>
            {parts.map((part, index) => {
                const type = index % 4;

                if (type === 0) { 
                    if (!part) return null;
                    return <ReactMarkdown key={index} components={{ p: 'span' }}>{part}</ReactMarkdown>;
                }

                if (type === 1) { 
                    return <Text key={index} type="secondary">{part}</Text>;
                }

                if (type === 2) { 
                    const title = part ? part.trim() : "";
                    const source = sources.find(s => s.title.trim().toLowerCase() === title.toLowerCase());

                    if (source && source._id) {
                        return (
                            <Link 
                                href={`/model/article/${source._id}`} 
                                key={index}
                                style={{ 
                                    color: token.colorPrimary,
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                    textDecoration: 'none',
                                }} 
                                title={`Xem bài viết: ${title}`}
                                onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                            >
                                {part}
                            </Link>
                        );
                    }
                    return <Text key={index} strong>{part}</Text>;
                }

                if (type === 3) { 
                    return <Text key={index} type="secondary">{part}</Text>;
                }

                return null;
            })}
        </div>
    );
};

const ChatWindow: React.FC = () => {
    const { token } = theme.useToken();
    const { data: session } = useSession();
    const { messages, isLoadingApi } = useChatbot();
    const messagesEndRef = useRef<null | HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoadingApi]);

    if (messages.length === 0 && !isLoadingApi) {
        return (
            <Flex justify="center" align="center" style={{ height: '100%', flexDirection: 'column', gap: 16 }}>
                <div style={{ 
                    background: token.colorFillSecondary, 
                    padding: 24, 
                    borderRadius: '50%',
                    marginBottom: 8 
                }}>
                    <RobotOutlined style={{ fontSize: 48, color: token.colorPrimary }} />
                </div>
                <Text type="secondary" style={{ fontSize: 16 }}>Tôi có thể giúp gì cho bạn hôm nay?</Text>
            </Flex>
        )
    }

    return (
        <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 20px',
            background: token.colorBgContainer,
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            scrollbarWidth: 'thin',
        }}>
            {messages.map((item, index) => (
                <div key={item._id || `msg-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    
                    <Flex justify="end" gap={12}>
                        <div style={{
                            padding: '12px 16px',
                            borderRadius: '16px 4px 16px 16px',
                            background: token.colorPrimaryBg,
                            color: token.colorText,
                            maxWidth: '85%',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            fontSize: 15,
                            lineHeight: 1.5
                        }}>
                            <ReactMarkdown>{item.query}</ReactMarkdown>
                        </div>
                        <Avatar 
                            src={session?.user?.image} 
                            icon={<UserOutlined />} 
                            style={{ backgroundColor: token.colorPrimary, flexShrink: 0 }} 
                        />
                    </Flex>
                    
                    <Flex justify="start" gap={12}>
                        <Avatar 
                            icon={<RobotOutlined />} 
                            style={{ backgroundColor: token.colorSuccess, flexShrink: 0 }} 
                        />
                        <div style={{
                            padding: '12px 16px',
                            borderRadius: '4px 16px 16px 16px',
                            background: token.colorFillQuaternary,
                            color: token.colorText,
                            maxWidth: '90%',
                            fontSize: 15,
                        }}>
                            {item.answer === '...' ? (
                                <Space>
                                    <Spin size="small" />
                                    <Text type="secondary">Đang suy nghĩ...</Text>
                                </Space>
                            ) : (
                                <AnswerRenderer answer={item.answer} sources={item.sources} />
                            )}
                        </div>
                    </Flex>

                </div>
            ))}
            
            {isLoadingApi && messages.length > 0 && messages[messages.length - 1]?.answer !== '...' && (
                <Flex justify="start" gap={12}>
                    <Avatar icon={<RobotOutlined />} style={{ backgroundColor: token.colorSuccess }} />
                    <div style={{
                        padding: '12px 16px',
                        borderRadius: '4px 16px 16px 16px',
                        background: token.colorFillQuaternary,
                    }}>
                        <Space>
                            <Spin size="small" />
                            <Text type="secondary">Đang trả lời...</Text>
                        </Space>
                    </div>
                </Flex>
            )}
            <div ref={messagesEndRef} />
        </div>
    );
};

export default ChatWindow;