'use client';

import React, { useContext, useState, useEffect } from 'react';
import { 
    Form, Input, Button, DatePicker, InputNumber, Card, notification, 
    Select, Spin, Row, Col, Typography, Flex, theme, Divider, Space, Tag, Tooltip 
} from 'antd';
import { 
    SearchOutlined, 
    GlobalOutlined, 
    CalendarOutlined, 
    FileTextOutlined, 
    NumberOutlined, 
    RocketOutlined,
    ClearOutlined,
    HistoryOutlined,
    InfoCircleOutlined
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import dayjs from 'dayjs';
import { sendRequest } from '@/utils/api';
import { ISearchHistory } from '@/types/next-auth';
import { ClientContext } from '@/components/client/layout/client.context'; 

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

interface ICrawlResponse {
    status: string;
    search_id: string;
    stream_url: string;
    meta: {
        total_available_now: number;
        page: number;
        page_size: number;
    };
}

interface IWebsite {
    _id: string;
    name: string;
    displayName: string;
}

const ArticleList = () => {
    const { token } = theme.useToken();
    const [form] = Form.useForm();
    const router = useRouter();
    const { data: session, status } = useSession();
    
    const clientContext = useContext(ClientContext);
    const setSearchHistory = clientContext?.setSearchHistory;
    const searchHistory = clientContext?.searchHistory || [];

    const [loading, setLoading] = useState(false);
    const [loadingWebsites, setLoadingWebsites] = useState(true);
    const [availableWebsites, setAvailableWebsites] = useState<IWebsite[]>([]);

    useEffect(() => {
        const fetchWebsites = async () => {
            if (session?.user?._id) {
                try {
                    setLoadingWebsites(true);
                    const res = await sendRequest<IWebsite[]>({
                        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/article/websites`,
                        method: 'GET',
                        session: session,
                    });
                    
                    if (res?.data && Array.isArray(res.data)) {
                        setAvailableWebsites(res.data);
                    }
                } catch (error) {
                    console.error("Lỗi tải websites:", error);
                } finally {
                    setLoadingWebsites(false);
                }
            }
        };
        
        if (status === 'authenticated' && session?.user?._id && availableWebsites.length === 0) {
            fetchWebsites();
        }
    }, [status, session, availableWebsites.length]);

    const onFinish = async (values: any) => {
        if (status === 'loading') return;
        
        if (status === 'unauthenticated' || !session?.user?._id) {
            notification.error({ title: 'Vui lòng đăng nhập', description: 'Bạn cần đăng nhập để sử dụng tính năng này.' });
            return;
        }

        setLoading(true);

        const { keyword_search, keyword_content, max_articles, websites, dateRange } = values;
        
        const searchPayload = {
            keyword_search,
            keyword_content,
            max_articles: max_articles || 10,
            start_date: dateRange?.[0] ? dayjs(dateRange[0]).format('DD/MM/YYYY') : undefined,
            end_date: dateRange?.[1] ? dayjs(dateRange[1]).format('DD/MM/YYYY') : undefined,
            user_id: session.user._id,
            websites: websites || [],
        };

        try {
            const res = await sendRequest<ICrawlResponse>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/article/crawl`,
                method: 'POST',
                body: searchPayload,
                session: session,
            });

            const responseData = res?.data;
            const searchId = responseData?.search_id;

            if (searchId) {
                notification.success({
                    title: 'Đã kích hoạt tìm kiếm',
                    description: 'Hệ thống đang bắt đầu thu thập dữ liệu...',
                    duration: 3,
                });
                
                if (setSearchHistory) {
                    const currentTs = new Date().getTime();
                    sendRequest<ISearchHistory[]>({
                        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/article/history/${session.user._id}?_t=${currentTs}`,
                        method: 'GET',
                        session: session
                    }).then(historyRes => {
                        if (historyRes?.data && Array.isArray(historyRes.data)) {
                            setSearchHistory(historyRes.data);
                        }
                    });
                }
                router.push(`/model/article?id=${searchId}`);

            } else {
                notification.error({
                    title: 'Không thể bắt đầu',
                    description: res.message || 'Vui lòng thử lại sau.',
                });
            }
        } catch (error: any) {
            notification.error({
                title: 'Lỗi kết nối',
                description: error.message || 'Không thể kết nối đến máy chủ.',
            });
        } finally {
            setLoading(false);
        }
    };

    const fillFromHistory = (keyword: string) => {
        form.setFieldValue('keyword_search', keyword);
    };

    const recentKeywords = Array.from(new Set(searchHistory.map(h => h.keyword_search))).slice(0, 5);

    return (
        <Card 
            variant="borderless"
            style={{ 
                borderRadius: 24,
                boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)',
                overflow: 'hidden',
                background: '#fff'
            }}
            styles={{ 
                header: { 
                    borderBottom: `1px solid ${token.colorSplit}`, 
                    padding: '24px 32px',
                    background: 'linear-gradient(to right, #fff, #f9f9f9)'
                },
                body: { padding: '32px 40px' }
            }}
            title={
                <Flex align="center" gap={16}>
                    <div style={{ 
                        background: `linear-gradient(135deg, ${token.colorPrimary}, ${token.colorPrimaryActive})`, 
                        padding: 10, 
                        borderRadius: 16, 
                        boxShadow: `0 4px 12px ${token.colorPrimary}40`,
                        display: 'flex',
                        color: '#fff'
                    }}>
                        <RocketOutlined style={{ fontSize: 24 }} />
                    </div>
                    <Flex vertical gap={2}>
                        <Title level={4} style={{ margin: 0 }}>Thiết lập thông số Crawler</Title>
                        <Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
                            Cấu hình bộ lọc để AI thu thập chính xác nội dung bạn cần
                        </Text>
                    </Flex>
                </Flex>
            }
        >
            <Form 
                form={form} 
                onFinish={onFinish} 
                layout="vertical" 
                size="large"
                requiredMark="optional"
                initialValues={{
                    max_articles: 10
                }}
            >
                <div style={{ marginBottom: 24 }}>
                    <Title level={5} style={{ marginBottom: 16, color: token.colorTextSecondary }}>
                        <SearchOutlined /> Nội dung & Từ khóa
                    </Title>
                    
                    <Row gutter={24}>
                        <Col xs={24} md={12}>
                            <Form.Item 
                                label={<Text strong>Từ khóa tiêu đề <span style={{ color: token.colorError }}>*</span></Text>}
                                name="keyword_search" 
                                rules={[{ required: true, message: 'Vui lòng nhập từ khóa chính!' }]}
                            >
                                <Input 
                                    placeholder="Ví dụ: công nghệ AI, thị trường chứng khoán..." 
                                    prefix={<SearchOutlined style={{ color: token.colorTextPlaceholder }} />} 
                                    allowClear
                                />
                            </Form.Item>
                            
                            {recentKeywords.length > 0 && (
                                <Flex gap={8} wrap="wrap" style={{ marginTop: -8, marginBottom: 12 }}>
                                    <Text type="secondary" style={{ fontSize: 12 }}>Gần đây:</Text>
                                    {recentKeywords.map((kw, idx) => (
                                        <Tag 
                                            key={idx} 
                                            style={{ cursor: 'pointer', border: 'none', background: token.colorFillSecondary }}
                                            onClick={() => fillFromHistory(kw)}
                                        >
                                            {kw}
                                        </Tag>
                                    ))}
                                </Flex>
                            )}
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item 
                                label={
                                    <Space>
                                        <Text strong>Từ khóa trong nội dung</Text>
                                        <Tooltip title="Chỉ lấy bài viết có chứa từ này trong phần thân bài">
                                            <InfoCircleOutlined style={{ color: token.colorTextDescription }} />
                                        </Tooltip>
                                    </Space>
                                } 
                                name="keyword_content"
                            >
                                <Input 
                                    placeholder="Ví dụ: chi tiết, chuyên sâu, phân tích..." 
                                    prefix={<FileTextOutlined style={{ color: token.colorTextPlaceholder }} />} 
                                    allowClear
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </div>

                <Divider style={{ margin: '8px 0 24px 0', borderColor: token.colorSplit }} />

                <div style={{ marginBottom: 12 }}>
                    <Title level={5} style={{ marginBottom: 16, color: token.colorTextSecondary }}>
                        <GlobalOutlined /> Phạm vi & Nguồn tin
                    </Title>

                    <Row gutter={24}>
                        <Col xs={24} md={12}>
                            <Form.Item 
                                label={<Text strong>Nguồn website</Text>}
                                name="websites"
                            >
                                <Select
                                    mode="multiple"
                                    allowClear
                                    style={{ width: '100%' }}
                                    placeholder="Tất cả nguồn (Mặc định)"
                                    loading={loadingWebsites}
                                    notFoundContent={loadingWebsites ? <Spin size="small" /> : null}
                                    options={availableWebsites.map(ws => ({ label: ws.displayName, value: ws.name }))}
                                    maxTagCount="responsive"
                                    suffixIcon={<GlobalOutlined />}
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item 
                                label={<Text strong>Khoảng thời gian <span style={{ color: token.colorError }}>*</span></Text>}
                                name="dateRange"
                            >
                                <RangePicker
                                    style={{ width: '100%' }}
                                    format="DD/MM/YYYY"
                                    placeholder={['Từ ngày', 'Đến ngày']}
                                    separator={<span style={{ color: token.colorTextPlaceholder }}>→</span>}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={24}>
                        <Col xs={24} md={12}>
                            <Form.Item 
                                label={<Text strong>Số lượng bài tối đa</Text>}
                                name="max_articles"
                                help={<Text type="secondary" style={{ fontSize: 12 }}>Số lượng càng lớn, thời gian xử lý càng lâu</Text>}
                            >
                                <Space.Compact>
                                    <InputNumber
                                        min={1}
                                        max={100}
                                        style={{ width: '100%' }}
                                        prefix={<NumberOutlined style={{ color: token.colorTextPlaceholder }} />}
                                    />
                                    <span style={{ padding: '0 11px', backgroundColor: '#f5f5f5', border: '1px solid #d9d9d9', borderLeft: 'none', borderRadius: '0 6px 6px 0', display: 'inline-flex', alignItems: 'center' }}>bài viết</span>
                                </Space.Compact>
                            </Form.Item>
                        </Col>
                    </Row>
                </div>

                <Divider style={{ margin: '12px 0 32px 0' }} />
                
                <Form.Item style={{ marginBottom: 0 }}>
                    <Flex gap={16} justify="end">
                        <Button 
                            size="large"
                            icon={<ClearOutlined />} 
                            onClick={() => form.resetFields()}
                            disabled={loading}
                            style={{ borderRadius: 12 }}
                        >
                            Thiết lập lại
                        </Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            size="large"
                            icon={loading ? <Spin /> : <RocketOutlined />}
                            loading={loading}
                            style={{ 
                                minWidth: 200,
                                background: loading ? undefined : `linear-gradient(135deg, ${token.colorPrimary}, ${token.colorPrimaryActive})`,
                                border: 'none',
                                borderRadius: 12,
                                fontWeight: 600,
                                boxShadow: `0 8px 20px ${token.colorPrimary}40`
                            }}
                        >
                            {loading ? 'Đang khởi tạo...' : 'Bắt đầu Crawler'}
                        </Button>
                    </Flex>
                </Form.Item>
            </Form>
        </Card>
    );
};

export default ArticleList;