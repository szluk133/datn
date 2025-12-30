'use client';

import React from 'react';
import { Typography, Tag, Checkbox, Tooltip, Card, Space, Divider, Flex, theme, Button } from 'antd';
import { 
    GlobalOutlined, 
    LinkOutlined, 
    CalendarOutlined,
    SmileFilled, 
    MehFilled, 
    FrownFilled,
    ArrowRightOutlined,
    SafetyCertificateOutlined
} from '@ant-design/icons';
import Link from 'next/link';
import { IArticle } from '@/types/next-auth';
import BookmarkButton from './bookmark.btn';

const { Paragraph, Text, Title } = Typography;

interface ArticleItemProps {
    article: IArticle;
    isSelected?: boolean;
    onToggleSelect?: (id: string) => void;
    initialIsSaved?: boolean;
}

const ArticleItem = ({ article, isSelected = false, onToggleSelect }: ArticleItemProps) => {
    const { token } = theme.useToken();
    
    // Hàm xử lý hiển thị dựa trên Label thay vì Score
    const getSentimentInfo = (label: string | undefined, confidence: number | null | undefined) => {
        const safeLabel = label ? label.toLowerCase().trim() : '';

        // Mapping các trường hợp nhãn
        if (['tích cực', 'positive'].includes(safeLabel)) {
            return { color: token.colorSuccess, icon: <SmileFilled />, label: 'Tích cực', bg: '#f6ffed' };
        }
        if (['tiêu cực', 'negative'].includes(safeLabel)) {
            return { color: token.colorError, icon: <FrownFilled />, label: 'Tiêu cực', bg: '#fff2f0' };
        }
        if (['trung tính', 'neutral'].includes(safeLabel)) {
            return { color: token.colorWarning, icon: <MehFilled />, label: 'Trung tính', bg: '#fffbe6' };
        }

        // Fallback khi không có nhãn hoặc nhãn lạ
        return { color: token.colorTextDescription, icon: <MehFilled />, label: 'Chưa phân tích', bg: '#f5f5f5' };
    };

    const sentimentScore = (article.ai_sentiment_score !== undefined && article.ai_sentiment_score !== null) 
        ? Number(article.ai_sentiment_score) 
        : undefined;
    
    const sentimentLabel = article.ai_sentiment_label;

    const sentiment = getSentimentInfo(sentimentLabel, sentimentScore);
    const articleId = article.id || article._id;

    // Format hiển thị độ tin cậy (VD: 0.95 -> 95%)
    const confidenceDisplay = sentimentScore !== undefined 
        ? `${(sentimentScore * 100).toFixed(0)}%` 
        : 'N/A';

    return (
        <Card
            variant="borderless"
            className={`article-card ${isSelected ? 'selected' : ''}`}
            style={{
                borderRadius: 20,
                transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                backgroundColor: isSelected ? '#f0f9ff' : '#fff',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: isSelected ? '0 0 0 2px #1890ff, 0 10px 20px rgba(24, 144, 255, 0.1)' : '0 4px 20px rgba(0,0,0,0.03)',
                transform: isSelected ? 'scale(1.01)' : 'scale(1)',
                border: '1px solid transparent',
                cursor: 'pointer'
            }}
            hoverable
            onClick={() => onToggleSelect && onToggleSelect(articleId)}
            styles={{ body: { padding: '24px 28px' } }}
        >
            {/* Sentiment Indicator Strip */}
            <div 
                style={{ 
                    position: 'absolute', 
                    left: 0, 
                    top: 0, 
                    bottom: 0, 
                    width: '6px', 
                    backgroundColor: sentiment.color,
                    opacity: 0.8 
                }} 
            />

            <Flex gap={20} align="start">
                <Flex vertical align="center" style={{ paddingTop: 6 }}>
                    {onToggleSelect && (
                        <Checkbox 
                            checked={isSelected} 
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => onToggleSelect(articleId)}
                            style={{ transform: 'scale(1.2)' }}
                        />
                    )}
                </Flex>

                <div style={{ flex: 1 }}>
                    <Flex justify="space-between" align="center" style={{ marginBottom: 10 }}>
                        <Space size={16}>
                            <Tag variant="filled" color="blue" style={{ borderRadius: 8, padding: '2px 10px', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                                <GlobalOutlined /> {article.website}
                            </Tag>
                            <Text type="secondary" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <CalendarOutlined />
                                {new Date(article.publish_date).toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </Space>
                        
                        <Tooltip title={
                            <Space orientation="vertical" size={0}>
                                <span>Kết quả AI phân tích: {sentiment.label}</span>
                                <span><SafetyCertificateOutlined /> Độ tin cậy: {confidenceDisplay}</span>
                            </Space>
                        }>
                            <Tag 
                                variant="filled"
                                style={{ 
                                    backgroundColor: sentiment.bg, 
                                    color: sentiment.color,
                                    borderRadius: 100,
                                    padding: '4px 12px',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    margin: 0,
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                                }}
                            >
                                {sentiment.icon} <span>{sentiment.label}</span>
                            </Tag>
                        </Tooltip>
                    </Flex>

                    <Title level={3} style={{ margin: '8px 0 12px 0', fontSize: 20, lineHeight: 1.4 }}>
                        <Link href={`/model/article/${articleId}`} onClick={(e) => e.stopPropagation()}>
                            <span 
                                style={{ 
                                    background: `linear-gradient(to right, ${token.colorText}, ${token.colorText})`,
                                    backgroundSize: '0% 2px',
                                    backgroundPosition: '0 100%',
                                    backgroundRepeat: 'no-repeat',
                                    transition: 'all 0.3s ease',
                                    color: token.colorTextHeading
                                }}
                                className="article-title"
                            >
                                {article.title}
                            </span>
                        </Link>
                    </Title>

                    <Paragraph 
                        ellipsis={{ rows: 2, expandable: false }} 
                        style={{ color: token.colorTextSecondary, fontSize: 15, marginBottom: 20, lineHeight: 1.6 }}
                    >
                        {article.summary}
                    </Paragraph>

                    <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
                        <Space size={[4, 8]} wrap style={{ flex: 1 }}>
                            {article.site_categories && article.site_categories.map((cat, index) => (
                                <Tag key={index} style={{ 
                                    color: token.colorTextDescription, 
                                    background: '#f8f9fa', 
                                    border: '1px solid #eee',
                                    borderRadius: 6,
                                    padding: '2px 8px'
                                }}>
                                    # {cat}
                                </Tag>
                            ))}
                        </Space>

                        <div onClick={(e) => e.stopPropagation()}>
                            <Space size={16} align="center">
                                <Link href={`/model/article/${articleId}`}>
                                    <Button type="text" size="small" style={{ color: token.colorPrimary, fontWeight: 500 }}>
                                        Xem chi tiết <ArrowRightOutlined />
                                    </Button>
                                </Link>
                                
                                <Divider orientation="vertical" style={{ height: 16 }} />

                                <Tooltip title="Xem nguồn gốc">
                                    <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ color: token.colorTextDescription }}>
                                        <LinkOutlined style={{ fontSize: 16 }} />
                                    </a>
                                </Tooltip>
                                
                                <BookmarkButton 
                                    articleId={articleId} 
                                    articleTitle={article.title}
                                    articleUrl={article.url}
                                    website={article.website}
                                    siteCategories={article.site_categories}
                                    summary={article.summary}
                                    aiSentimentScore={article.ai_sentiment_score}
                                    aiSentimentLabel={article.ai_sentiment_label}
                                    publishDate={article.publish_date}
                                    size="middle"
                                    shape="circle"
                                />
                            </Space>
                        </div>
                    </Flex>
                </div>
            </Flex>

            <style jsx global>{`
                .article-card:hover {
                    box-shadow: 0 15px 30px -5px rgba(0,0,0,0.1) !important;
                    transform: translateY(-4px) !important;
                }
                .article-card:hover .article-title {
                    color: ${token.colorPrimary} !important;
                    background-size: 100% 2px !important;
                    background-image: linear-gradient(to right, ${token.colorPrimary}, ${token.colorPrimary}) !important;
                }
            `}</style>
        </Card>
    );
};

export default ArticleItem;