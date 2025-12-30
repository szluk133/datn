'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Input, Button, Flex, theme, Tooltip } from 'antd';
import { SendOutlined, AudioOutlined, AudioMutedOutlined } from '@ant-design/icons';
import { useChatbot } from './chatbot.context';

const { TextArea } = Input;

const ChatInput: React.FC = () => {
    const { token } = theme.useToken();
    const [question, setQuestion] = useState('');
    const { sendMessage, isLoadingApi } = useChatbot();

    const [isListening, setIsListening] = useState(false);
    const [isSpeechSupported, setIsSpeechSupported] = useState(false);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            
            if (SpeechRecognition) {
                setIsSpeechSupported(true);
                const recognition = new SpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = false;
                recognition.lang = 'vi-VN';

                recognition.onresult = (event: any) => {
                    let newTranscript = '';
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) {
                            newTranscript += event.results[i][0].transcript;
                        }
                    }
                    
                    if (newTranscript) {
                        setQuestion((prev) => {
                            const trimmed = prev.trim();
                            return trimmed ? `${trimmed} ${newTranscript}` : newTranscript;
                        });
                    }
                };

                recognition.onerror = (event: any) => {
                    console.error('Lỗi nhận diện giọng nói:', event.error);
                    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                        setIsListening(false);
                    }
                };

                recognition.onend = () => {
                    setIsListening(false);
                };

                recognitionRef.current = recognition;
            }
        }
        
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) return;

        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            try {
                recognitionRef.current.start();
                setIsListening(true);
            } catch (error) {
                console.error("Không thể bắt đầu ghi âm:", error);
                setIsListening(false);
            }
        }
    };

    const handleSend = () => {
        if (question.trim() && !isLoadingApi) {
            sendMessage(question);
            setQuestion('');
            if (isListening && recognitionRef.current) {
                recognitionRef.current.stop();
                setIsListening(false);
            }
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
                    placeholder={isListening ? "Đang lắng nghe bạn nói..." : "Nhập câu hỏi hoặc nói..."}
                    autoSize={{ minRows: 1, maxRows: 4 }}
                    disabled={isLoadingApi}
                    variant="filled"
                    style={{
                        borderRadius: 12,
                        resize: 'none',
                        padding: '10px 12px',
                        fontSize: 15,
                        borderColor: isListening ? token.colorError : undefined,
                        transition: 'all 0.3s'
                    }}
                />
                
                {isSpeechSupported && (
                    <Tooltip title={isListening ? "Dừng ghi âm" : "Nhập bằng giọng nói"}>
                        <Button
                            type={isListening ? "primary" : "default"}
                            danger={isListening}
                            shape="circle"
                            size="large"
                            icon={isListening ? <AudioOutlined /> : <AudioMutedOutlined />}
                            onClick={toggleListening}
                            disabled={isLoadingApi}
                            style={{ 
                                marginBottom: 2,
                                flexShrink: 0,
                                boxShadow: isListening ? `0 0 8px ${token.colorError}` : 'none'
                            }}
                        />
                    </Tooltip>
                )}

                <Tooltip title="Gửi tin nhắn">
                    <Button
                        type="primary"
                        shape="circle"
                        size="large"
                        icon={<SendOutlined style={{ marginLeft: 2 }} />}
                        onClick={handleSend}
                        loading={isLoadingApi}
                        disabled={!question.trim()}
                        style={{ marginBottom: 2, flexShrink: 0 }}
                    />
                </Tooltip>
            </Flex>
        </div>
    );
};

export default ChatInput;