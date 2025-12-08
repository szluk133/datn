'use client'

import React from 'react';
import { Layout, Typography, Button, Row, Col, Card, Space, Divider, Statistic } from 'antd';
import { 
    RocketOutlined, 
    BarChartOutlined, 
    RobotOutlined, 
    SearchOutlined, 
    GlobalOutlined, 
    LoginOutlined, 
    UserAddOutlined,
    GithubOutlined,
    SafetyCertificateOutlined
} from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const { Header, Content, Footer } = Layout;
const { Title, Paragraph, Text } = Typography;

const HomePage = () => {
    const router = useRouter();

    const features = [
        {
            icon: <GlobalOutlined style={{ fontSize: '32px', color: '#1890ff' }} />,
            title: 'Thu thập Đa nguồn',
            desc: 'Tự động crawl và tổng hợp bài viết liên tục từ 2 nguồn báo uy tín hàng đầu: VnEconomy.vn và VnExpress.net.'
        },
        {
            icon: <SearchOutlined style={{ fontSize: '32px', color: '#52c41a' }} />,
            title: 'Tìm kiếm Nâng cao',
            desc: 'Hỗ trợ tìm kiếm theo từ khóa, lọc theo khoảng thời gian, chủ đề và chỉ số cảm xúc của bài viết.'
        },
        {
            icon: <BarChartOutlined style={{ fontSize: '32px', color: '#faad14' }} />,
            title: 'Phân tích & Thống kê',
            desc: 'Dashboard trực quan với biểu đồ xu hướng, từ khóa nổi bật (Hot Trend) và phân tích sắc thái tin tức.'
        },
        {
            icon: <RobotOutlined style={{ fontSize: '32px', color: '#eb2f96' }} />,
            title: 'Chatbot AI Thông minh',
            desc: 'Trợ lý ảo hỗ trợ hỏi đáp, tóm tắt nội dung và trích xuất thông tin nhanh chóng từ kho dữ liệu bài báo.'
        }
    ];

    return (
        <Layout className="layout" style={{ minHeight: '100vh', background: '#fff' }}>
            {/* --- HEADER --- */}
            <Header style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                background: '#fff', 
                boxShadow: '0 2px 8px #f0f1f2',
                padding: '0 50px',
                position: 'sticky',
                top: 0,
                zIndex: 1000
            }}>
                <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <RocketOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
                    <Text strong style={{ fontSize: '20px', color: '#001529' }}>NewsCrawler</Text>
                </div>
                <Space>
                    <Link href="/auth/login">
                        <Button type="text" icon={<LoginOutlined />}>Đăng nhập</Button>
                    </Link>
                    <Link href="/auth/register">
                        <Button type="primary" icon={<UserAddOutlined />}>Đăng ký ngay</Button>
                    </Link>
                </Space>
            </Header>

            <Content>
                {/* --- HERO SECTION --- */}
                <div style={{ 
                    background: 'linear-gradient(135deg, #001529 0%, #0050b3 100%)', 
                    padding: '100px 20px', 
                    textAlign: 'center',
                    color: '#fff'
                }}>
                    <Row justify="center">
                        <Col xs={24} md={16} lg={12}>
                            <Title level={1} style={{ color: '#fff', marginBottom: 24, fontSize: '48px' }}>
                                Hệ thống Thu thập & Phân tích Tin tức
                            </Title>
                            <Paragraph style={{ color: 'rgba(255,255,255,0.85)', fontSize: '18px', marginBottom: 40 }}>
                                Giải pháp toàn diện giúp bạn nắm bắt thông tin thị trường nhanh chóng từ 
                                <Text strong style={{ color: '#bae7ff', margin: '0 5px' }}>VnEconomy</Text> 
                                và 
                                <Text strong style={{ color: '#bae7ff', margin: '0 5px' }}>VnExpress</Text>.
                                Tích hợp AI Chatbot và công cụ phân tích cảm xúc tiên tiến.
                            </Paragraph>
                            <Space size="large">
                                <Link href="/dashboard">
                                    <Button type="primary" size="large" shape="round" style={{ height: 50, padding: '0 40px', fontSize: 16 }}>
                                        Khám phá Dashboard
                                    </Button>
                                </Link>
                                <Link href="#features">
                                    <Button ghost size="large" shape="round" style={{ height: 50, padding: '0 40px', fontSize: 16 }}>
                                        Tìm hiểu thêm
                                    </Button>
                                </Link>
                            </Space>
                        </Col>
                    </Row>
                </div>

                {/* --- FEATURES SECTION --- */}
                <div id="features" style={{ padding: '80px 50px', background: '#f0f2f5' }}>
                    <div style={{ textAlign: 'center', marginBottom: 60 }}>
                        <Title level={2}>Tính năng nổi bật</Title>
                        <Paragraph type="secondary">Cung cấp các công cụ mạnh mẽ để khai thác dữ liệu báo chí</Paragraph>
                    </div>
                    
                    <Row gutter={[32, 32]}>
                        {features.map((item, index) => (
                            <Col xs={24} sm={12} lg={6} key={index}>
                                <Card 
                                    hoverable 
                                    style={{ height: '100%', borderRadius: 12, textAlign: 'center' }}
                                    bodyStyle={{ padding: '40px 24px' }}
                                >
                                    <div style={{ marginBottom: 24 }}>{item.icon}</div>
                                    <Title level={4} style={{ marginBottom: 16 }}>{item.title}</Title>
                                    <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                                        {item.desc}
                                    </Paragraph>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </div>

                {/* --- CHATBOT SECTION --- */}
                <div style={{ padding: '80px 50px', background: '#fff' }}>
                    <Row align="middle" gutter={[64, 32]}>
                        <Col xs={24} md={12}>
                            <Card 
                                variant="borderless"
                                style={{ background: '#e6f7ff', borderRadius: 20, padding: 20 }}
                            >
                                <div style={{ textAlign: 'center' }}>
                                    <RobotOutlined style={{ fontSize: '120px', color: '#1890ff' }} />
                                </div>
                            </Card>
                        </Col>
                        <Col xs={24} md={12}>
                            <Title level={2} style={{ color: '#1890ff' }}>
                                <RobotOutlined /> Chatbot Hỏi đáp Thông minh
                            </Title>
                            <Paragraph style={{ fontSize: '16px' }}>
                                Không cần đọc hàng trăm bài báo mỗi ngày. Chatbot của chúng tôi sử dụng công nghệ AI để:
                            </Paragraph>
                            <ul style={{ fontSize: '16px', lineHeight: '2', color: 'rgba(0, 0, 0, 0.65)' }}>
                                <li>✅ Tóm tắt nhanh nội dung chính của các sự kiện nóng.</li>
                                <li>✅ Trả lời câu hỏi cụ thể dựa trên dữ liệu đã thu thập.</li>
                                <li>✅ Phân tích quan điểm và thái độ của bài viết.</li>
                                <li>✅ Hỗ trợ tra cứu lịch sử sự kiện tài chính.</li>
                            </ul>
                            <Button type="primary" size="large" style={{ marginTop: 20 }}>
                                Thử Chat ngay
                            </Button>
                        </Col>
                    </Row>
                </div>

                {/* --- STATS SECTION --- */}
                <div style={{ padding: '60px 50px', background: '#001529', color: '#fff' }}>
                    <Row gutter={[32, 32]} justify="center">
                        <Col xs={12} md={6} style={{ textAlign: 'center' }}>
                            <Statistic title={<span style={{ color: '#bae7ff' }}>Bài viết đã Crawl</span>} value={15890} valueStyle={{ color: '#fff', fontSize: 36 }} />
                        </Col>
                        <Col xs={12} md={6} style={{ textAlign: 'center' }}>
                            <Statistic title={<span style={{ color: '#bae7ff' }}>Nguồn báo</span>} value={2} valueStyle={{ color: '#fff', fontSize: 36 }} suffix="Websites" />
                        </Col>
                        <Col xs={12} md={6} style={{ textAlign: 'center' }}>
                            <Statistic title={<span style={{ color: '#bae7ff' }}>Người dùng</span>} value={250} valueStyle={{ color: '#fff', fontSize: 36 }} prefix={<UserAddOutlined />} />
                        </Col>
                        <Col xs={12} md={6} style={{ textAlign: 'center' }}>
                            <Statistic title={<span style={{ color: '#bae7ff' }}>Độ chính xác AI</span>} value={95} valueStyle={{ color: '#fff', fontSize: 36 }} suffix="%" />
                        </Col>
                    </Row>
                </div>
            </Content>

            {/* --- FOOTER --- */}
            <Footer style={{ textAlign: 'center', background: '#f0f2f5', padding: '40px 50px' }}>
                <Row justify="center" style={{ marginBottom: 20 }}>
                    <Space size="large">
                        <Button type="link" icon={<GithubOutlined />} href="https://github.com/szluk133" target="_blank">Github</Button>
                        <Button type="link" icon={<SafetyCertificateOutlined />}>Chính sách bảo mật</Button>
                        <Button type="link">Điều khoản sử dụng</Button>
                    </Space>
                </Row>
                <Divider />
                <Text type="secondary">
                    NewsCrawler ©{new Date().getFullYear()} Created by <strong>Lê Văn Cương</strong>.
                    <br />
                    Powered by Next.js, Ant Design & NestJS.
                </Text>
            </Footer>
        </Layout>
    );
}

export default HomePage;