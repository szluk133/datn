'use client';

import React from 'react';
import { Card, Col, Row, Typography, Button, theme } from "antd";
import { SearchOutlined, StarFilled, RocketOutlined } from "@ant-design/icons";
import Link from "next/link";

const { Title, Text } = Typography;

interface IProps {
    name?: string | null;
}

const ModelDashboard = ({ name }: IProps) => {
    const { token } = theme.useToken();

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
                <Title level={2} style={{ color: '#1f1f1f', marginBottom: 8 }}>
                    Trung tâm điều khiển LVC Crawler
                </Title>
                <Text type="secondary" style={{ fontSize: 16 }}>
                    Xin chào, {name || 'Khách'}. Bạn muốn làm gì hôm nay?
                </Text>
            </div>

            <Row gutter={[24, 24]}>
                <Col xs={24} md={12}>
                    <Link href="/model/search">
                        <Card 
                            hoverable 
                            style={{ 
                                height: '100%', 
                                borderRadius: 16, 
                                border: 'none', 
                                boxShadow: '0 4px 12px rgba(0,0,0,0.05)' 
                            }}
                            styles={{ body: { padding: 40, textAlign: 'center' } }}
                        >
                            <div style={{ 
                                background: '#e6f7ff', 
                                width: 80, height: 80, 
                                borderRadius: '50%', 
                                margin: '0 auto 24px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <RocketOutlined style={{ fontSize: 36, color: '#1890ff' }} />
                            </div>
                            <Title level={3} style={{ marginBottom: 12 }}>Tìm kiếm & Thu thập</Title>
                            <Text type="secondary" style={{ display: 'block', marginBottom: 24, fontSize: 15 }}>
                                Khởi tạo tác vụ crawler mới để tìm kiếm bài báo từ nhiều nguồn khác nhau theo thời gian thực.
                            </Text>
                            <Button type="primary" size="large" icon={<SearchOutlined />} shape="round">
                                Bắt đầu tìm kiếm
                            </Button>
                        </Card>
                    </Link>
                </Col>

                <Col xs={24} md={12}>
                    <Link href="/model/saved-articles">
                        <Card 
                            hoverable 
                            style={{ 
                                height: '100%', 
                                borderRadius: 16, 
                                border: 'none', 
                                boxShadow: '0 4px 12px rgba(0,0,0,0.05)' 
                            }}
                            styles={{ body: { padding: 40, textAlign: 'center' } }}
                        >
                            <div style={{ 
                                background: '#fff7e6', 
                                width: 80, height: 80, 
                                borderRadius: '50%', 
                                margin: '0 auto 24px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <StarFilled style={{ fontSize: 36, color: '#faad14' }} />
                            </div>
                            <Title level={3} style={{ marginBottom: 12 }}>Thư viện của tôi</Title>
                            <Text type="secondary" style={{ display: 'block', marginBottom: 24, fontSize: 15 }}>
                                Xem lại danh sách các bài báo quan trọng bạn đã lưu trữ và phân tích.
                            </Text>
                            <Button size="large" shape="round">
                                Xem bài đã lưu
                            </Button>
                        </Card>
                    </Link>
                </Col>
            </Row>
        </div>
    );
};

export default ModelDashboard;