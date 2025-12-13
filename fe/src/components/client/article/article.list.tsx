'use client';

import React, { useContext, useState, useEffect } from 'react';
import { Form, Input, Button, DatePicker, InputNumber, Card, notification, Select, Spin } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import dayjs from 'dayjs';
import { sendRequest } from '@/utils/api';
import { ISearchHistory } from '@/types/next-auth';
import { ClientContext } from '@/components/client/layout/client.context'; 

const { RangePicker } = DatePicker;

interface ICrawlResponse {
    status: string;
    search_id: string;
    stream_url: string;
    meta: {
        total_available_now: number;
        page: number;
        page_size: number;
    };
}

interface IWebsite {
    _id: string;
    name: string;
    displayName: string;
}

const ArticleList = () => {
    const [form] = Form.useForm();
    const router = useRouter();
    const { data: session, status } = useSession();
    
    const clientContext = useContext(ClientContext);
    const setSearchHistory = clientContext?.setSearchHistory;

    const [loading, setLoading] = useState(false);
    const [dateRangeValues, setDateRangeValues] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
    const [availableWebsites, setAvailableWebsites] = useState<IWebsite[]>([]);
    const [loadingWebsites, setLoadingWebsites] = useState(true);

    useEffect(() => {
        const fetchWebsites = async () => {
            if (session?.user?._id) {
                try {
                    setLoadingWebsites(true);
                    const res = await sendRequest<IWebsite[]>({
                        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/article/websites`,
                        method: 'GET',
                        session: session,
                    });
                    
                    if (res?.data && Array.isArray(res.data)) {
                        setAvailableWebsites(res.data);
                    } else {
                        console.error("Không tải được danh sách website", res);
                    }
                } catch (error) {
                    console.error("Lỗi tải websites:", error);
                } finally {
                    setLoadingWebsites(false);
                }
            }
        };
        
        if (status === 'authenticated' && session?.user?._id && availableWebsites.length === 0) {
            fetchWebsites();
        }
    }, [status, session, availableWebsites.length]);

    const onFinish = async (values: any) => {
        if (status === 'loading') return;
        
        if (status === 'unauthenticated' || !session?.user?._id) {
            notification.error({ message: 'Vui lòng đăng nhập', description: 'Bạn cần đăng nhập để sử dụng tính năng này.' });
            return;
        }

        setLoading(true);

        const { keyword_search, keyword_content, max_articles, websites } = values;
        
        const searchPayload = {
            keyword_search,
            keyword_content,
            max_articles: max_articles || 10,
            start_date: dateRangeValues?.[0] ? dayjs(dateRangeValues[0]).format('DD/MM/YYYY') : undefined,
            end_date: dateRangeValues?.[1] ? dayjs(dateRangeValues[1]).format('DD/MM/YYYY') : undefined,
            user_id: session.user._id,
            websites: websites || [],
        };

        try {
            const res = await sendRequest<ICrawlResponse>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/article/crawl`,
                method: 'POST',
                body: searchPayload,
                session: session,
            });

            const responseData = res?.data;
            const searchId = responseData?.search_id;

            if (searchId) {
                notification.success({
                    title: 'Đã kích hoạt tìm kiếm',
                    description: `Hệ thống đang xử lý. ID: ${searchId}`,
                    duration: 2,
                });
                
                if (setSearchHistory) {
                    try {
                        const currentTs = new Date().getTime();
                        const historyRes = await sendRequest<ISearchHistory[]>({
                            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/article/history/${session.user._id}?_t=${currentTs}`,
                            method: 'GET',
                            session: session
                        });

                        if (historyRes?.data && Array.isArray(historyRes.data)) {
                            setSearchHistory(historyRes.data);
                        }
                    } catch (historyError) {
                        console.error("Lỗi cập nhật lịch sử:", historyError);
                    }
                }
                router.push(`/model/article?id=${searchId}`);

            } else {
                notification.error({
                    message: 'Không thể bắt đầu tìm kiếm',
                    description: res.message || 'Vui lòng thử lại sau.',
                });
            }
        } catch (error: any) {
            notification.error({
                message: 'Lỗi kết nối',
                description: error.message || 'Không thể kết nối đến máy chủ.',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card title="Tìm kiếm bài báo (Event-Driven)" variant="borderless">
            <Form form={form} onFinish={onFinish} layout="vertical">
                <Form.Item 
                    label="Từ khóa tiêu đề" 
                    name="keyword_search" 
                    rules={[{ required: true, message: 'Vui lòng nhập từ khóa!' }]}
                >
                    <Input placeholder="Ví dụ: công nghệ, bất động sản..." allowClear />
                </Form.Item>
                
                <Form.Item label="Từ khóa nội dung" name="keyword_content">
                    <Input placeholder="Ví dụ: chi tiết, phân tích..." allowClear />
                </Form.Item>

                <Form.Item label="Nguồn website" name="websites">
                    <Select
                        mode="multiple"
                        allowClear
                        style={{ width: '100%' }}
                        placeholder="Chọn website (mặc định: tất cả)"
                        loading={loadingWebsites}
                        notFoundContent={loadingWebsites ? <Spin size="small" /> : null}
                        options={availableWebsites.map(ws => ({ label: ws.displayName, value: ws.name }))}
                    />
                </Form.Item>

                <Form.Item label="Khoảng thời gian">
                    <RangePicker
                        style={{ width: '100%' }}
                        format="DD/MM/YYYY"
                        value={dateRangeValues}
                        onChange={(dates) => setDateRangeValues(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
                    />
                </Form.Item>

                <Form.Item label="Số lượng bài báo tối đa" name="max_articles" initialValue={10}>
                    <InputNumber min={1} max={100} style={{ width: '100%' }} />
                </Form.Item>
                
                <Form.Item>
                    <Button
                        type="primary"
                        htmlType="submit"
                        icon={<SearchOutlined />}
                        loading={loading}
                        block
                    >
                        {loading ? 'Đang khởi tạo...' : 'Tìm kiếm ngay'}
                    </Button>
                </Form.Item>
            </Form>
        </Card>
    );
};

export default ArticleList;