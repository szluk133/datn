'use client';

import React from 'react';
import { Typography, Tag, Checkbox, Tooltip, Card, Space, Divider, Flex, theme } from 'antd';
import { 
    GlobalOutlined, 
    LinkOutlined, 
    CalendarOutlined,
    SmileFilled, 
    MehFilled, 
    FrownFilled
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
    
    const getSentimentInfo = (score: number | null | undefined) => {
        if (score === undefined || score === null || isNaN(score)) {
            return { color: token.colorTextDescription, icon: <MehFilled />, label: 'Chưa phân tích', bg: token.colorFillQuaternary };
        }
        
        if (score >= 0.5) return { color: token.colorSuccess, icon: <SmileFilled />, label: 'Tích cực', bg: token.colorSuccessBg };
        if (score > 0) return { color: token.colorInfo, icon: <SmileFilled />, label: 'Khá tốt', bg: token.colorInfoBg };
        if (score === 0) return { color: token.colorWarning, icon: <MehFilled />, label: 'Trung tính', bg: token.colorWarningBg };
        if (score > -0.5) return { color: token.colorError, icon: <FrownFilled />, label: 'Tiêu cực', bg: token.colorErrorBg };
        return { color: token.colorErrorActive, icon: <FrownFilled />, label: 'Rất tiêu cực', bg: token.colorErrorBg };
    };

    const sentimentScore = (article.ai_sentiment_score !== undefined && article.ai_sentiment_score !== null) 
        ? Number(article.ai_sentiment_score) 
        : undefined;

    const sentiment = getSentimentInfo(sentimentScore);
    const articleId = article.id || article._id;

    return (
        <Card
            hoverable
            className={`article-card ${isSelected ? 'selected' : ''}`}
            style={{
                borderRadius: token.borderRadiusLG,
                border: isSelected ? `1px solid ${token.colorPrimary}` : `1px solid ${token.colorBorderSecondary}`,
                transition: 'all 0.3s ease',
                backgroundColor: isSelected ? token.colorPrimaryBg : token.colorBgContainer,
                position: 'relative',
                overflow: 'hidden'
            }}
            styles={{ body: { padding: '20px' } }}
        >
            <div 
                style={{ 
                    position: 'absolute', 
                    left: 0, 
                    top: 0, 
                    bottom: 0, 
                    width: '4px', 
                    backgroundColor: sentiment.color 
                }} 
            />

            <Flex gap={16} align="start">
                <Flex vertical align="center" style={{ paddingTop: 4 }}>
                    {onToggleSelect && (
                        <Checkbox 
                            checked={isSelected} 
                            onChange={() => onToggleSelect(articleId)}
                            style={{ transform: 'scale(1.2)' }}
                        />
                    )}
                </Flex>

                <div style={{ flex: 1 }}>
                    <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
                        <Space separator={<Divider orientation="vertical" />}>
                            <Tag color="geekblue" style={{ borderRadius: token.borderRadiusSM, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <GlobalOutlined /> {article.website}
                            </Tag>
                            <Text type="secondary" style={{ fontSize: 13 }}>
                                <CalendarOutlined style={{ marginRight: 4 }} />
                                {new Date(article.publish_date).toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </Space>
                        
                        <Tooltip title={`Điểm cảm xúc: ${sentimentScore ?? 'N/A'}`}>
                            <Tag 
                                style={{ 
                                    border: 'none', 
                                    backgroundColor: sentiment.bg, 
                                    color: sentiment.color,
                                    borderRadius: 20,
                                    padding: '2px 10px',
                                    fontWeight: 500
                                }}
                            >
                                {sentiment.icon} <span style={{ marginLeft: 4 }}>{sentiment.label}</span>
                            </Tag>
                        </Tooltip>
                    </Flex>

                    <Title level={4} style={{ margin: '4px 0 12px 0', lineHeight: 1.4 }}>
                        <Link href={`/model/article/${articleId}`} style={{ color: token.colorText }}>
                            <span 
                                className="hover:text-blue-600 transition-colors duration-300"
                                onMouseEnter={(e) => e.currentTarget.style.color = token.colorPrimary}
                                onMouseLeave={(e) => e.currentTarget.style.color = token.colorText}
                            >
                                {article.title}
                            </span>
                        </Link>
                    </Title>

                    <Paragraph 
                        ellipsis={{ rows: 2, expandable: false }} 
                        style={{ color: token.colorTextSecondary, fontSize: 15, marginBottom: 16, lineHeight: 1.6 }}
                    >
                        {article.summary}
                    </Paragraph>

                    <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
                        <Space size={[0, 8]} wrap>
                            {article.site_categories && article.site_categories.map((cat, index) => (
                                <Tag key={index} style={{ color: token.colorTextSecondary, background: token.colorFillQuaternary, border: 'none' }}># {cat}</Tag>
                            ))}
                        </Space>

                        <Space>
                            <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ color: token.colorTextDescription, fontSize: 13 }}>
                                <LinkOutlined /> Nguồn gốc
                            </a>
                            <Divider orientation="vertical" />

                            <BookmarkButton 
                                articleId={articleId} 
                                articleTitle={article.title}
                                articleUrl={article.url}
                                size="middle"
                            />
                        </Space>
                    </Flex>
                </div>
            </Flex>

            <style jsx global>{`
                .article-card:hover {
                    box-shadow: ${token.boxShadow};
                    transform: translateY(-2px);
                }
            `}</style>
        </Card>
    );
};

export default ArticleItem;