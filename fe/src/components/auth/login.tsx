'use client'
import React, { useState } from 'react';
import { Button, Form, Input, notification, Typography, theme, Row, Col, Space, Divider } from 'antd';
import { 
    LockOutlined, 
    MailOutlined, 
    ArrowLeftOutlined, 
    RocketTwoTone,
    CheckCircleFilled
} from '@ant-design/icons';
import Link from 'next/link';
import { authenticate } from '@/utils/actions';
import { useRouter } from 'next/navigation';
import ModalReactive from './modal.reactive';
import ModalChangePassword from './modal.change.password';

const { Title, Text, Paragraph } = Typography;

const Login = () => {
    const router = useRouter();
    const { token } = theme.useToken();
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
            if (userRole === 'admin') router.push('/dashboard');
            else if (userRole === 'client') router.push('/model');
            else router.push('/');
            
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
            height: "100vh", 
            display: "flex", 
            justifyContent: "center", 
            alignItems: "center",
            background: 'linear-gradient(135deg, #f0f2f5 0%, #e6f7ff 100%)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Background Decorations */}
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
                {/* --- LEFT SIDE: INFO & DECORATION --- */}
                <div style={{ 
                    flex: '1', 
                    background: `linear-gradient(135deg, ${token.colorPrimary} 0%, #003a8c 100%)`,
                    padding: '60px 40px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    color: '#fff',
                    position: 'relative',
                    clipPath: 'polygon(0 0, 100% 0, 90% 100%, 0% 100%)' // Tạo đường chéo nghệ thuật
                }} className="login-left-panel">
                    
                    <div>
                        <Space align="center" size={12} style={{ marginBottom: 40 }}>
                            <div style={{ background: '#fff', padding: 8, borderRadius: 12, display: 'flex' }}>
                                <RocketTwoTone twoToneColor={token.colorPrimary} style={{ fontSize: 24 }} />
                            </div>
                            <Text strong style={{ fontSize: 22, color: '#fff', letterSpacing: 1 }}>NEWSCRAWLER</Text>
                        </Space>

                        <Title level={1} style={{ color: '#fff', margin: '0 0 24px 0', fontSize: 36 }}>
                            Công cụ thu thập, phân tích và hỏi đáp tin tức thông minh
                        </Title>
                        <Paragraph style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16 }}>
                            Nền tảng AI hỗ trợ thu thập và phân tích tin tức các trang báo hàng đầu.
                        </Paragraph>
                    </div>

                    <Space orientation="vertical" size={16} style={{ marginBottom: 40 }}>
                        <Space>
                            <CheckCircleFilled style={{ color: '#52c41a' }} />
                            <Text style={{ color: '#fff' }}>Dữ liệu cập nhật Real-time</Text>
                        </Space>
                        <Space>
                            <CheckCircleFilled style={{ color: '#52c41a' }} />
                            <Text style={{ color: '#fff' }}>Phân tích cảm xúc bằng AI</Text>
                        </Space>
                        <Space>
                            <CheckCircleFilled style={{ color: '#52c41a' }} />
                            <Text style={{ color: '#fff' }}>Tìm kiếm nâng cao</Text>
                        </Space>
                    </Space>

                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                        © 2024 LVC NewsCrawler System
                    </Text>

                    {/* Decorative Circle inside Card */}
                    <div style={{ 
                        position: 'absolute', bottom: -50, right: -50, 
                        width: 200, height: 200, borderRadius: '50%', 
                        background: 'rgba(255,255,255,0.1)' 
                    }} />
                </div>

                {/* --- RIGHT SIDE: FORM --- */}
                <div style={{ 
                    flex: '1', 
                    padding: '60px 50px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    background: '#fff' // Đảm bảo nền trắng
                }} className="login-right-panel">
                    <div style={{ maxWidth: 360, width: '100%', margin: '0 auto' }}>
                        <div style={{ marginBottom: 32 }}>
                            <Title level={2} style={{ marginBottom: 8 }}>Xin chào,</Title>
                            <Text type="secondary">Vui lòng đăng nhập để tiếp tục</Text>
                        </div>

                        <Form
                            name="login_form"
                            onFinish={onFinish}
                            autoComplete="off"
                            layout='vertical'
                            size="large"
                        >
                            <Form.Item
                                label="Email"
                                name="username"
                                rules={[
                                    { required: true, message: 'Vui lòng nhập email!' },
                                    { type: 'email', message: 'Email không hợp lệ!' }
                                ]}
                            >
                                <Input prefix={<MailOutlined className="site-form-item-icon" />} placeholder="Email của bạn" />
                            </Form.Item>

                            <Form.Item
                                label="Mật khẩu"
                                name="password"
                                rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
                            >
                                <Input.Password prefix={<LockOutlined className="site-form-item-icon" />} placeholder="Mật khẩu" />
                            </Form.Item>

                            <Form.Item>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: 'center' }}>
                                    <Link href="/auth/register" style={{ fontWeight: 500 }}>Đăng ký tài khoản</Link>
                                    <Button type='link' onClick={() => setChangePassword(true)} style={{ padding: 0 }}>
                                        Quên mật khẩu?
                                    </Button>
                                </div>
                            </Form.Item>

                            <Form.Item style={{ marginBottom: 24 }}>
                                <Button 
                                    type="primary" 
                                    htmlType="submit" 
                                    loading={loading} 
                                    block
                                    shape="round"
                                    style={{ height: 48, fontSize: 16, fontWeight: 600 }}
                                >
                                    Đăng nhập
                                </Button>
                            </Form.Item>
                        </Form>

                        <Divider style={{ fontSize: 13, color: '#999' }}>Hoặc</Divider>

                        <div style={{ textAlign: "center" }}>
                            <Link href={"/"} style={{ display: "inline-flex", alignItems: "center", color: '#666' }}>
                                <ArrowLeftOutlined style={{ marginRight: 6 }} /> Quay lại trang chủ
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <ModalReactive isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen} userEmail={userEmail} />
            <ModalChangePassword isModalOpen={changePassword} setIsModalOpen={setChangePassword} />

            <style jsx global>{`
                .bg-shape {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(80px);
                    opacity: 0.6;
                    animation: float 20s infinite ease-in-out;
                }
                .shape-1 {
                    width: 500px; height: 500px;
                    background: ${token.colorPrimaryBg};
                    top: -10%; left: -10%;
                }
                .shape-2 {
                    width: 400px; height: 400px;
                    background: #d9e7ff;
                    bottom: -10%; right: -5%;
                    animation-delay: -10s;
                }
                @keyframes float {
                    0% { transform: translate(0, 0) rotate(0deg); }
                    50% { transform: translate(30px, 30px) rotate(10deg); }
                    100% { transform: translate(0, 0) rotate(0deg); }
                }
                @media (max-width: 768px) {
                    .login-left-panel { display: none !important; }
                    .login-right-panel { padding: 40px 20px !important; }
                }
            `}</style>
        </div>
    )
}

export default Login;