'use client'

import React, { useState } from 'react';
import { Card, Select, Table, Tag, Button, notification, Space } from 'antd';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ITopic } from '@/types/next-auth';
import { SyncOutlined } from '@ant-design/icons';
import { sendRequest } from '@/utils/api';
import { useSession } from 'next-auth/react';

const { Option } = Select;

interface IWebsite {
    _id: string;
    name: string;
    displayName: string;
}

interface IProps {
    websites: IWebsite[];
    initialTopics: ITopic[];
}

const TopicList = (props: IProps) => {
    const { websites, initialTopics } = props;
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { data: session } = useSession();

    const [loadingInit, setLoadingInit] = useState(false);

    const selectedWebsite = searchParams.get('website');

    const handleWebsiteChange = (val: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (val) {
            params.set('website', val);
        } else {
            params.delete('website');
        }
        router.replace(`${pathname}?${params.toString()}`);
    };

    const handleInitTopics = async () => {
        if (!selectedWebsite) {
            notification.warning({ message: "Vui lòng chọn website trước khi cập nhật!" });
            return;
        }

        setLoadingInit(true);
        try {
            const res = await sendRequest<any>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/admin/topics/init?website=${selectedWebsite}`,
                method: "POST",
                session: session,
            });

            if (res.data) {
                notification.success({ message: "Đã gửi yêu cầu cập nhật chủ đề thành công!" });
                router.refresh();
            } else {
                notification.error({ message: "Có lỗi xảy ra khi cập nhật chủ đề." });
            }
        } catch (error) {
            notification.error({ message: "Lỗi kết nối đến server." });
            console.error(error);
        } finally {
            setLoadingInit(false);
        }
    };

    const columns = [
        {
            title: 'Chủ đề',
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <span style={{ fontWeight: 500 }}>{text}</span>,
        },
        {
            title: 'Website',
            dataIndex: 'website',
            key: 'website',
            width: 200,
            render: (text: string) => <Tag color="blue">{text}</Tag>,
        },
    ];

    return (
        <Card title="Quản lý Chủ đề" variant="borderless">
            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 500 }}>Chọn Website nguồn:</span>
                <Select 
                    value={selectedWebsite || undefined} 
                    style={{ width: 250 }} 
                    onChange={handleWebsiteChange}
                    placeholder="Chọn website..."
                    showSearch
                    optionFilterProp="children"
                    allowClear
                >
                    {websites.map(site => (
                        <Option key={site._id} value={site.name}>{site.displayName}</Option>
                    ))}
                </Select>

                <Button 
                    type="primary" 
                    icon={<SyncOutlined />} 
                    onClick={handleInitTopics}
                    loading={loadingInit}
                    disabled={!selectedWebsite}
                >
                    Cập nhật chủ đề
                </Button>
            </div>

            <Table 
                columns={columns}
                dataSource={initialTopics}
                rowKey={(record: any) => record._id || record.id || Math.random().toString()}
                pagination={{ pageSize: 10 }}
                locale={{ emptyText: selectedWebsite ? "Không có chủ đề nào" : "Vui lòng chọn website" }}
            />
        </Card>
    );
};

export default TopicList;