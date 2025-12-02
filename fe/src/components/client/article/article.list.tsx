'use client';

import React, { useContext, useState, useEffect } from 'react';
import { Form, Input, Button, DatePicker, InputNumber, Card, notification, Select, Spin } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';
import { IArticle, ISearchHistory } from '@/types/next-auth';
import { ClientContext } from '@/components/client/layout/client.context'; 
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface ISearchApiResponse {
    newHistoryItem: ISearchHistory;
    results: {
        data: IArticle[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
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
    const [loading, setLoading] = useState(false);

    const [dateRangeValues, setDateRangeValues] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

    const [availableWebsites, setAvailableWebsites] = useState<IWebsite[]>([]);
    const [loadingWebsites, setLoadingWebsites] = useState(true);

    if (!clientContext) {
        throw new Error("ArticleList must be used within a ClientContextProvider");
    }

    const { setSearchHistory } = clientContext;

    useEffect(() => {
        const fetchWebsites = async () => {
            if (session) {
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
                        notification.error({
                            message: 'Lỗi tải danh sách website',
                            description: res.message || 'Không thể lấy dữ liệu website.',
                        });
                    }
                } catch (error: any) {
                    notification.error({
                        message: 'Lỗi máy chủ',
                        description: error.message || 'Không thể kết nối để lấy danh sách website.',
                    });
                } finally {
                    setLoadingWebsites(false);
                }
            }
        };
        
        if (status === 'authenticated' && session?.user?._id && availableWebsites.length === 0) {
            fetchWebsites();
        }
    }, [status, session?.user?._id, availableWebsites.length, session]);


    const onFinish = async (values: any) => {
        if (status === 'loading') {
            notification.info({ message: 'Đang tải phiên đăng nhập', description: 'Vui lòng đợi một lát rồi thử lại.' });
            return;
        }
        if (status === 'unauthenticated' || !session?.user?._id) {
            notification.error({ message: 'Lỗi xác thực', description: 'Vui lòng đăng nhập để thực hiện tìm kiếm.' });
            return;
        }

        setLoading(true);

        const { keyword_search, keyword_content, max_articles, websites } = values;
        const dateRange = dateRangeValues;

        const searchPayload = {
            keyword_search,
            keyword_content,
            max_articles: max_articles || 10,
            start_date: dateRange?.[0] ? dayjs(dateRange[0]).format('DD/MM/YYYY') : undefined,
            end_date: dateRange?.[1] ? dayjs(dateRange[1]).format('DD/MM/YYYY') : undefined,
            user_id: session.user._id,
            websites: websites || [],
        };


        try {
            const res = await sendRequest<ISearchApiResponse>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/article/search`,
                method: 'POST',
                body: searchPayload,
                session: session,
            });

            const responseData = res?.data;


            if (responseData?.newHistoryItem?.search_id) {
                notification.success({
                    message: 'Tìm kiếm thành công!',
                    description: `Đã tìm thấy ${responseData.results?.total || 0} bài báo.`,
                });
                
                setSearchHistory(prevHistory => {
                    const prev = Array.isArray(prevHistory) ? prevHistory : [];
                    const updatedHistory = [responseData.newHistoryItem, ...prev];
                                        
                    return updatedHistory.slice(0, 10);
                });
                
                router.push(`/model/article?id=${responseData.newHistoryItem.search_id}`);

            } else {
                notification.error({
                    message: 'Tìm kiếm thất bại',
                    description: res.message || 'Không tìm thấy kết quả hoặc có lỗi xảy ra.',
                });
            }
        } catch (error: any) {
            notification.error({
                message: 'Lỗi máy chủ',
                description: error.message || 'Không thể kết nối đến máy chủ.',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card title="Tìm kiếm bài báo" variant="borderless">
            <Form form={form} onFinish={onFinish} layout="vertical">
                <Form.Item label="Từ khóa tiêu đề" name="keyword_search" rules={[{ required: true, message: 'Vui lòng nhập từ khóa tiêu đề!' }]}>
                    <Input placeholder="Ví dụ: thuế, luật, kinh tế..." />
                </Form.Item>
                <Form.Item label="Từ khóa nội dung" name="keyword_content">
                    <Input placeholder="Ví dụ: tăng, giảm, mới..." />
                </Form.Item>

                <Form.Item label="Nguồn website" name="websites">
                    <Select
                        mode="multiple"
                        allowClear
                        style={{ width: '100%' }}
                        placeholder="Chọn website (để trống = tất cả)"
                        loading={loadingWebsites}
                        notFoundContent={loadingWebsites ? <Spin size="small" /> : null}
                    >
                        {availableWebsites.map(website => (
                            <Option key={website._id} value={website.name}>
                                {website.displayName}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>

                <Form.Item label="Khoảng thời gian">
                    <RangePicker
                        style={{ width: '100%' }}
                        value={dateRangeValues}
                        onChange={(dates) => {
                            setDateRangeValues(dates as [dayjs.Dayjs, dayjs.Dayjs] | null);
                        }}
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
                        loading={loading || status === 'loading'}
                    >
                        {status === 'loading' ? 'Đang tải...' : 'Tìm kiếm'}
                    </Button>
                </Form.Item>
            </Form>
        </Card>
    );
};

export default ArticleList;
