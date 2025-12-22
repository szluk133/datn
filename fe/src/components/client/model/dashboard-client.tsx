"use client";

import React from "react";
import Link from "next/link";
import { 
    Card, 
    Typography, 
    Row, 
    Col, 
    Button, 
    Steps, 
    Divider, 
    Statistic,
    Space,
    Avatar
} from "antd";
import { 
    SearchOutlined, 
    DatabaseOutlined, 
    ReadOutlined, 
    GlobalOutlined,
    FilterOutlined,
    BarChartOutlined,
    FileTextOutlined,
    ArrowRightOutlined,
    ThunderboltFilled,
    StockOutlined,
    LineChartOutlined
} from "@ant-design/icons";

import ArticleList from "@/components/client/article/article.list"; 

const { Title, Paragraph, Text } = Typography;

const DashboardClient = () => {

    const cardStyle: React.CSSProperties = {
        height: '100%', 
        borderRadius: 16, 
        border: 'none',
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        overflow: 'hidden'
    };

    const gradientHeaderStyle: React.CSSProperties = {
        background: 'linear-gradient(120deg, #1890ff 0%, #0050b3 100%)',
        borderRadius: 24,
        padding: '48px 40px',
        color: 'white',
        marginBottom: 40,
        boxShadow: '0 10px 30px rgba(24, 144, 255, 0.2)',
        position: 'relative',
        overflow: 'hidden'
    };

    return (
        <div className="dashboard-container" style={{ animation: 'fadeIn 0.5s ease-in-out' }}>
            <div style={gradientHeaderStyle}>
                <Row gutter={[32, 32]} align="middle">
                    <Col xs={24} md={16}>
                        <div style={{ position: 'relative', zIndex: 2 }}>
                            <Space align="center" style={{ marginBottom: 16 }}>
                                <Avatar icon={<ThunderboltFilled />} style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff' }} /> 
                                <Text strong style={{ color: 'rgba(255,255,255,0.8)', letterSpacing: 1 }}>AI INFORMATION INTELLIGENCE</Text>
                            </Space>
                            <Title level={1} style={{ color: 'white', fontSize: 42, margin: '0 0 16px 0', fontWeight: 700 }}>
                                Tổng hợp & Phân tích <br/>Tin tức Thông tin Tự động
                            </Title>
                            <Paragraph style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, maxWidth: 600, lineHeight: 1.6 }}>
                                Hệ thống sử dụng AI để quét, đọc hiểu và đánh giá cảm xúc thị trường từ <strong>VnEconomy, VnExpress, CafeF</strong>. Giúp bạn nắm bắt xu hướng đầu tư nhanh chóng và chính xác.
                            </Paragraph>
                            
                            <Space size="middle" style={{ marginTop: 24 }}>
                                <Link href="/model/search-available">
                                    <Button type="primary" size="large" icon={<SearchOutlined />} 
                                        style={{ height: 50, padding: '0 32px', borderRadius: 25, fontSize: 16, border: 'none', background: 'white', color: '#0050b3', fontWeight: 'bold' }}>
                                        Khám phá Dữ liệu
                                    </Button>
                                </Link>
                                <Link href="/model/saved-articles">
                                    <Button ghost size="large" icon={<ReadOutlined />} 
                                        style={{ height: 50, padding: '0 32px', borderRadius: 25, fontSize: 16, color: 'white', borderColor: 'rgba(255,255,255,0.6)' }}>
                                        Thư viện của tôi
                                    </Button>
                                </Link>
                            </Space>
                        </div>
                    </Col>
                    
                    <Col xs={24} md={8}>
                        <div style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', padding: 24, borderRadius: 16, border: '1px solid rgba(255,255,255,0.2)' }}>
                            <Row gutter={[16, 16]}>
                                <Col span={12}>
                                    <Statistic 
                                        title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>Tổng số bài viết trong 2 tháng nay</span>} 
                                        value={12084} 
                                        prefix={<FileTextOutlined />} 
                                        styles={{ content:{ color: '#fff', fontWeight: 'bold' },}} 
                                    />
                                </Col>
                                <Col span={12}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span className="ant-statistic-title" style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 4, fontSize: 14 }}>Nguồn tin</span>
                                        <div style={{ color: '#fff', fontWeight: '600', fontSize: 13, lineHeight: 1.6 }}>
                                            <div>• VnEconomy</div>
                                            <div>• VnExpress</div>
                                            <div>• CafeF</div>
                                        </div>
                                    </div>
                                </Col>
                                <Col span={24}>
                                    <Divider style={{ margin: '12px 0', borderColor: 'rgba(255,255,255,0.2)' }} />
                                    <Space>
                                        <StockOutlined style={{ color: '#52c41a' }} />
                                        <Text style={{ color: 'white', fontSize: 13 }}>Thị trường đang: <strong style={{ color: '#52c41a' }}>Tích cực</strong></Text>
                                    </Space>
                                </Col>
                            </Row>
                        </div>
                    </Col>
                </Row>
                
                <div style={{ position: 'absolute', top: -40, right: -40, width: 300, height: 300, background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)', borderRadius: '50%' }} />
            </div>

            <Title level={3} style={{ marginBottom: 24, fontWeight: 600 }}>Chức năng chính</Title>
            <Row gutter={[24, 24]} style={{ marginBottom: 48 }}>
                <Col xs={24} md={8}>
                    <Link href="/model/search-available">
                        <Card hoverable style={cardStyle} styles={{ body: { padding: 32, height: '100%', display: 'flex', flexDirection: 'column' } }}>
                            <div style={{ marginBottom: 20 }}>
                                <Avatar size={64} icon={<GlobalOutlined />} style={{ backgroundColor: '#e6f7ff', color: '#1890ff', marginBottom: 16 }} />
                                <Title level={4}>Dữ liệu Sẵn có</Title>
                                <Paragraph type="secondary" style={{ flex: 1 }}>
                                    Truy cập nhanh kho dữ liệu đã được thu thập và phân tích trong <strong>2 tháng gần nhất</strong> từ các nguồn chính thống.
                                </Paragraph>
                            </div>
                            <div style={{ marginTop: 'auto' }}>
                                <Space orientation="vertical" style={{ width: '100%' }}>
                                    <Text type="secondary" style={{ fontSize: 12 }}><span style={{ color: '#52c41a' }}>●</span> VnEconomy, VnExpress, CafeF</Text>
                                    <Text strong style={{ color: '#1890ff', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        Truy cập ngay <ArrowRightOutlined />
                                    </Text>
                                </Space>
                            </div>
                        </Card>
                    </Link>
                </Col>

                <Col xs={24} md={8}>
                    <Link href="/model/search">
                        <Card hoverable style={cardStyle} styles={{ body: { padding: 32, height: '100%', display: 'flex', flexDirection: 'column' } }}>
                            <div style={{ marginBottom: 20 }}>
                                <Avatar size={64} icon={<FilterOutlined />} style={{ backgroundColor: '#f6ffed', color: '#52c41a', marginBottom: 16 }} />
                                <Title level={4}>Tìm kiếm Chuyên sâu</Title>
                                <Paragraph type="secondary" style={{ flex: 1 }}>
                                    Công cụ lọc mạnh mẽ theo từ khóa (keyword), nội dung, khoảng thời gian cụ thể và số lượng bài viết mong muốn.
                                </Paragraph>
                            </div>
                            <div style={{ marginTop: 'auto' }}>
                                <Space orientation="vertical" style={{ width: '100%' }}>
                                    <Text type="secondary" style={{ fontSize: 12 }}><span style={{ color: '#faad14' }}>●</span> Tùy chỉnh bộ lọc đa chiều</Text>
                                    <Text strong style={{ color: '#52c41a', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        Tạo bộ lọc mới <ArrowRightOutlined />
                                    </Text>
                                </Space>
                            </div>
                        </Card>
                    </Link>
                </Col>

                <Col xs={24} md={8}>
                    <Link href="/model/saved-articles">
                        <Card hoverable style={cardStyle} styles={{ body: { padding: 32, height: '100%', display: 'flex', flexDirection: 'column' } }}>
                            <div style={{ marginBottom: 20 }}>
                                <Avatar size={64} icon={<ReadOutlined />} style={{ backgroundColor: '#fff7e6', color: '#faad14', marginBottom: 16 }} />
                                <Title level={4}>Thư viện Đã lưu</Title>
                                <Paragraph type="secondary" style={{ flex: 1 }}>
                                    Quản lý các bài báo quan trọng bạn đã đánh dấu. Dễ dàng xem lại lịch sử nghiên cứu và báo cáo đã lưu.
                                </Paragraph>
                            </div>
                            <div style={{ marginTop: 'auto' }}>
                                <Space orientation="vertical" style={{ width: '100%' }}>
                                    <Text type="secondary" style={{ fontSize: 12 }}><span style={{ color: '#ff4d4f' }}>●</span> Lưu trữ cá nhân hóa</Text>
                                    <Text strong style={{ color: '#faad14', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        Xem danh sách <ArrowRightOutlined />
                                    </Text>
                                </Space>
                            </div>
                        </Card>
                    </Link>
                </Col>
            </Row>

            <Card style={{ borderRadius: 16, marginBottom: 48, background: '#fff' }} variant="borderless">
                <Row align="middle" gutter={[24, 24]}>
                    <Col xs={24} md={6}>
                        <Title level={4}>Quy trình<br/>Hoạt động</Title>
                        <Paragraph type="secondary">
                            Hệ thống tự động hóa hoàn toàn từ khâu thu thập đến phân tích dữ liệu.
                        </Paragraph>
                    </Col>
                    <Col xs={24} md={18}>
                        <Steps 
                            current={-1} 
                            items={[
                                { 
                                    title: 'Thu thập', 
                                    content: 'Quét dữ liệu Real-time', 
                                    icon: <DatabaseOutlined style={{ fontSize: 24, color: '#1890ff' }} /> 
                                },
                                { 
                                    title: 'Phân tích AI', 
                                    content: 'NLP & Sentiment Analysis', 
                                    icon: <BarChartOutlined style={{ fontSize: 24, color: '#1890ff' }} /> 
                                },
                                { 
                                    title: 'Khai thác', 
                                    content: 'Tìm kiếm & Chatbot', 
                                    icon: <FileTextOutlined style={{ fontSize: 24, color: '#1890ff' }} /> 
                                },
                            ]}
                        />
                    </Col>
                </Row>
            </Card>

            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Title level={3} style={{ margin: 0 }}>
                    <LineChartOutlined style={{ marginRight: 10, color: '#ff4d4f' }} />
                    Xu hướng Tin tức Mới nhất
                </Title>
                <Link href="/model/search-available">
                    <Button type="link">Xem tất cả <ArrowRightOutlined /></Button>
                </Link>
            </div>
            
            <div style={{ background: 'white', padding: 24, borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <ArticleList />
            </div>

            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default DashboardClient;