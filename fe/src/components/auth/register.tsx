'use client'
import React, { useState } from 'react';
import { Button, Card, Divider, Form, Input, notification, Typography, theme } from 'antd';
import { ArrowLeftOutlined, UserOutlined, MailOutlined, LockOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { sendRequest } from '@/utils/api';
import { useRouter } from 'next/navigation';

const { Title, Text } = Typography;

interface IRegisterData {
    _id: string;
}

const Register = () => {
    const router = useRouter();
    const { token } = theme.useToken();
    const [loading, setLoading] = useState(false);

    const onFinish = async (values: any) => {
        const { email, password, name } = values;
        setLoading(true);
        
        const res = await sendRequest<IRegisterData>({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/register`,
            method: "POST",
            body: { email, password, name }
        });
        
        setLoading(false);

        if (res?.data) {
            notification.success({
                title: "Đăng ký thành công",
                description: "Vui lòng kiểm tra email để kích hoạt tài khoản."
            });
            router.push(`/verify?id=${res.data._id}`);
        } else {
            notification.error({
                title: "Lỗi đăng ký",
                description: res?.message || "Có lỗi xảy ra khi đăng ký."
            });
        }
    };

    return (
        <div style={{ 
            minHeight: "100vh", 
            display: "flex", 
            justifyContent: "center", 
            alignItems: "center",
            background: "linear-gradient(135deg, #f0f2f5 0%, #d9e7ff 100%)",
            padding: "20px"
        }}>
            <Card
                style={{ 
                    width: "100%", 
                    maxWidth: 460, 
                    boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                    borderRadius: "12px"
                }}
                variant="borderless"
            >
                <div style={{ textAlign: "center", marginBottom: "30px" }}>
                    <Title level={3} style={{ color: token.colorPrimary, marginBottom: 5 }}>Đăng Ký Tài Khoản</Title>
                    <Text type="secondary">Tạo tài khoản mới để trải nghiệm dịch vụ</Text>
                </div>

                <Form
                    name="register_form"
                    onFinish={onFinish}
                    autoComplete="off"
                    layout='vertical'
                    size="large"
                >
                    <Form.Item
                        label="Tên hiển thị"
                        name="name"
                        rules={[{ required: true, message: 'Vui lòng nhập tên hiển thị!' }]}
                    >
                        <Input 
                            prefix={<UserOutlined style={{ color: "rgba(0,0,0,.25)" }} />} 
                            placeholder="Ví dụ: Nguyễn Văn A" 
                        />
                    </Form.Item>

                    <Form.Item
                        label="Email"
                        name="email"
                        rules={[
                            { required: true, message: 'Vui lòng nhập email!' },
                            { type: 'email', message: 'Email không đúng định dạng!' }
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
                        rules={[
                            { required: true, message: 'Vui lòng nhập mật khẩu!' },
                            { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự!' }
                        ]}
                    >
                        <Input.Password 
                            prefix={<LockOutlined style={{ color: "rgba(0,0,0,.25)" }} />} 
                            placeholder="Tạo mật khẩu an toàn"
                        />
                    </Form.Item>

                    <Form.Item style={{ marginTop: 20, marginBottom: 12 }}>
                        <Button 
                            type="primary" 
                            htmlType="submit" 
                            block 
                            loading={loading}
                            style={{ fontWeight: 600, height: 45 }}
                        >
                            Đăng ký ngay
                        </Button>
                    </Form.Item>
                </Form>

                <Divider style={{ fontSize: '13px', color: '#888', margin: '24px 0' }}>Hoặc</Divider>

                <div style={{ textAlign: "center", marginBottom: "16px" }}>
                    <Text type="secondary">Đã có tài khoản? </Text>
                    <Link href={"/auth/login"} style={{ fontWeight: 600 }}>Đăng nhập</Link>
                </div>

                <div style={{ textAlign: "center" }}>
                    <Link href={"/"} style={{ display: "inline-flex", alignItems: "center", color: token.colorTextSecondary, fontSize: 13 }}>
                        <ArrowLeftOutlined style={{ marginRight: 4 }} /> Quay lại trang chủ
                    </Link>
                </div>
            </Card>
        </div>
    )
}

export default Register;