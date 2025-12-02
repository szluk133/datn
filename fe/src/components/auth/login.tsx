'use client'
import { Button, Col, Divider, Form, Input, notification, Row } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { authenticate } from '@/utils/actions';
import { useRouter } from 'next/navigation';
import ModalReactive from './modal.reactive';
import { useState } from 'react';
import ModalChangePassword from './modal.change.password';

const Login = () => {
    const router = useRouter();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [userEmail, setUserEmail] = useState("");

    const [changePassword, setChangePassword] = useState(false);

    const onFinish = async (values: any) => {
        const { username, password } = values;
        setUserEmail("");
        //trigger sign-in
        const res = await authenticate(username, password);

        // Check for the 'success' flag and the user object
        if (res?.success && res.user) {
            // DEBUG: Log the entire user object to the console
            console.log("User object from session:", res.user);

            // Redirect based on user role
            const userRole = res.user.role; // Access role from the returned user object
            if (userRole === 'admin') {
                router.push('/dashboard');
            } else if (userRole === 'client') {
                router.push('/model');
            } else {
                // Handle cases where role is undefined or not 'admin'/'client'
                notification.error({
                    message: "Login Successful, but Role is Missing",
                    description: "Your user role is not defined. Redirecting to the homepage.",
                });
                router.push('/');
            }
        } else {
            // Handle login errors
            if (res?.code === 2) {
                setIsModalOpen(true);
                setUserEmail(username);
                return;
            }
            notification.error({
                message: "Login Failed",
                description: res?.error || "An unexpected error occurred."
            });
        }
    };

    return (
        <>
            <Row justify={"center"} style={{ marginTop: "30px" }}>
                <Col xs={24} md={16} lg={8}>
                    <fieldset style={{
                        padding: "15px",
                        margin: "5px",
                        border: "1px solid #ccc",
                        borderRadius: "5px"
                    }}>
                        <legend>Đăng Nhập</legend>
                        <Form
                            name="basic"
                            onFinish={onFinish}
                            autoComplete="off"
                            layout='vertical'
                        >
                            <Form.Item
                                label="Email"
                                name="username"
                                rules={[
                                    {
                                        required: true,
                                        message: 'Please input your email!',
                                    },
                                ]}
                            >
                                <Input />
                            </Form.Item>

                            <Form.Item
                                label="Password"
                                name="password"
                                rules={[
                                    {
                                        required: true,
                                        message: 'Please input your password!',
                                    },
                                ]}
                            >
                                <Input.Password />
                            </Form.Item>



                            <Form.Item
                            >
                                <div style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center"
                                }}>
                                    <Button type="primary" htmlType="submit">
                                        Login
                                    </Button>
                                    <Button type='link' onClick={() => setChangePassword(true)}>Quên mật khẩu ?</Button>
                                </div>
                            </Form.Item>
                        </Form>
                        <Link href={"/"}><ArrowLeftOutlined /> Quay lại trang chủ</Link>
                        <Divider />
                        <div style={{ textAlign: "center" }}>
                            Chưa có tài khoản? <Link href={"/auth/register"}>Đăng ký tại đây</Link>
                        </div>
                    </fieldset>
                </Col>
            </Row>
            <ModalReactive
                isModalOpen={isModalOpen}
                setIsModalOpen={setIsModalOpen}
                userEmail={userEmail}
            />
            <ModalChangePassword
                isModalOpen={changePassword}
                setIsModalOpen={setChangePassword}
            />
        </>
    )
}

export default Login;

