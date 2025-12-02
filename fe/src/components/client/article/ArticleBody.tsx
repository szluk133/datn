'use client';

import React, { useState, useRef, MouseEvent, useEffect } from 'react';
import { Button, Typography, Modal, Input, Alert, Tag, Space, Divider } from 'antd';
import { 
    CommentOutlined, 
    RobotOutlined, 
    TagsOutlined, 
    CalendarOutlined, 
    GlobalOutlined, 
    SmileOutlined, 
    MehOutlined, 
    FrownOutlined 
} from '@ant-design/icons';
import { useChatbot } from '@/components/client/chatbot/chatbot.context';
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
    url
}) => {
    const { sendMessage, setView, setPageContext } = useChatbot();
    
    useEffect(() => {
        if (articleId) {
            setPageContext({
                current_page: 'detail_page',
                article_id: articleId
            });
        }
        
        return () => {
            setPageContext(null);
        };
    }, [articleId, setPageContext]);

    const [selection, setSelection] = useState<{ x: number, y: number, text: string } | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [question, setQuestion] = useState('');
    
    const contentRef = useRef<HTMLDivElement>(null);

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

    const sentiment = getSentimentInfo(ai_sentiment_score);

    const handleMouseUp = (e: MouseEvent<HTMLDivElement>) => {
        if (isModalVisible) return;
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim() || '';
        if (selectedText.length > 20) {
            if (contentRef.current) {
                const containerRect = contentRef.current.getBoundingClientRect();
                setSelection({
                    x: e.clientX - containerRect.left + 10,
                    y: e.clientY - containerRect.top + window.scrollY + 10,
                    text: selectedText,
                });
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

    return (
        <div className="article-body-container" style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
            
            {/* DÒNG 1: TITLE & ACTION */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <Title level={2} style={{ marginBottom: '16px', flex: 1 }}>
                    {title}
                </Title>
                {/* Nút Bookmark ở đây */}
                <div style={{ marginTop: 8 }}>
                    <BookmarkButton 
                        articleId={articleId} 
                        articleTitle={title} 
                        articleUrl={url} 
                        size="large"
                    />
                </div>
            </div>

            {/* DÒNG 2: METADATA */}
            <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <Text type="secondary" style={{ display: 'flex', alignItems: 'center' }}>
                    <CalendarOutlined style={{ marginRight: '6px' }} />
                    {new Date(publish_date).toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Divider type="vertical" />
                <Tag color="blue" style={{ display: 'flex', alignItems: 'center' }}>
                    <GlobalOutlined style={{ marginRight: '4px' }} /> {website}
                </Tag>
                <Tag color={sentiment.color} style={{ display: 'flex', alignItems: 'center' }}>
                    {sentiment.icon} <span style={{ marginLeft: '4px' }}>{sentiment.label} {ai_sentiment_score !== undefined ? `(${ai_sentiment_score})` : ''}</span>
                </Tag>
                {site_categories && site_categories.length > 0 && (
                    <>
                        <Divider type="vertical" />
                        <Space size={4} wrap>
                            <TagsOutlined style={{ color: '#595959' }} />
                            {site_categories.map((cat, index) => (
                                <Tag key={index} color="cyan">{cat}</Tag>
                            ))}
                        </Space>
                    </>
                )}
            </div>

            {/* DÒNG 3: AI SUMMARY */}
            {ai_summary && ai_summary.length > 0 && (
                <div style={{ marginBottom: '32px' }}>
                    <Alert
                        message={
                            <Space align="center">
                                <RobotOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
                                <Text strong style={{ fontSize: '16px' }}>Tóm tắt chi tiết bởi AI</Text>
                            </Space>
                        }
                        description={
                            <ul style={{ margin: '12px 0 0 20px', padding: 0 }}>
                                {ai_summary.map((point, index) => (
                                    <li key={index} style={{ marginBottom: '6px', fontSize: '15px', lineHeight: '1.6', textAlign: 'justify' }}>
                                        {point}
                                    </li>
                                ))}
                            </ul>
                        }
                        type="info"
                        showIcon={false}
                        style={{ border: '1px solid #91caff', backgroundColor: '#e6f7ff', borderRadius: '8px' }}
                    />
                </div>
            )}

            {/* DÒNG 4: NỘI DUNG CHI TIẾT */}
            <div ref={contentRef} onMouseUp={handleMouseUp} style={{ position: 'relative' }}>
                {selection && !isModalVisible && (
                    <Button
                        type="primary"
                        icon={<CommentOutlined />}
                        style={{
                            position: 'absolute',
                            left: `${selection.x}px`,
                            top: `${selection.y}px`,
                            zIndex: 100,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                        }}
                        onClick={handleOpenAskModal}
                    >
                        Hỏi Chatbot về đoạn này
                    </Button>
                )}

                <Modal
                    title="Hỏi về đoạn văn bản đã chọn"
                    open={isModalVisible}
                    onOk={handleSendFromModal}
                    onCancel={handleCancelModal}
                    okText="Gửi câu hỏi"
                    cancelText="Hủy"
                    okButtonProps={{ disabled: !question.trim() }}
                >
                    <Typography.Text strong>Văn bản đã chọn:</Typography.Text>
                    <Paragraph
                        ellipsis={{ rows: 4, expandable: true, symbol: 'xem thêm' }}
                        style={{ background: '#f5f5f5', padding: '8px', borderRadius: '4px', maxHeight: '150px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}
                    >
                        {selection?.text}
                    </Paragraph>
                    <Typography.Text strong>Câu hỏi của bạn:</Typography.Text>
                    <TextArea
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="Bạn muốn hỏi gì về đoạn văn bản này?"
                        rows={3}
                        style={{ marginTop: '8px' }}
                    />
                </Modal>

                <Paragraph style={{ whiteSpace: 'pre-wrap', fontSize: '17px', lineHeight: '1.8', color: '#262626' }}>
                    {content}
                </Paragraph>
            </div>
        </div>
    );
};

export default ArticleBody;

// import React, { useState, useRef, MouseEvent, useEffect } from 'react';
// import { Button, Typography, Modal, Input, Alert, Tag, Space, Divider } from 'antd';
// import { 
//     CommentOutlined, 
//     RobotOutlined, 
//     TagsOutlined, 
//     CalendarOutlined, 
//     GlobalOutlined, 
//     SmileOutlined, 
//     MehOutlined, 
//     FrownOutlined 
// } from '@ant-design/icons';
// import { useChatbot } from '@/components/client/chatbot/chatbot.context';

// const { Paragraph, Title, Text } = Typography;
// const { TextArea } = Input;

// interface ArticleBodyProps {
//     // Thêm articleId để set context
//     articleId: string;
//     title: string;
//     content: string;
//     website: string;
//     publish_date: string;
//     ai_sentiment_score?: number;
//     ai_summary?: string[];
//     site_categories?: string[];
// }

// const ArticleBody: React.FC<ArticleBodyProps> = ({ 
//     articleId, // New Prop
//     title, 
//     content, 
//     website, 
//     publish_date, 
//     ai_sentiment_score, 
//     ai_summary, 
//     site_categories 
// }) => {
//     const { sendMessage, setView, setPageContext } = useChatbot();
    
//     // Set Page Context cho Kịch bản 3 (Detail Page)
//     useEffect(() => {
//         if (articleId) {
//             setPageContext({
//                 current_page: 'detail_page',
//                 article_id: articleId
//             });
//         }
        
//         return () => {
//             setPageContext(null); // Cleanup
//         };
//     }, [articleId, setPageContext]);

//     const [selection, setSelection] = useState<{ x: number, y: number, text: string } | null>(null);
//     const [isModalVisible, setIsModalVisible] = useState(false);
//     const [question, setQuestion] = useState('');
    
//     const contentRef = useRef<HTMLDivElement>(null);

//     // --- Logic xử lý Sentiment Score (Tái sử dụng) ---
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

//     const sentiment = getSentimentInfo(ai_sentiment_score);

//     // --- Các hàm xử lý sự kiện ---
//     const handleMouseUp = (e: MouseEvent<HTMLDivElement>) => {
//         if (isModalVisible) return;
//         const selection = window.getSelection();
//         const selectedText = selection?.toString().trim() || '';
//         if (selectedText.length > 20) {
//             if (contentRef.current) {
//                 const containerRect = contentRef.current.getBoundingClientRect();
//                 setSelection({
//                     x: e.clientX - containerRect.left + 10,
//                     y: e.clientY - containerRect.top + window.scrollY + 10,
//                     text: selectedText,
//                 });
//             }
//         } else {
//             setSelection(null);
//         }
//     };

//     const handleOpenAskModal = () => {
//         if (!selection) return;
//         setIsModalVisible(true);
//     };

//     const handleSendFromModal = () => {
//         if (!selection || !question.trim()) return;
//         sendMessage(question, { context_text: selection.text });
//         setView('window');
//         setIsModalVisible(false);
//         setSelection(null);
//         setQuestion('');
//     };

//     const handleCancelModal = () => {
//         setIsModalVisible(false);
//         setSelection(null);
//         setQuestion('');
//     };

//     return (
//         <div className="article-body-container" style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
            
//             {/* DÒNG 1: TITLE */}
//             <Title level={2} style={{ marginBottom: '16px' }}>
//                 {title}
//             </Title>

//             {/* DÒNG 2: METADATA */}
//             <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
//                 <Text type="secondary" style={{ display: 'flex', alignItems: 'center' }}>
//                     <CalendarOutlined style={{ marginRight: '6px' }} />
//                     {new Date(publish_date).toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
//                 </Text>
//                 <Divider type="vertical" />
//                 <Tag color="blue" style={{ display: 'flex', alignItems: 'center' }}>
//                     <GlobalOutlined style={{ marginRight: '4px' }} /> {website}
//                 </Tag>
//                 <Tag color={sentiment.color} style={{ display: 'flex', alignItems: 'center' }}>
//                     {sentiment.icon} <span style={{ marginLeft: '4px' }}>{sentiment.label} {ai_sentiment_score !== undefined ? `(${ai_sentiment_score})` : ''}</span>
//                 </Tag>
//                 {site_categories && site_categories.length > 0 && (
//                     <>
//                         <Divider type="vertical" />
//                         <Space size={4} wrap>
//                             <TagsOutlined style={{ color: '#595959' }} />
//                             {site_categories.map((cat, index) => (
//                                 <Tag key={index} color="cyan">{cat}</Tag>
//                             ))}
//                         </Space>
//                     </>
//                 )}
//             </div>

//             {/* DÒNG 3: AI SUMMARY */}
//             {ai_summary && ai_summary.length > 0 && (
//                 <div style={{ marginBottom: '32px' }}>
//                     <Alert
//                         message={
//                             <Space align="center">
//                                 <RobotOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
//                                 <Text strong style={{ fontSize: '16px' }}>Tóm tắt chi tiết bởi AI</Text>
//                             </Space>
//                         }
//                         description={
//                             <ul style={{ margin: '12px 0 0 20px', padding: 0 }}>
//                                 {ai_summary.map((point, index) => (
//                                     <li key={index} style={{ marginBottom: '6px', fontSize: '15px', lineHeight: '1.6', textAlign: 'justify' }}>
//                                         {point}
//                                     </li>
//                                 ))}
//                             </ul>
//                         }
//                         type="info"
//                         showIcon={false}
//                         style={{ border: '1px solid #91caff', backgroundColor: '#e6f7ff', borderRadius: '8px' }}
//                     />
//                 </div>
//             )}

//             {/* DÒNG 4: NỘI DUNG CHI TIẾT */}
//             <div ref={contentRef} onMouseUp={handleMouseUp} style={{ position: 'relative' }}>
//                 {selection && !isModalVisible && (
//                     <Button
//                         type="primary"
//                         icon={<CommentOutlined />}
//                         style={{
//                             position: 'absolute',
//                             left: `${selection.x}px`,
//                             top: `${selection.y}px`,
//                             zIndex: 100,
//                             boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
//                         }}
//                         onClick={handleOpenAskModal}
//                     >
//                         Hỏi Chatbot về đoạn này
//                     </Button>
//                 )}

//                 <Modal
//                     title="Hỏi về đoạn văn bản đã chọn"
//                     open={isModalVisible}
//                     onOk={handleSendFromModal}
//                     onCancel={handleCancelModal}
//                     okText="Gửi câu hỏi"
//                     cancelText="Hủy"
//                     okButtonProps={{ disabled: !question.trim() }}
//                 >
//                     <Typography.Text strong>Văn bản đã chọn:</Typography.Text>
//                     <Paragraph
//                         ellipsis={{ rows: 4, expandable: true, symbol: 'xem thêm' }}
//                         style={{ 
//                             background: '#f5f5f5', 
//                             padding: '8px', 
//                             borderRadius: '4px', 
//                             maxHeight: '150px', 
//                             overflowY: 'auto',
//                             whiteSpace: 'pre-wrap'
//                         }}
//                     >
//                         {selection?.text}
//                     </Paragraph>
//                     <Typography.Text strong>Câu hỏi của bạn:</Typography.Text>
//                     <TextArea
//                         value={question}
//                         onChange={(e) => setQuestion(e.target.value)}
//                         placeholder="Bạn muốn hỏi gì về đoạn văn bản này?"
//                         rows={3}
//                         style={{ marginTop: '8px' }}
//                     />
//                 </Modal>

//                 <Paragraph style={{ whiteSpace: 'pre-wrap', fontSize: '17px', lineHeight: '1.8', color: '#262626' }}>
//                     {content}
//                 </Paragraph>
//             </div>
//         </div>
//     );
// };

// export default ArticleBody;