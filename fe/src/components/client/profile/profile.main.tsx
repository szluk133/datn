'use client';

import React, { useEffect, useState } from 'react';
import { 
    Tabs, Card, Form, Input, Button, Row, Col, 
    Typography, message, Avatar, theme, notification, Divider,
    Upload,
    Tag
} from 'antd';
import { 
    UserOutlined, 
    LockOutlined, 
    SaveOutlined,
    MailOutlined,
    PhoneOutlined,
    HomeOutlined,
    LinkOutlined,
    CameraOutlined
} from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';

const { Title, Text } = Typography;

interface IUserProfile {
    _id: string;
    name: string;
    email: string;
    role: string;
    phone?: string;
    address?: string;
    image?: string;
}

const ProfileMain = () => {
    const { token } = theme.useToken();
    const { data: session, update: updateSession } = useSession();
    const [formInfo] = Form.useForm();
    const [formPassword] = Form.useForm();
    
    const [activeTab, setActiveTab] = useState('info');
    const [loading, setLoading] = useState(false);
    const [userProfile, setUserProfile] = useState<IUserProfile | null>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!session?.access_token) return;
            try {
                const res = await sendRequest<IUserProfile>({
                    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/users/profile`,
                    method: 'GET',
                    session: session,
                });
                
                if (res.data) {
                    setUserProfile(res.data);
                    formInfo.setFieldsValue({
                        name: res.data.name,
                        email: res.data.email,
                        phone: res.data.phone,
                        address: res.data.address,
                        image: res.data.image
                    });
                }
            } catch (error) {
                console.error("Lỗi lấy thông tin profile:", error);
            }
        };

        fetchProfile();
    }, [session, formInfo]);

    const onUpdateInfo = async (values: any) => {
        setLoading(true);
        try {
            const res = await sendRequest<any>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/users/profile`,
                method: 'PATCH',
                body: {
                    name: values.name,
                    phone: values.phone,
                    address: values.address,
                    image: values.image
                },
                session: session,
            });

            if (res.data) {
                notification.success({ title: 'Thành công', description: 'Đã cập nhật thông tin cá nhân!' });
                setUserProfile(prev => ({ ...prev!, ...values }));
                await updateSession({
                    ...session,
                    user: {
                        ...session?.user,
                        name: values.name,
                        image: values.image
                    }
                });
            } else {
                notification.error({ title: 'Lỗi', description: res.message || 'Cập nhật thất bại.' });
            }
        } catch (error) {
            notification.error({ title: 'Lỗi', description: 'Có lỗi xảy ra khi kết nối server.' });
        } finally {
            setLoading(false);
        }
    };

    const onChangePassword = async (values: any) => {
        setLoading(true);
        try {
            const res = await sendRequest<any>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/users/change-password`,
                method: 'POST',
                body: {
                    currentPassword: values.currentPassword,
                    newPassword: values.newPassword,
                    confirmPassword: values.confirmPassword
                },
                session: session,
            });

            if (res.statusCode === 201 || res.data) {
                notification.success({ title: 'Thành công', description: 'Đổi mật khẩu thành công!' });
                formPassword.resetFields();
            } else {
                notification.error({ title: 'Thất bại', description: res.message || 'Mật khẩu hiện tại không đúng.' });
            }
        } catch (error) {
            notification.error({ title: 'Lỗi', description: 'Có lỗi xảy ra khi kết nối server.' });
        } finally {
            setLoading(false);
        }
    };

    const items = [
        {
            key: 'info',
            label: <span style={{ fontSize: 16 }}><UserOutlined /> Thông tin cá nhân</span>,
            children: (
                <div style={{ marginTop: 24 }}>
                    <Row gutter={48}>
                        <Col xs={24} md={8} style={{ textAlign: 'center', marginBottom: 24 }}>
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                                <Avatar 
                                    size={160} 
                                    src={userProfile?.image} 
                                    icon={<UserOutlined />}
                                    style={{ 
                                        border: `4px solid ${token.colorBgContainer}`,
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                        backgroundColor: token.colorPrimaryBg
                                    }} 
                                />
                            </div>
                            <div style={{ marginTop: 24 }}>
                                <Title level={4} style={{ margin: 0 }}>{userProfile?.name}</Title>
                                <Text type="secondary">{userProfile?.email}</Text>
                                <div style={{ marginTop: 8 }}>
                                    <Tag color="blue">{userProfile?.role || 'User'}</Tag>
                                </div>
                            </div>
                        </Col>
                        <Col xs={24} md={16}>
                            <Card title="Chỉnh sửa thông tin" variant='borderless' style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                                <Form 
                                    form={formInfo} 
                                    layout="vertical" 
                                    onFinish={onUpdateInfo}
                                    size="large"
                                >
                                    <Row gutter={16}>
                                        <Col span={24}>
                                            <Form.Item 
                                                name="name" 
                                                label="Họ và tên"
                                                rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
                                            >
                                                <Input prefix={<UserOutlined style={{ color: token.colorTextPlaceholder }} />} />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item name="phone" label="Số điện thoại">
                                                <Input prefix={<PhoneOutlined style={{ color: token.colorTextPlaceholder }} />} />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item name="email" label="Email (Không thể thay đổi)">
                                                <Input prefix={<MailOutlined style={{ color: token.colorTextPlaceholder }} />} disabled />
                                            </Form.Item>
                                        </Col>
                                        <Col span={24}>
                                            <Form.Item name="address" label="Địa chỉ">
                                                <Input prefix={<HomeOutlined style={{ color: token.colorTextPlaceholder }} />} />
                                            </Form.Item>
                                        </Col>
                                        <Col span={24}>
                                            <Form.Item name="image" label="Link ảnh đại diện (URL)">
                                                <Input prefix={<LinkOutlined style={{ color: token.colorTextPlaceholder }} />} placeholder="https://example.com/avatar.jpg" />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                    <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                                        <Button 
                                            type="primary" 
                                            htmlType="submit" 
                                            icon={<SaveOutlined />} 
                                            loading={loading}
                                            style={{ minWidth: 140 }}
                                        >
                                            Cập nhật
                                        </Button>
                                    </Form.Item>
                                </Form>
                            </Card>
                        </Col>
                    </Row>
                </div>
            )
        },
        {
            key: 'password',
            label: <span style={{ fontSize: 16 }}><LockOutlined /> Đổi mật khẩu</span>,
            children: (
                <div style={{ marginTop: 24, maxWidth: 600, margin: '24px auto' }}>
                    <Card title="Bảo mật tài khoản" variant='borderless' style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <Form 
                            form={formPassword} 
                            layout="vertical" 
                            onFinish={onChangePassword}
                            size="large"
                        >
                            <Form.Item 
                                name="currentPassword" 
                                label="Mật khẩu hiện tại"
                                rules={[{ required: true, message: 'Vui lòng nhập mật khẩu hiện tại' }]}
                            >
                                <Input.Password placeholder="Nhập mật khẩu cũ" />
                            </Form.Item>

                            <Form.Item 
                                name="newPassword" 
                                label="Mật khẩu mới"
                                rules={[
                                    { required: true, message: 'Vui lòng nhập mật khẩu mới' },
                                    { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự' }
                                ]}
                            >
                                <Input.Password placeholder="Nhập mật khẩu mới" />
                            </Form.Item>

                            <Form.Item 
                                name="confirmPassword" 
                                label="Xác nhận mật khẩu mới"
                                dependencies={['newPassword']}
                                rules={[
                                    { required: true, message: 'Vui lòng xác nhận lại mật khẩu' },
                                    ({ getFieldValue }) => ({
                                        validator(_, value) {
                                            if (!value || getFieldValue('newPassword') === value) {
                                                return Promise.resolve();
                                            }
                                            return Promise.reject(new Error('Mật khẩu xác nhận không khớp!'));
                                        },
                                    }),
                                ]}
                            >
                                <Input.Password placeholder="Nhập lại mật khẩu mới" />
                            </Form.Item>

                            <Divider />

                            <Form.Item style={{ marginBottom: 0 }}>
                                <Button 
                                    type="primary" 
                                    htmlType="submit" 
                                    icon={<LockOutlined />} 
                                    loading={loading}
                                    block
                                    danger // Màu đỏ để cảnh báo hành động nhạy cảm
                                >
                                    Đổi mật khẩu
                                </Button>
                            </Form.Item>
                        </Form>
                    </Card>
                </div>
            )
        }
    ];

    return (
        <Card
            style={{ borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', minHeight: 600 }}
            styles={{ body: { padding: '32px' } }}
        >
            <Title level={2} style={{ marginTop: 0 }}>Hồ sơ người dùng</Title>
            <Text type="secondary" style={{ fontSize: 16, display: 'block', marginBottom: 32 }}>
                Quản lý thông tin cá nhân và bảo mật tài khoản của bạn.
            </Text>

            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={items}
                type="card"
                size="large"
            />
        </Card>
    );
};

export default ProfileMain;