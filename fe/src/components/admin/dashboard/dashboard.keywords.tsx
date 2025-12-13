'use client'

import React, { useEffect, useState } from 'react';
import { Card, Tag, Spin, Typography, Space, Flex } from 'antd';
import { FireOutlined, SearchOutlined } from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';
import { IKeywordTrend } from '@/types/next-auth';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';

dayjs.extend(relativeTime);
dayjs.locale('vi');

const { Text } = Typography;

const DashboardKeywords = () => {
    const { data: session } = useSession();
    const [keywords, setKeywords] = useState<IKeywordTrend[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchKeywords = async () => {
            if (!session) return;
            try {
                const res = await sendRequest<{ hotSearchKeywords: IKeywordTrend[] }>({
                    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/analytics/trend/keywords?days=7`,
                    method: "GET",
                    session: session,
                });
                if (res.data?.hotSearchKeywords) {
                    setKeywords(res.data.hotSearchKeywords);
                }
            } catch (error) {
                console.error("Error fetching keywords", error);
            } finally {
                setLoading(false);
            }
        };
        fetchKeywords();
    }, [session]);

    return (
        <Card 
            title={<span><FireOutlined style={{ color: '#ff4d4f', marginRight: 8 }} /> Từ khóa Hot (7 ngày)</span>} 
            variant="borderless"
            style={{ height: '100%', marginTop: 20 }}
            styles={{ body: { padding: '0 12px' } }}
        >
            {loading ? (
                <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
            ) : (
                <Space orientation="vertical" style={{ width: '100%' }}>
                    {keywords.map((item, index) => (
                        <Card
                            key={index}
                            size="small"
                            styles={{ body: { padding: '12px 8px' } }}
                        >
                            <Flex justify="space-between" align="center">
                                
                                {/* LEFT PART */}
                                <Flex align="center" gap={10}>
                                    <Tag 
                                        color={index < 3 ? "volcano" : "default"} 
                                        style={{ marginRight: 0, minWidth: 28, textAlign: 'center' }}
                                    >
                                        #{index + 1}
                                    </Tag>

                                    <Space orientation="vertical" size={0}>
                                        <Text strong>{item.keyword}</Text>
                                        <span style={{ fontSize: 12, color: '#8c8c8c' }}>
                                            <SearchOutlined style={{ marginRight: 4 }} />
                                            {dayjs(item.lastSearched).fromNow()}
                                        </span>
                                    </Space>
                                </Flex>

                                {/* RIGHT PART */}
                                <Tag color="blue" style={{ margin: 0 }}>
                                    {item.count} lượt
                                </Tag>
                            </Flex>
                        </Card>
                    ))}
                </Space>
            )}
        </Card>
    );
};

export default DashboardKeywords;
