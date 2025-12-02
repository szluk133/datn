'use client'

import React, { useEffect, useState } from 'react';
import { Card, Spin, DatePicker, Space, Button } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useSession } from 'next-auth/react';
import { ReloadOutlined } from '@ant-design/icons';
import { sendRequest } from '@/utils/api';
import { ISentimentTrend } from '@/types/next-auth';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const DashboardCharts = () => {
    const { data: session } = useSession();
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([
        dayjs().subtract(30, 'day'), 
        dayjs()
    ]);

    const fetchData = async () => {
        if (!session) return;
        setLoading(true);
        
        let queryParams = 'days=30';
        
        if (dateRange[0] && dateRange[1]) {
            const from = dateRange[0].format('YYYY-MM-DD');
            const to = dateRange[1].format('YYYY-MM-DD');
            queryParams = `fromDate=${from}&toDate=${to}`;
        }

        try {
            const res = await sendRequest<ISentimentTrend[]>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/analytics/trend/sentiment-over-time?${queryParams}`,
                method: "GET",
                session: session,
            });
            if (res.data) {
                const formattedData = res.data.map(item => ({
                    ...item,
                    displayDate: dayjs(item.date).format('DD/MM'),
                }));
                setData(formattedData);
            }
        } catch (error) {
            console.error("Error fetching charts", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [session]);

    const onDateChange = (dates: any) => {
        setDateRange(dates);
    };

    return (
        <div style={{ marginTop: 20 }}>
            <Card 
                title="Xu hướng cảm xúc & Số lượng bài viết" 
                variant="borderless"
                extra={
                    <Space>
                        <RangePicker 
                            value={dateRange} 
                            onChange={onDateChange} 
                            format="DD/MM/YYYY"
                            style={{ width: 250 }}
                        />
                        <Button 
                            icon={<ReloadOutlined />} 
                            onClick={fetchData} 
                            loading={loading}
                        >
                            Lọc
                        </Button>
                    </Space>
                }
            >
                {loading ? (
                    <div style={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Spin />
                    </div>
                ) : (
                    <div style={{ width: '100%', height: 350 }}>
                        <ResponsiveContainer>
                            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="displayDate" />
                                <YAxis yAxisId="left" label={{ value: 'Điểm cảm xúc', angle: -90, position: 'insideLeft' }} domain={[-1, 1]} />
                                <YAxis yAxisId="right" orientation="right" label={{ value: 'Số bài viết', angle: 90, position: 'insideRight' }} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                                />
                                <Legend />
                                <Line 
                                    yAxisId="left" 
                                    type="monotone" 
                                    dataKey="avgSentiment" 
                                    stroke="#8884d8" 
                                    name="Cảm xúc TB" 
                                    strokeWidth={2}
                                    activeDot={{ r: 6 }} 
                                />
                                <Line 
                                    yAxisId="right" 
                                    type="monotone" 
                                    dataKey="totalArticles" 
                                    stroke="#82ca9d" 
                                    name="Tổng bài viết" 
                                    strokeWidth={2}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default DashboardCharts;