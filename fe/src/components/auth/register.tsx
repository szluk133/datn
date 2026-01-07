'use client'
import React, { useState } from 'react';
import { Button, Form, Input, notification, Typography, theme, Space, Divider } from 'antd';
import { ArrowLeftOutlined, UserOutlined, MailOutlined, LockOutlined, RocketTwoTone } from '@ant-design/icons';
import Link from 'next/link';
import { sendRequest } from '@/utils/api';
import { useRouter } from 'next/navigation';

const { Title, Text, Paragraph } = Typography;

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
            notification.success({ title: "Đăng ký thành công", description: "Vui lòng kiểm tra email để kích hoạt tài khoản." });
            router.push(`/verify?id=${res.data._id}`);
        } else {
            notification.error({ title: "Lỗi đăng ký", description: res?.message || "Có lỗi xảy ra khi đăng ký." });
        }
    };

    return (
        <div style={{ 
            height: "100vh", 
            display: "flex", 
            justifyContent: "center", 
            alignItems: "center",
            background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <div className="bg-shape shape-1" />
            <div className="bg-shape shape-2" />

            <div style={{ 
                width: '1000px', 
                maxWidth: '90%', 
                height: '600px', 
                background: '#fff', 
                borderRadius: '24px', 
                boxShadow: '0 20px 60px -10px rgba(0,0,0,0.1)',
                display: 'flex',
                overflow: 'hidden',
                zIndex: 1
            }}>
                {/* --- LEFT SIDE --- */}
                <div style={{ 
                    flex: '1', 
                    background: `linear-gradient(135deg, #001529 0%, ${token.colorPrimary} 100%)`, // Màu đậm hơn cho trang đăng ký
                    padding: '60px 40px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    color: '#fff',
                    position: 'relative',
                    clipPath: 'polygon(0 0, 100% 0, 90% 100%, 0% 100%)'
                }} className="register-left-panel">
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ background: '#fff', width: 60, height: 60, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                            <RocketTwoTone twoToneColor={token.colorPrimary} style={{ fontSize: 32 }} />
                        </div>
                        <Title level={1} style={{ color: '#fff', margin: '0 0 16px 0' }}>Tham gia ngay</Title>
                        <Paragraph style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16 }}>
                            Tạo tài khoản để khám phá sức mạnh dữ liệu và AI.
                        </Paragraph>
                    </div>
                    {/* Decorative elements */}
                    <div style={{ position: 'absolute', top: -30, left: -30, width: 150, height: 150, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)' }} />
                    <div style={{ position: 'absolute', bottom: 40, right: 40, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                </div>

                {/* --- RIGHT SIDE: FORM --- */}
                <div style={{ 
                    flex: '1', 
                    padding: '40px 50px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    background: '#fff'
                }} className="register-right-panel">
                    <div style={{ maxWidth: 360, width: '100%', margin: '0 auto' }}>
                        <div style={{ marginBottom: 24 }}>
                            <Title level={2} style={{ marginBottom: 8 }}>Đăng ký</Title>
                            <Text type="secondary">Nhập thông tin của bạn để tạo tài khoản</Text>
                        </div>

                        <Form name="register_form" onFinish={onFinish} autoComplete="off" layout='vertical' size="large">
                            <Form.Item name="name" rules={[{ required: true, message: 'Vui lòng nhập tên!' }]}>
                                <Input prefix={<UserOutlined />} placeholder="Họ và tên" />
                            </Form.Item>

                            <Form.Item name="email" rules={[{ required: true, message: 'Vui lòng nhập email!' }, { type: 'email' }]}>
                                <Input prefix={<MailOutlined />} placeholder="Email" />
                            </Form.Item>

                            <Form.Item name="password" rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }, { min: 6 }]}>
                                <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu" />
                            </Form.Item>

                            <Form.Item style={{ marginTop: 24, marginBottom: 16 }}>
                                <Button type="primary" htmlType="submit" block loading={loading} shape="round" style={{ height: 48, fontSize: 16, fontWeight: 600 }}>
                                    Đăng ký tài khoản
                                </Button>
                            </Form.Item>
                        </Form>

                        <div style={{ textAlign: 'center' }}>
                            <Text type="secondary">Đã có tài khoản? </Text>
                            <Link href="/auth/login" style={{ fontWeight: 500 }}>Đăng nhập ngay</Link>
                        </div>
                        
                        <Divider plain style={{ margin: '16px 0', fontSize: 12 }}>hoặc</Divider>

                        <div style={{ textAlign: "center" }}>
                            <Link href={"/"} style={{ display: "inline-flex", alignItems: "center", color: '#666' }}>
                                <ArrowLeftOutlined style={{ marginRight: 6 }} /> Về trang chủ
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                .bg-shape { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.6; }
                .shape-1 { width: 400px; height: 400px; background: #91caff; top: -5%; left: 10%; }
                .shape-2 { width: 300px; height: 300px; background: #ffccc7; bottom: -5%; right: 10%; }
                @media (max-width: 768px) {
                    .register-left-panel { display: none !important; }
                    .register-right-panel { padding: 40px 20px !important; }
                }
            `}</style>
        </div>
    )
}

export default Register;