'use client'
import React from 'react';
import { Button, Col, Divider, Form, Input, notification, Row } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { sendRequest } from '@/utils/api';
import { useRouter } from 'next/navigation';

// Định nghĩa kiểu dữ liệu cho 'data' trả về từ API register
interface IRegisterData {
    _id: string;
}

const Register = () => {
    const router = useRouter()

    const onFinish = async (values: any) => {
        const { email, password, name } = values;
        // FIX: Sử dụng kiểu generic cụ thể cho sendRequest
        const res = await sendRequest<IRegisterData>({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/register`,
            method: "POST",
            body: {
                email, password, name
            }
        })
        
        if (res?.data) {
            // FIX: Truy cập trực tiếp vào res.data._id một cách an toàn
            notification.success({
                message: "Đăng ký thành công",
                description: "Vui lòng kiểm tra email để kích hoạt tài khoản."
            });
            router.push(`/verify?id=${res.data._id}`);
        } else {
            notification.error({
                message: "Lỗi đăng ký",
                description: res?.message
            })
        }
    };

    return (
        <Row justify={"center"} style={{ marginTop: "30px" }}>
            <Col xs={24} md={16} lg={8}>
                <fieldset style={{
                    padding: "15px",
                    margin: "5px",
                    border: "1px solid #ccc",
                    borderRadius: "5px"
                }}>
                    <legend>Đăng Ký Tài Khoản</legend>
                    <Form
                        name="basic"
                        onFinish={onFinish}
                        autoComplete="off"
                        layout='vertical'
                    >
                        <Form.Item
                            label="Email"
                            name="email"
                            rules={[
                                { required: true, message: 'Vui lòng nhập email!' },
                                { type: 'email', message: 'Email không đúng định dạng!' }
                            ]}
                        >
                            <Input />
                        </Form.Item>

                        <Form.Item
                            label="Mật khẩu"
                            name="password"
                            rules={[
                                { required: true, message: 'Vui lòng nhập mật khẩu!' },
                            ]}
                        >
                            <Input.Password />
                        </Form.Item>

                        <Form.Item
                            label="Tên hiển thị"
                            name="name"
                            rules={[{ required: true, message: 'Vui lòng nhập tên!' }]}
                        >
                            <Input />
                        </Form.Item>

                        <Form.Item>
                            <Button type="primary" htmlType="submit">
                                Đăng ký
                            </Button>
                        </Form.Item>
                    </Form>
                    <Link href={"/"}><ArrowLeftOutlined /> Quay lại trang chủ</Link>
                    <Divider />
                    <div style={{ textAlign: "center" }}>
                        Đã có tài khoản? <Link href={"/auth/login"}>Đăng nhập</Link>
                    </div>

                </fieldset>
            </Col>
        </Row>
    )
}

export default Register;
