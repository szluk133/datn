'use client'

import { useHasMounted } from "@/utils/customHook";
import { Button, Form, Input, Modal, notification, Steps } from "antd";
import { SmileOutlined, SolutionOutlined, UserOutlined } from '@ant-design/icons';
import { useEffect, useState } from "react";
import { sendRequest } from "@/utils/api";

// Định nghĩa kiểu dữ liệu cho data trả về từ API retry-active
interface IRetryActiveData {
    _id: string;
}

const ModalReactive = (props: any) => {
    const { isModalOpen, setIsModalOpen, userEmail } = props;
    const [current, setCurrent] = useState(0);
    const [form] = Form.useForm();
    const [userId, setUserId] = useState("");

    const hasMounted = useHasMounted();

    useEffect(() => {
        if (userEmail) {
            form.setFieldValue("email", userEmail)
        }
    }, [userEmail, form]);

    if (!hasMounted) return <></>;

    const onFinishStep0 = async (values: any) => {
        const { email } = values;
        // FIX: Sử dụng kiểu generic cụ thể cho sendRequest
        const res = await sendRequest<IRetryActiveData>({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/retry-active`,
            method: "POST",
            body: {
                email
            }
        })

        if (res?.data) {
            // FIX: Truy cập trực tiếp vào res.data._id một cách an toàn
            setUserId(res.data._id)
            setCurrent(1);
        } else {
            notification.error({
                message: "Có lỗi xảy ra",
                description: res?.message
            })
        }
    }

    const onFinishStep1 = async (values: any) => {
        const { code } = values;
        const res = await sendRequest<any>({ // Giữ 'any' nếu API này không trả về data cụ thể
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/check-code`,
            method: "POST",
            body: {
                code, _id: userId
            }
        })

        if (res.statusCode === 201) { // Kiểm tra statusCode để đảm bảo thành công
            setCurrent(2);
        } else {
            notification.error({
                message: "Có lỗi xảy ra",
                description: res?.message
            })
        }
    }

    const handleClose = () => {
        setIsModalOpen(false);
        setCurrent(0);
        form.resetFields();
    }

    return (
        <>
            <Modal
                title="Kích hoạt tài khoản"
                open={isModalOpen}
                onOk={handleClose}
                onCancel={handleClose}
                maskClosable={false}
                footer={null}
            >
                <Steps
                    current={current}
                    items={[
                        {
                            title: 'Gửi lại mã',
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
                            <p>Tài khoản của bạn chưa được kích hoạt. Nhấn nút bên dưới để gửi lại mã kích hoạt.</p>
                        </div>
                        <Form
                            name="verify"
                            onFinish={onFinishStep0}
                            autoComplete="off"
                            layout='vertical'
                            form={form}
                        >
                            <Form.Item
                                label="Email"
                                name="email"
                            >
                                <Input disabled />
                            </Form.Item>
                            <Form.Item>
                                <Button type="primary" htmlType="submit">
                                    Gửi lại mã
                                </Button>
                            </Form.Item>
                        </Form>
                    </>
                }

                {current === 1 &&
                    <>
                        <div style={{ margin: "20px 0" }}>
                            <p>Một mã xác thực đã được gửi đến email của bạn. Vui lòng nhập mã vào ô bên dưới.</p>
                        </div>
                        <Form
                            name="verify2"
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
                            <Form.Item>
                                <Button type="primary" htmlType="submit">
                                    Kích hoạt
                                </Button>
                            </Form.Item>
                        </Form>
                    </>
                }

                {current === 2 &&
                    <div style={{ margin: "20px 0", textAlign: 'center' }}>
                        <p>Tài khoản của bạn đã được kích hoạt thành công. Vui lòng đăng nhập lại.</p>
                        <Button type="primary" onClick={handleClose}>
                            Đăng nhập
                        </Button>
                    </div>
                }
            </Modal>
        </>
    )
}

export default ModalReactive;
