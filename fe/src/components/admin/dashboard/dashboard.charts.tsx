'use client'

import React, { useEffect, useState } from 'react';
import { Card, Spin, DatePicker, Space, Button } from 'antd';
import { 
    ComposedChart, 
    Line, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    Legend, 
    ResponsiveContainer 
} from 'recharts';
import { useSession } from 'next-auth/react';
import { ReloadOutlined } from '@ant-design/icons';
import { sendRequest } from '@/utils/api';
import { ISentimentTrend } from '@/types/next-auth';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

interface ISentimentTrendDisplay extends ISentimentTrend {
    displayDate: string;
    positive: number;
    neutral: number;
    negative: number;
    confidencePct: string;
}

const DashboardCharts = () => {
    const { data: session } = useSession();
    const [data, setData] = useState<ISentimentTrendDisplay[]>([]);
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
                    positive: item.breakdown.positive,
                    neutral: item.breakdown.neutral,
                    negative: item.breakdown.negative,
                    confidencePct: (item.avgConfidence * 100).toFixed(1)
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
                title="Xu hướng Phân loại & Độ tin cậy AI" 
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
                            <ComposedChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="displayDate" />
                                
                                <YAxis yAxisId="left" label={{ value: 'Số lượng bài viết', angle: -90, position: 'insideLeft' }} />
                                
                                <YAxis 
                                    yAxisId="right" 
                                    orientation="right" 
                                    unit="%"
                                    domain={[0, 100]}
                                    label={{ value: 'Độ tin cậy', angle: 90, position: 'insideRight' }} 
                                />
                                
                                <Tooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                                />
                                <Legend />

                                <Bar yAxisId="left" dataKey="positive" stackId="a" name="Tích cực" fill="#52c41a" barSize={20} />
                                <Bar yAxisId="left" dataKey="neutral" stackId="a" name="Trung tính" fill="#faad14" barSize={20} />
                                <Bar yAxisId="left" dataKey="negative" stackId="a" name="Tiêu cực" fill="#f5222d" barSize={20} />

                                <Line 
                                    yAxisId="right" 
                                    type="monotone" 
                                    dataKey="confidencePct" 
                                    stroke="#722ed1" 
                                    name="Độ tin cậy AI (%)" 
                                    strokeWidth={3}
                                    dot={{ r: 4 }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default DashboardCharts;