import React from 'react';
import { Row, Col } from 'antd';
import AdminCard from "@/components/admin/admin.card";
import DashboardCharts from '@/components/admin/dashboard/dashboard.charts';
import DashboardKeywords from '@/components/admin/dashboard/dashboard.keywords';
import SystemLogs from '@/components/admin/system.logs';
import SystemSchedule from '@/components/admin/system.schedule';
import DashboardSources from '@/components/admin/dashboard/dashboard.sources';
import DashboardCategories from '@/components/admin/dashboard/dashboard.categories';

const DashboardPage = () => {
    return (
        <div>
            {/* 1. Thống kê & Cấu hình */}
            <AdminCard />
            <SystemSchedule />

            {/* 2. Biểu đồ chính */}
            <Row gutter={[16, 16]}>
                <Col xs={24} lg={16}>
                    <DashboardCharts />
                </Col>
                <Col xs={24} lg={8}>
                    <DashboardKeywords />
                </Col>
            </Row>

            {/* 3. Biểu đồ phân tích sâu (MỚI) */}
            <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                    <DashboardSources />
                </Col>
                <Col xs={24} lg={12}>
                    <DashboardCategories />
                </Col>
            </Row>

            {/* 4. Logs */}
            <SystemLogs />
        </div>
    )
}

export default DashboardPage;