'use client';

import React, { useState, useRef, MouseEvent, useEffect } from 'react';
import { Button, Typography, Modal, Input, Alert, Tag, Space, Divider, Flex, theme, Tooltip, Card, notification } from 'antd';
import { 
    CommentOutlined, 
    RobotOutlined, 
    TagsOutlined, 
    CalendarOutlined, 
    GlobalOutlined, 
    SmileFilled, 
    MehFilled, 
    FrownFilled,
    LinkOutlined,
    FileWordOutlined
} from '@ant-design/icons';
import { useChatbot } from '@/components/client/chatbot/chatbot.context';
import { useSession } from 'next-auth/react';
import BookmarkButton from './bookmark.btn';

const { Paragraph, Title, Text } = Typography;
const { TextArea } = Input;

interface ArticleBodyProps {
    articleId: string;
    title: string;
    content: string;
    website: string;
    publish_date: string;
    ai_sentiment_score?: number;
    ai_summary?: string[];
    site_categories?: string[];
    url?: string;
    summary?: string;
}

const ArticleBody: React.FC<ArticleBodyProps> = ({ 
    articleId, 
    title, 
    content, 
    website, 
    publish_date, 
    ai_sentiment_score, 
    ai_summary, 
    site_categories,
    url,
    summary
}) => {
    const { token } = theme.useToken();
    const { sendMessage, setView, setPageContext } = useChatbot();
    const { data: session } = useSession();
    
    useEffect(() => {
        if (articleId) {
            setPageContext({
                current_page: 'detail_page',
                article_id: articleId
            });
        }
        return () => setPageContext(null);
    }, [articleId, setPageContext]);

    const [selection, setSelection] = useState<{ x: number, y: number, text: string } | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [question, setQuestion] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    
    const contentRef = useRef<HTMLDivElement>(null);

    const getSentimentInfo = (score: number | null | undefined) => {
        if (score === undefined || score === null || isNaN(score)) {
            return { color: token.colorTextDescription, icon: <MehFilled />, label: 'Chưa phân tích', bg: token.colorFillQuaternary };
        }
        if (score >= 0.5) return { color: token.colorSuccess, icon: <SmileFilled />, label: 'Tích cực', bg: token.colorSuccessBg };
        if (score > 0) return { color: token.colorWarning, icon: <SmileFilled />, label: 'Khá tốt', bg: token.colorWarningBg };
        if (score === 0) return { color: token.colorWarning, icon: <MehFilled />, label: 'Trung tính', bg: token.colorWarningBg };
        if (score > -0.5) return { color: token.colorError, icon: <FrownFilled />, label: 'Tiêu cực', bg: token.colorErrorBg };
        return { color: token.colorErrorActive, icon: <FrownFilled />, label: 'Rất tiêu cực', bg: token.colorErrorBg };
    };

    const sentiment = getSentimentInfo(ai_sentiment_score);

    const handleMouseUp = (e: MouseEvent<HTMLDivElement>) => {
        if (isModalVisible) return;
        const selectionObj = window.getSelection();
        const selectedText = selectionObj?.toString().trim() || '';
        if (selectedText.length > 10) {
            if (contentRef.current) {
                const range = selectionObj?.getRangeAt(0);
                const rect = range?.getBoundingClientRect();
                const containerRect = contentRef.current.getBoundingClientRect();
                
                if (rect) {
                    setSelection({
                        x: rect.left + (rect.width / 2) - containerRect.left,
                        y: rect.top - containerRect.top,
                        text: selectedText,
                    });
                }
            }
        } else {
            setSelection(null);
        }
    };

    const handleOpenAskModal = () => {
        if (!selection) return;
        setIsModalVisible(true);
    };

    const handleSendFromModal = () => {
        if (!selection || !question.trim()) return;
        sendMessage(question, { context_text: selection.text });
        setView('window');
        setIsModalVisible(false);
        setSelection(null);
        setQuestion('');
    };

    const handleCancelModal = () => {
        setIsModalVisible(false);
        setSelection(null);
        setQuestion('');
    };

    const handleExportWord = async () => {
        if (!session?.access_token) {
            notification.warning({ message: "Vui lòng đăng nhập để sử dụng tính năng này" });
            return;
        }

        try {
            setIsExporting(true);
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/article/export/word/${articleId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Export failed');
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            const safeTitle = title.replace(/[^a-z0-9\u00C0-\u1EF9 ]/gi, '_').substring(0, 50);
            a.download = `${safeTitle}.docx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            a.remove();
            
            notification.success({ title: "Xuất file Word thành công" });
        } catch (error) {
            console.error("Export error:", error);
            notification.error({ title: "Có lỗi xảy ra khi xuất file" });
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div style={{ position: 'relative' }}>
            
            <Flex vertical gap={16} style={{ marginBottom: 24 }}>
                <Flex justify="space-between" align="start" gap={16}>
                    <Title level={1} style={{ margin: 0, fontSize: '28px', lineHeight: 1.3, color: token.colorTextHeading }}>
                        {title}
                    </Title>
                    <Space size={12}>
                        <Tooltip title="Xuất ra file Word">
                            <Button 
                                icon={<FileWordOutlined style={{ color: '#1677ff' }} />} 
                                size="large"
                                shape="circle"
                                onClick={handleExportWord}
                                loading={isExporting}
                                style={{ border: `1px solid ${token.colorBorder}` }}
                            />
                        </Tooltip>
                        <BookmarkButton 
                            articleId={articleId} 
                            articleTitle={title} 
                            articleUrl={url} 
                            website={website}
                            siteCategories={site_categories}
                            summary={summary}
                            aiSentimentScore={ai_sentiment_score}
                            publishDate={publish_date}
                            size="large"
                            shape="circle"
                            type="default"
                        />
                    </Space>
                </Flex>

                <Flex wrap="wrap" gap={12} align="center" style={{ color: token.colorTextSecondary }}>
                    <Text type="secondary">
                        <CalendarOutlined style={{ marginRight: 6 }} />
                        {new Date(publish_date).toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    
                    <span style={{ borderLeft: '1px solid #d9d9d9', height: '1em', margin: '0 8px' }} />
                    
                    <Tag color="geekblue" style={{ margin: 0, border: 'none' }}>
                        <GlobalOutlined style={{ marginRight: 4 }} /> {website}
                    </Tag>

                    <Tag 
                        style={{ 
                            margin: 0, 
                            border: 'none', 
                            backgroundColor: sentiment.bg, 
                            color: sentiment.color, 
                            fontWeight: 500
                        }}
                    >
                        {sentiment.icon} <span style={{ marginLeft: 4 }}>{sentiment.label} {ai_sentiment_score !== undefined ? `(${ai_sentiment_score})` : ''}</span>
                    </Tag>
                </Flex>

                {site_categories && site_categories.length > 0 && (
                    <Flex gap={8} wrap="wrap">
                        {site_categories.map((cat, index) => (
                            <Tag key={index} style={{ margin: 0, color: token.colorTextSecondary, background: token.colorFillQuaternary, border: 'none' }}>
                                <TagsOutlined style={{ marginRight: 4 }} /> {cat}
                            </Tag>
                        ))}
                    </Flex>
                )}
            </Flex>

            {ai_summary && ai_summary.length > 0 && (
                <Card 
                    variant="borderless" 
                    style={{ 
                        backgroundColor: '#f0f5ff', 
                        borderLeft: `4px solid ${token.colorPrimary}`,
                        marginBottom: 32,
                        borderRadius: token.borderRadiusLG 
                    }}
                    styles={{ body: { padding: '20px 24px' } }}
                >
                    <Flex gap={12} align="start">
                        <RobotOutlined style={{ fontSize: '24px', color: token.colorPrimary, marginTop: 4 }} />
                        <div>
                            <Text strong style={{ fontSize: '16px', color: token.colorPrimaryText, display: 'block', marginBottom: 8 }}>
                                Tóm tắt thông minh
                            </Text>
                            <ul style={{ margin: 0, paddingLeft: 20, color: token.colorText }}>
                                {ai_summary.map((point, index) => (
                                    <li key={index} style={{ marginBottom: 6, lineHeight: 1.6 }}>{point}</li>
                                ))}
                            </ul>
                        </div>
                    </Flex>
                </Card>
            )}

            <div ref={contentRef} onMouseUp={handleMouseUp} style={{ position: 'relative', minHeight: '200px' }}>
                
                {selection && !isModalVisible && (
                    <div
                        style={{
                            position: 'absolute',
                            left: selection.x,
                            top: selection.y - 45,
                            zIndex: 100,
                            transform: 'translateX(-50%)',
                        }}
                    >
                        <Tooltip title="Hỏi AI về đoạn này" open={true}>
                            <Button
                                type="primary"
                                shape="round"
                                icon={<CommentOutlined />}
                                size="middle"
                                onClick={handleOpenAskModal}
                                style={{ boxShadow: token.boxShadowSecondary }}
                            >
                                Hỏi Chatbot
                            </Button>
                        </Tooltip>
                        <div style={{ 
                            width: 0, height: 0, 
                            borderLeft: '6px solid transparent', 
                            borderRight: '6px solid transparent', 
                            borderTop: `6px solid ${token.colorPrimary}`, 
                            margin: '0 auto' 
                        }} />
                    </div>
                )}

                <Typography style={{ 
                    fontSize: '18px', 
                    lineHeight: '1.8', 
                    color: '#262626', 
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'" 
                    }}>
                    {content.split('\n').map((paragraph, idx) => (
                        paragraph.trim() ? (
                            <p key={idx} style={{ marginBottom: '1.5em' }}>{paragraph}</p>
                        ) : null
                    ))}
                </Typography>
            </div>

            <Divider style={{ margin: '40px 0 24px 0' }} />
            <Flex justify="center">
                <Button 
                    type="dashed" 
                    href={url} 
                    target="_blank" 
                    icon={<LinkOutlined />}
                    size="large"
                >
                    Đọc bài viết gốc tại {website}
                </Button>
            </Flex>

            <Modal
                title={<Space><RobotOutlined style={{ color: token.colorPrimary }} /> Hỏi đáp ngữ cảnh</Space>}
                open={isModalVisible}
                onOk={handleSendFromModal}
                onCancel={handleCancelModal}
                okText="Gửi câu hỏi"
                cancelText="Hủy"
                okButtonProps={{ disabled: !question.trim() }}
                centered
            >
                <div style={{ marginBottom: 16 }}>
                    <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>Ngữ cảnh đã chọn:</Text>
                    <div style={{ 
                        marginTop: 8, 
                        padding: 12, 
                        background: token.colorFillQuaternary, 
                        borderRadius: token.borderRadius,
                        borderLeft: `3px solid ${token.colorInfo}`,
                        maxHeight: 120,
                        overflowY: 'auto',
                        fontStyle: 'italic'
                    }}>
                        <Text style={{ color: token.colorTextSecondary }}>"{selection?.text}"</Text>
                    </div>
                </div>
                
                <TextArea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ví dụ: Giải thích thuật ngữ này? Tóm tắt đoạn này?..."
                    rows={4}
                    autoFocus
                    variant="filled"
                />
            </Modal>
        </div>
    );
};

export default ArticleBody;