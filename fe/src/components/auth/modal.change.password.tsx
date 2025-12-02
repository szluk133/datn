'use client'

import { useHasMounted } from "@/utils/customHook";
import { Button, Form, Input, Modal, notification, Steps } from "antd";
import { SmileOutlined, SolutionOutlined, UserOutlined } from '@ant-design/icons';
import { useState } from "react";
import { sendRequest } from "@/utils/api";

// Định nghĩa kiểu dữ liệu cho data trả về từ API retry-password
interface IRetryPasswordData {
    email: string;
}

const ModalChangePassword = (props: any) => {
    const { isModalOpen, setIsModalOpen } = props;
    const [current, setCurrent] = useState(0);
    const [form] = Form.useForm();
    const [userEmail, setUserEmail] = useState("");

    const hasMounted = useHasMounted();

    if (!hasMounted) return <></>;

    const onFinishStep0 = async (values: any) => {
        const { email } = values;
        // FIX: Sử dụng kiểu generic là kiểu của 'data', không phải toàn bộ 'IBackendRes'
        const res = await sendRequest<IRetryPasswordData>({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/retry-password`,
            method: "POST",
            body: {
                email
            }
        })

        if (res?.data) {
            // FIX: Truy cập trực tiếp vào res.data.email, TypeScript đã hiểu kiểu dữ liệu
            setUserEmail(res.data.email)
            setCurrent(1);
        } else {
            notification.error({
                message: "Có lỗi xảy ra",
                description: res?.message
            })
        }

    }

    const onFinishStep1 = async (values: any) => {
        const { code, password, confirmPassword } = values;
        if (password !== confirmPassword) {
            notification.error({
                message: "Dữ liệu không hợp lệ",
                description: "Mật khẩu và xác nhận mật khẩu không khớp."
            })
            return;
        }
        // Giả sử API này không trả về data quan trọng, dùng 'any' là chấp nhận được
        const res = await sendRequest<any>({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/change-password`,
            method: "POST",
            body: {
                code, password, confirmPassword, email: userEmail
            }
        })

        if (res.statusCode === 201) { // Kiểm tra statusCode để chắc chắn thành công
            setCurrent(2);
        } else {
            notification.error({
                message: "Có lỗi xảy ra",
                description: res?.message
            })
        }

    }

    const restModal = () => {
        setIsModalOpen(false);
        setCurrent(0);
        setUserEmail("");
        form.resetFields()
    }
    return (
        <>
            <Modal
                title="Quên mật khẩu"
                open={isModalOpen}
                onOk={restModal}
                onCancel={restModal}
                maskClosable={false}
                footer={null}
            >
                <Steps
                    current={current}
                    items={[
                        {
                            title: 'Email',
                            icon: <UserOutlined />,
                        },
                        {
                            title: 'Xác thực',
                            icon: <SolutionOutlined />,
                        },
                        {
                            title: 'Hoàn thành',
                            icon: <SmileOutlined />,
                        },
                    ]}
                />
                {current === 0 &&
                    <>
                        <div style={{ margin: "20px 0" }}>
                            <p>Để thực hiện thay đổi mật khẩu, vui lòng nhập email tài khoản của bạn.</p>
                        </div>
                        <Form
                            name="change-password"
                            onFinish={onFinishStep0}
                            autoComplete="off"
                            layout='vertical'
                            form={form}
                        >
                            <Form.Item
                                label="Email"
                                name="email"
                                rules={[{ required: true, message: 'Vui lòng nhập email!' }]}
                            >

                                <Input />
                            </Form.Item>
                            <Form.Item
                            >
                                <Button type="primary" htmlType="submit">
                                    Gửi
                                </Button>
                            </Form.Item>
                        </Form>
                    </>
                }

                {current === 1 &&
                    <>
                        <div style={{ margin: "20px 0" }}>
                            <p>Một mã xác thực đã được gửi đến email của bạn. Vui lòng nhập mã và mật khẩu mới.</p>
                        </div>

                        <Form
                            name="change-pass-2"
                            onFinish={onFinishStep1}
                            autoComplete="off"
                            layout='vertical'
                        >
                            <Form.Item
                                label="Mã xác thực"
                                name="code"
                                rules={[
                                    {
                                        required: true,
                                        message: 'Vui lòng nhập mã xác thực!',
                                    },
                                ]}
                            >
                                <Input />
                            </Form.Item>

                            <Form.Item
                                label="Mật khẩu mới"
                                name="password"
                                rules={[
                                    {
                                        required: true,
                                        message: 'Vui lòng nhập mật khẩu mới!',
                                    },
                                ]}
                            >
                                <Input.Password />
                            </Form.Item>

                            <Form.Item
                                label="Xác nhận mật khẩu"
                                name="confirmPassword"
                                rules={[
                                    {
                                        required: true,
                                        message: 'Vui lòng xác nhận mật khẩu!',
                                    },
                                ]}
                            >
                                <Input.Password />
                            </Form.Item>

                            <Form.Item
                            >
                                <Button type="primary" htmlType="submit">
                                    Xác nhận
                                </Button>
                            </Form.Item>
                        </Form>
                    </>
                }

                {current === 2 &&
                    <div style={{ margin: "20px 0", textAlign: 'center' }}>
                        <p>Tài khoản của bạn đã được thay đổi mật khẩu thành công.</p>
                        <Button type="primary" onClick={restModal}>
                            Đăng nhập ngay
                        </Button>
                    </div>
                }
            </Modal>
        </>
    )
}

export default ModalChangePassword;
