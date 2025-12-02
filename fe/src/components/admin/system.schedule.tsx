'use client'

import React, { useState } from 'react';
import { Card, Button, InputNumber, Form, notification, Space, Popconfirm, Tag, Divider } from 'antd';
import { ClockCircleOutlined, ThunderboltOutlined, SettingOutlined } from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import { sendRequest } from '../../utils/api';

const SystemSchedule = () => {
    const { data: session } = useSession();
    const [loadingSchedule, setLoadingSchedule] = useState(false);
    const [loadingTrigger, setLoadingTrigger] = useState(false);
    const [form] = Form.useForm();

    const handleUpdateSchedule = async (values: { minutes: number }) => {
        if (!session) return;
        setLoadingSchedule(true);
        try {
            const res = await sendRequest<any>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/admin/schedule`,
                method: "POST",
                body: { minutes: values.minutes },
                session: session,
            });

            if (res.data) {
                notification.success({
                    message: 'Cập nhật thành công',
                    description: `Đã đặt lịch crawl tự động mỗi ${values.minutes} phút.`,
                });
            } else {
                notification.error({
                    message: 'Lỗi cập nhật',
                    description: res.message || 'Không thể kết nối tới server.',
                });
            }
        } catch (error: any) {
            notification.error({ message: 'Lỗi hệ thống', description: error.message });
        } finally {
            setLoadingSchedule(false);
        }
    };

    const handleTriggerNow = async () => {
        if (!session) return;
        setLoadingTrigger(true);
        try {
            const res = await sendRequest<any>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/admin/trigger-auto-crawl`,
                method: "POST",
                body: {},
                session: session,
            });

            if (res.data) {
                notification.success({
                    message: 'Kích hoạt thành công',
                    description: 'Hệ thống đang bắt đầu crawl dữ liệu ngay lập tức.',
                });
            } else {
                notification.error({
                    message: 'Kích hoạt thất bại',
                    description: res.message,
                });
            }
        } catch (error: any) {
            notification.error({ message: 'Lỗi hệ thống', description: error.message });
        } finally {
            setLoadingTrigger(false);
        }
    };

    return (
        <Card 
            title={<span><SettingOutlined /> Cấu hình Crawler</span>} 
            variant="borderless" 
            style={{ marginTop: 20 }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 40 }}>
                
                {/* Phần 1: Đặt lịch (Scheduler) */}
                <div style={{ flex: 1, minWidth: 300 }}>
                    <div style={{ marginBottom: 16, fontWeight: 500 }}>Đặt lịch tự động (Scheduler):</div>
                    <Form 
                        form={form} 
                        layout="inline" 
                        onFinish={handleUpdateSchedule}
                        initialValues={{ minutes: 60 }}
                    >
                        <Form.Item 
                            name="minutes" 
                            rules={[
                                { required: true, message: 'Nhập số phút' },
                                { type: 'number', min: 5, message: 'Tối thiểu 5 phút' }
                            ]}
                        >
                            <InputNumber 
                                addonAfter="phút" 
                                placeholder="60" 
                                min={5} 
                            />
                        </Form.Item>
                        <Form.Item>
                            <Button 
                                type="primary" 
                                htmlType="submit" 
                                icon={<ClockCircleOutlined />} 
                                loading={loadingSchedule}
                            >
                                Lưu cấu hình
                            </Button>
                        </Form.Item>
                    </Form>
                    <div style={{ marginTop: 8, fontSize: '12px', color: '#8c8c8c' }}>
                        * Hệ thống sẽ tự động chạy sau mỗi khoảng thời gian này.
                    </div>
                </div>

                {/* Phần 2: Kích hoạt ngay (Trigger) */}
                <div style={{ flex: 1, minWidth: 300, borderLeft: '1px solid #f0f0f0', paddingLeft: 40 }}>
                    <div style={{ marginBottom: 16, fontWeight: 500 }}>Kích hoạt thủ công (Manual Trigger):</div>
                    <Space align="center">
                        <Popconfirm
                            title="Xác nhận chạy ngay?"
                            description="Hành động này sẽ bắt đầu tiến trình crawl mới ngay lập tức."
                            onConfirm={handleTriggerNow}
                            okText="Chạy ngay"
                            cancelText="Hủy"
                        >
                            <Button 
                                danger 
                                type="primary" 
                                icon={<ThunderboltOutlined />} 
                                loading={loadingTrigger}
                            >
                                Chạy Crawler Ngay
                            </Button>
                        </Popconfirm>
                        <Tag color="processing">Trạng thái: Sẵn sàng</Tag>
                    </Space>
                    <div style={{ marginTop: 8, fontSize: '12px', color: '#8c8c8c' }}>
                        * Bỏ qua lịch trình và chạy ngay lập tức.
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default SystemSchedule;