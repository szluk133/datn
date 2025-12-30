'use client'

import React, { useEffect, useState } from "react";
import { Card, Col, Row, Statistic, Spin, Tooltip } from "antd";
import { 
    FileTextOutlined, 
    GlobalOutlined, 
    SafetyCertificateOutlined, 
    SyncOutlined,
    SmileOutlined,
    MehOutlined,
    FrownOutlined,
    QuestionCircleOutlined,
    SearchOutlined // Thêm icon tìm kiếm
} from "@ant-design/icons";
import { sendRequest } from "@/utils/api";
import { useSession } from "next-auth/react";
import { IAdminStats } from "@/types/next-auth";

const AdminCard = () => {
    const { data: session } = useSession();
    const [stats, setStats] = useState<IAdminStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            if (!session) return;
            try {
                const res = await sendRequest<IAdminStats>({
                    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/admin/dashboard/stats`,
                    method: "GET",
                    session: session,
                });
                
                if (res.data) {
                    setStats(res.data);
                }
            } catch (error) {
                console.error("Failed to fetch stats", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [session]);

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin size="large" />
                <div style={{ marginTop: 16, color: '#8c8c8c' }}>Đang tải thống kê...</div>
            </div>
        );
    }
    
    if (!stats) return null;

    return (
        // Grid 5 cột cho màn hình lớn (lg), tự động xuống dòng ở màn hình nhỏ
        <Row gutter={[16, 16]}>
            {/* 1. Tổng bài viết */}
            <Col xs={24} sm={12} md={8} lg={5}>
                <Card variant="borderless" hoverable style={{ height: '100%' }}>
                    <Statistic
                        title="Tổng bài viết"
                        value={stats.totalArticles}
                        prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
                        formatter={(value) => <span style={{ color: '#1890ff', fontWeight: 'bold' }}>{value}</span>}
                    />
                </Card>
            </Col>
            
            {/* 2. Nguồn tin hàng đầu */}
            <Col xs={24} sm={12} md={8} lg={5}>
                <Card variant="borderless" hoverable style={{ height: '100%' }}>
                    <Statistic
                        title="Nguồn tin hàng đầu"
                        value={stats.topSources[0]?._id || "N/A"}
                        suffix={<span style={{ fontSize: '12px', color: '#8c8c8c' }}>({stats.topSources[0]?.count || 0})</span>}
                        prefix={<GlobalOutlined style={{ color: '#52c41a' }} />}
                        styles={{
                            content: { fontSize: '18px'}
                        }}
                    />
                </Card>
            </Col>

            {/* 3. Phân tích cảm xúc (Chiếm nhiều không gian hơn) */}
            <Col xs={24} sm={24} md={8} lg={6}>
                <Card variant="borderless" hoverable style={{ height: '100%' }} styles={{ body: { padding: '20px 24px 10px' } }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Statistic
                            title={
                                <Tooltip title="Mức độ tự tin trung bình của AI khi gán nhãn">
                                    <span>Độ tin cậy AI <QuestionCircleOutlined style={{fontSize: 12}}/></span>
                                </Tooltip>
                            }
                            value={stats.sentiment.avgConfidence * 100}
                            precision={1}
                            suffix="%"
                            prefix={<SafetyCertificateOutlined style={{ color: '#722ed1' }} />}
                            styles={{ content: { color: '#722ed1' } }}
                        />
                    </div>
                    
                    <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <Tooltip title={`Tích cực: ${stats.sentiment.positive} bài`}>
                            <span style={{ color: '#52c41a', cursor: 'help' }}>
                                <SmileOutlined /> <b>{stats.sentiment.positive}</b>
                            </span>
                        </Tooltip>
                        <Tooltip title={`Trung tính: ${stats.sentiment.neutral} bài`}>
                            <span style={{ color: '#faad14', cursor: 'help' }}>
                                <MehOutlined /> <b>{stats.sentiment.neutral}</b>
                            </span>
                        </Tooltip>
                        <Tooltip title={`Tiêu cực: ${stats.sentiment.negative} bài`}>
                            <span style={{ color: '#f5222d', cursor: 'help' }}>
                                <FrownOutlined /> <b>{stats.sentiment.negative}</b>
                            </span>
                        </Tooltip>
                    </div>
                </Card>
            </Col>

            {/* 4. Đã crawl hôm nay */}
            <Col xs={24} sm={12} md={12} lg={4}>
                <Card variant="borderless" hoverable style={{ height: '100%' }}>
                    <Statistic
                        title="Đã crawl hôm nay"
                        value={stats.crawledToday}
                        prefix={<SyncOutlined spin={stats.crawledToday > 0} style={{ color: '#faad14' }} />}
                    />
                </Card>
            </Col>

            {/* 5. Tìm kiếm hôm nay (MỚI) */}
            <Col xs={24} sm={12} md={12} lg={4}>
                <Card variant="borderless" hoverable style={{ height: '100%' }}>
                    <Statistic
                        title="Tìm kiếm hôm nay"
                        value={stats.searchesToday}
                        prefix={<SearchOutlined style={{ color: '#eb2f96' }} />}
                        formatter={(value) => <span style={{ color: '#eb2f96', fontWeight: 'bold' }}>{value}</span>}
                    />
                </Card>
            </Col>
        </Row>
    )
}

export default AdminCard;