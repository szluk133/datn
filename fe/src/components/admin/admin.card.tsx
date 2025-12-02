'use client'

import React, { useEffect, useState } from "react";
import { Card, Col, Row, Statistic, Spin } from "antd";
import { 
    FileTextOutlined, 
    GlobalOutlined, 
    SmileOutlined, 
    SyncOutlined 
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

    // FIX: Sửa lỗi Spin tip bằng cách tách text ra riêng hoặc dùng cấu trúc lồng nhau
    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin size="large" />
                <div style={{ marginTop: 16, color: '#8c8c8c' }}>Đang tải thống kê...</div>
            </div>
        );
    }
    
    if (!stats) return null;

    // FIX: Thay bordered={false} bằng variant="borderless"
    return (
        <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
                <Card variant="borderless" hoverable style={{ height: '100%' }}>
                    <Statistic
                        title="Tổng bài viết"
                        value={stats.totalArticles}
                        prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
                        formatter={(value) => <span style={{ color: '#1890ff', fontWeight: 'bold' }}>{value}</span>}
                    />
                </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
                <Card variant="borderless" hoverable style={{ height: '100%' }}>
                    <Statistic
                        title="Nguồn tin hàng đầu"
                        value={stats.topSources[0]?._id || "N/A"}
                        suffix={<span style={{ fontSize: '12px', color: '#8c8c8c' }}>({stats.topSources[0]?.count || 0})</span>}
                        prefix={<GlobalOutlined style={{ color: '#52c41a' }} />}
                        valueStyle={{ fontSize: '18px' }}
                    />
                </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
                <Card variant="borderless" hoverable style={{ height: '100%' }}>
                    <Statistic
                        title="Cảm xúc trung bình"
                        value={stats.sentiment.avgSentiment}
                        precision={2}
                        prefix={<SmileOutlined style={{ color: stats.sentiment.avgSentiment >= 0 ? '#52c41a' : '#f5222d' }} />}
                        suffix={<span style={{ fontSize: '12px', color: '#8c8c8c' }}>(Pos: {stats.sentiment.positive})</span>}
                        valueStyle={{ color: stats.sentiment.avgSentiment >= 0 ? '#52c41a' : '#f5222d' }}
                    />
                </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
                <Card variant="borderless" hoverable style={{ height: '100%' }}>
                    <Statistic
                        title="Đã crawl hôm nay"
                        value={stats.crawledToday}
                        prefix={<SyncOutlined spin={stats.crawledToday > 0} style={{ color: '#faad14' }} />}
                    />
                </Card>
            </Col>
        </Row>
    )
}

export default AdminCard;