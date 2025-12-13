'use client'
import React, { useState } from 'react';
import { Button, Card, Divider, Form, Input, notification, Typography, theme } from 'antd';
import { LockOutlined, MailOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { authenticate } from '@/utils/actions';
import { useRouter } from 'next/navigation';
import ModalReactive from './modal.reactive';
import ModalChangePassword from './modal.change.password';

const { Title, Text } = Typography;

const Login = () => {
    const router = useRouter();
    const { token } = theme.useToken(); // Lấy màu chủ đạo từ theme config
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [userEmail, setUserEmail] = useState("");
    const [changePassword, setChangePassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const onFinish = async (values: any) => {
        const { username, password } = values;
        setUserEmail("");
        setLoading(true);

        const res = await authenticate(username, password);
        setLoading(false);

        if (res?.success && res.user) {
            const userRole = res.user.role; 

            if (userRole === 'admin') {
                router.push('/dashboard');
            } else if (userRole === 'client') {
                router.push('/model');
            } else {
                router.push('/');
            }
            notification.success({
                title: "Đăng nhập thành công",
                description: "Chào mừng bạn quay trở lại!"
            });
        } else {
            if (res?.code === 2) {
                setIsModalOpen(true);
                setUserEmail(username);
                return;
            }
            
            notification.error({
                title: "Đăng nhập thất bại",
                description: res?.error || "Có lỗi xảy ra, vui lòng thử lại."
            });
        }
    };

    return (
        <div style={{ 
            minHeight: "100vh", 
            display: "flex", 
            justifyContent: "center", 
            alignItems: "center",
            background: "linear-gradient(135deg, #f0f2f5 0%, #d9e7ff 100%)", // Gradient nền xanh nhẹ
            padding: "20px"
        }}>
            <Card
                style={{ 
                    width: "100%", 
                    maxWidth: 420, 
                    boxShadow: "0 8px 24px rgba(0,0,0,0.08)", // Đổ bóng mềm
                    borderRadius: "12px"
                }}
                variant="borderless"
            >
                <div style={{ textAlign: "center", marginBottom: "30px" }}>
                    <Title level={3} style={{ color: token.colorPrimary, marginBottom: 5 }}>Đăng Nhập</Title>
                    <Text type="secondary">Chào mừng bạn quay trở lại hệ thống</Text>
                </div>

                <Form
                    name="login_form"
                    onFinish={onFinish}
                    autoComplete="off"
                    layout='vertical'
                    size="large" // Input lớn dễ thao tác
                >
                    <Form.Item
                        label="Email"
                        name="username"
                        rules={[
                            { required: true, message: 'Vui lòng nhập email!' },
                            { type: 'email', message: 'Email không hợp lệ!' }
                        ]}
                    >
                        <Input 
                            prefix={<MailOutlined style={{ color: "rgba(0,0,0,.25)" }} />} 
                            placeholder="example@email.com" 
                        />
                    </Form.Item>

                    <Form.Item
                        label="Mật khẩu"
                        name="password"
                        rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
                    >
                        <Input.Password 
                            prefix={<LockOutlined style={{ color: "rgba(0,0,0,.25)" }} />} 
                            placeholder="Nhập mật khẩu"
                        />
                    </Form.Item>

                    <Form.Item>
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <Button 
                                type='link' 
                                onClick={() => setChangePassword(true)}
                                style={{ padding: 0, height: 'auto' }}
                            >
                                Quên mật khẩu?
                            </Button>
                        </div>
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 12 }}>
                        <Button 
                            type="primary" 
                            htmlType="submit" 
                            loading={loading} 
                            block
                            style={{ fontWeight: 600, height: 45 }}
                        >
                            Đăng nhập
                        </Button>
                    </Form.Item>
                </Form>

                <Divider style={{ fontSize: '13px', color: '#888', margin: '24px 0' }}>Hoặc</Divider>

                <div style={{ textAlign: "center", marginBottom: "16px" }}>
                    <Text type="secondary">Chưa có tài khoản? </Text>
                    <Link href={"/auth/register"} style={{ fontWeight: 600 }}>Đăng ký ngay</Link>
                </div>

                <div style={{ textAlign: "center" }}>
                    <Link href={"/"} style={{ display: "inline-flex", alignItems: "center", color: token.colorTextSecondary, fontSize: 13 }}>
                        <ArrowLeftOutlined style={{ marginRight: 4 }} /> Quay lại trang chủ
                    </Link>
                </div>
            </Card>

            <ModalReactive
                isModalOpen={isModalOpen}
                setIsModalOpen={setIsModalOpen}
                userEmail={userEmail}
            />
            <ModalChangePassword
                isModalOpen={changePassword}
                setIsModalOpen={setChangePassword}
            />
        </div>
    )
}

export default Login;