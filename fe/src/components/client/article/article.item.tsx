'use client';

import React from 'react';
import { List, Typography, Tag, Checkbox, Tooltip, Button } from 'antd';
import { ReadOutlined, DownloadOutlined, SmileOutlined, MehOutlined, FrownOutlined, GlobalOutlined, LinkOutlined } from '@ant-design/icons';
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
    
    const getSentimentInfo = (score: number | null | undefined) => {
        if (score === undefined || score === null || isNaN(score)) {
            return { color: 'default', icon: <MehOutlined />, label: 'N/A' };
        }
        
        if (score >= 0.5) return { color: 'success', icon: <SmileOutlined />, label: 'Tích cực' };
        if (score > 0) return { color: 'processing', icon: <SmileOutlined />, label: 'Khá tốt' };
        if (score === 0) return { color: 'warning', icon: <MehOutlined />, label: 'Trung tính' };
        if (score > -0.5) return { color: 'error', icon: <FrownOutlined />, label: 'Tiêu cực' };
        return { color: '#cf1322', icon: <FrownOutlined />, label: 'Rất tiêu cực' };
    };

    const sentimentScore = (article.ai_sentiment_score !== undefined && article.ai_sentiment_score !== null) 
        ? Number(article.ai_sentiment_score) 
        : undefined;

    const sentiment = getSentimentInfo(sentimentScore);
    const articleId = article.id || article._id;

    return (
        <List.Item
            className="article-item-group"
            style={{
                position: 'relative',
                transition: 'all 0.3s',
                backgroundColor: isSelected ? '#e6f7ff' : '#fff',
                border: isSelected ? '1px solid #1890ff' : '1px solid #f0f0f0',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px',
                display: 'block'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                
                {/* Cột bên trái: Icon & Checkbox */}
                <div style={{ marginRight: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '40px' }}>
                    <ReadOutlined style={{ fontSize: '28px', color: '#1890ff', marginBottom: '12px' }} />
                    {onToggleSelect && (
                        <Checkbox 
                            checked={isSelected} 
                            onChange={() => onToggleSelect(articleId)}
                        />
                    )}
                </div>

                {/* Cột bên phải: Nội dung chính */}
                <div style={{ flex: 1, width: '100%' }}>
                    
                    {/* Hàng 1: Title & Categories */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <div style={{ flex: 1, marginRight: '12px' }}>
                            <Title level={5} style={{ margin: 0 }}>
                                <Link href={`/model/article/${articleId}`} style={{ color: '#000', transition: 'color 0.3s' }} className="hover:text-blue-500">
                                    {article.title}
                                </Link>
                            </Title>
                        </div>
                        {article.site_categories && article.site_categories.length > 0 && (
                            <div style={{ flexShrink: 0 }}>
                                {article.site_categories.map((cat, index) => (
                                    <Tag key={index} color="cyan" style={{ margin: '0 0 0 4px' }}>{cat}</Tag>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Hàng 2: Ngày đăng */}
                    <div style={{ marginBottom: '8px' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                            {new Date(article.publish_date).toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </div>

                    {/* Hàng 3: Tóm tắt */}
                    <Paragraph ellipsis={{ rows: 2, expandable: false }} style={{ color: '#595959', marginBottom: '12px' }}>
                        {article.summary}
                    </Paragraph>

                    {/* Hàng 4 (Footer) */}
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <Tag color="blue" icon={<GlobalOutlined />}>{article.website}</Tag>
                        <Tag color={sentiment.color} icon={sentiment.icon}>
                            {sentiment.label} 
                            {(sentimentScore !== undefined && !isNaN(sentimentScore)) ? ` (${sentimentScore})` : ''}
                        </Tag>
                        <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', fontSize: '13px', marginLeft: '4px' }}>
                            <LinkOutlined style={{ marginRight: '4px' }} /> Xem bài gốc
                        </a>
                    </div>
                </div>
            </div>

            <div 
                className="select-overlay"
                style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    opacity: isSelected ? 1 : 0,
                    transition: 'opacity 0.2s',
                    zIndex: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                }}
            >
                {/* Nút Bookmark */}
                <BookmarkButton 
                    articleId={articleId} 
                    articleTitle={article.title}
                    articleUrl={article.url}
                    shape="circle"
                    size="middle"
                    type="default"
                />

                {/* Nút Download/Select */}
                {onToggleSelect && !isSelected && (
                    <Tooltip title="Đánh dấu tải về">
                        <Button 
                            type="default"
                            shape="circle"
                            icon={<DownloadOutlined />}
                            onClick={() => onToggleSelect(articleId)}
                        />
                    </Tooltip>
                )}
            </div>
            
            <style jsx global>{`
                .article-item-group:hover .select-overlay {
                    opacity: 1 !important;
                }
            `}</style>
        </List.Item>
    );
};

export default ArticleItem;

// import React from 'react';
// import { List, Typography, Tag, Checkbox, Tooltip, Button, Space } from 'antd';
// import { ReadOutlined, DownloadOutlined, SmileOutlined, MehOutlined, FrownOutlined, GlobalOutlined, LinkOutlined } from '@ant-design/icons';
// import Link from 'next/link';
// import { IArticle } from '@/types/next-auth';

// const { Paragraph, Text, Title } = Typography;

// interface ArticleItemProps {
//     article: IArticle;
//     isSelected?: boolean;
//     onToggleSelect?: (id: string) => void;
// }

// const ArticleItem = ({ article, isSelected = false, onToggleSelect }: ArticleItemProps) => {
    
//     // --- Logic xác định màu sắc Sentiment ---
//     const getSentimentInfo = (score: number | null | undefined) => {
//         if (score === undefined || score === null || isNaN(score)) {
//             return { color: 'default', icon: <MehOutlined />, label: 'N/A' };
//         }
        
//         if (score >= 0.5) return { color: 'success', icon: <SmileOutlined />, label: 'Tích cực' };
//         if (score > 0) return { color: 'processing', icon: <SmileOutlined />, label: 'Khá tốt' };
//         if (score === 0) return { color: 'warning', icon: <MehOutlined />, label: 'Trung tính' };
//         if (score > -0.5) return { color: 'error', icon: <FrownOutlined />, label: 'Tiêu cực' };
//         return { color: '#cf1322', icon: <FrownOutlined />, label: 'Rất tiêu cực' };
//     };

//     const sentimentScore = (article.ai_sentiment_score !== undefined && article.ai_sentiment_score !== null) 
//         ? Number(article.ai_sentiment_score) 
//         : undefined;

//     const sentiment = getSentimentInfo(sentimentScore);

//     return (
//         <List.Item
//             className="article-item-group"
//             style={{
//                 position: 'relative',
//                 transition: 'all 0.3s',
//                 backgroundColor: isSelected ? '#e6f7ff' : 'transparent',
//                 border: isSelected ? '1px solid #1890ff' : '1px solid #f0f0f0',
//                 borderRadius: '8px',
//                 padding: '16px',
//                 marginBottom: '16px',
//                 display: 'block' // Sử dụng block để control layout thủ công thay vì flex mặc định của List.Item
//             }}
//         >
//             <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                
//                 {/* --- Cột bên trái: Icon & Checkbox --- */}
//                 <div style={{ marginRight: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '40px' }}>
//                     <ReadOutlined style={{ fontSize: '28px', color: '#1890ff', marginBottom: '12px' }} />
//                     {onToggleSelect && (
//                         <Checkbox 
//                             checked={isSelected} 
//                             onChange={() => onToggleSelect(article.id)}
//                         />
//                     )}
//                 </div>

//                 {/* --- Cột bên phải: Nội dung chính --- */}
//                 <div style={{ flex: 1, width: '100%' }}>
                    
//                     {/* Hàng 1: Title & Categories (Cùng hàng) */}
//                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        
//                         {/* Title */}
//                         <div style={{ flex: 1, marginRight: '12px' }}>
//                             <Title level={5} style={{ margin: 0 }}>
//                                 <Link href={`/model/article/${article.id}`} style={{ color: '#000', transition: 'color 0.3s' }} className="hover:text-blue-500">
//                                     {article.title}
//                                 </Link>
//                             </Title>
//                         </div>

//                         {/* Categories */}
//                         {article.site_categories && article.site_categories.length > 0 && (
//                             <div style={{ flexShrink: 0 }}>
//                                 {article.site_categories.map((cat, index) => (
//                                     <Tag key={index} color="cyan" style={{ margin: '0 0 0 4px' }}>
//                                         {cat}
//                                     </Tag>
//                                 ))}
//                             </div>
//                         )}
//                     </div>

//                     {/* Hàng 2: Ngày đăng */}
//                     <div style={{ marginBottom: '8px' }}>
//                         <Text type="secondary" style={{ fontSize: '12px' }}>
//                             {new Date(article.publish_date).toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
//                         </Text>
//                     </div>

//                     {/* Hàng 3: Tóm tắt */}
//                     <Paragraph ellipsis={{ rows: 2, expandable: false }} style={{ color: '#595959', marginBottom: '12px' }}>
//                         {article.summary}
//                     </Paragraph>

//                     {/* Hàng 4 (Footer): Website - Cảm xúc - Link gốc (Cùng hàng, góc trái) */}
//                     <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        
//                         {/* Website */}
//                         <Tag color="blue" icon={<GlobalOutlined />}>
//                             {article.website}
//                         </Tag>

//                         {/* Cảm xúc */}
//                         <Tag color={sentiment.color} icon={sentiment.icon}>
//                             {sentiment.label} 
//                             {(sentimentScore !== undefined && !isNaN(sentimentScore)) ? ` (${sentimentScore})` : ''}
//                         </Tag>

//                         {/* Link xem bài gốc */}
//                         <a 
//                             href={article.url} 
//                             target="_blank" 
//                             rel="noopener noreferrer" 
//                             style={{ display: 'flex', alignItems: 'center', fontSize: '13px', marginLeft: '4px' }}
//                         >
//                             <LinkOutlined style={{ marginRight: '4px' }} /> Xem bài gốc
//                         </a>
//                     </div>

//                 </div>
//             </div>

//             {/* --- Nút Hover Quick Action --- */}
//             <div 
//                 className="select-overlay"
//                 style={{
//                     position: 'absolute',
//                     right: '10px',
//                     top: '50%',
//                     transform: 'translateY(-50%)',
//                     opacity: isSelected ? 1 : 0,
//                     transition: 'opacity 0.2s',
//                     zIndex: 10
//                 }}
//             >
//                 {onToggleSelect && !isSelected && (
//                     <Tooltip title="Đánh dấu tải về">
//                         <Button 
//                             type="default"
//                             shape="circle"
//                             icon={<DownloadOutlined />}
//                             onClick={() => onToggleSelect(article.id)}
//                             style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
//                         />
//                     </Tooltip>
//                 )}
//             </div>
            
//             <style jsx global>{`
//                 .article-item-group:hover .select-overlay {
//                     opacity: 1 !important;
//                 }
//             `}</style>
//         </List.Item>
//     );
// };

// export default ArticleItem;