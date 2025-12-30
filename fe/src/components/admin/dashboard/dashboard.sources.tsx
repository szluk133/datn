'use client'

import React, { useEffect, useState } from 'react';
import { Card, Spin } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';
import { ISourceSentiment } from '@/types/next-auth';

const DashboardSources = () => {
    const { data: session } = useSession();
    const [data, setData] = useState<ISourceSentiment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!session) return;
            try {
                const res = await sendRequest<ISourceSentiment[]>({
                    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/analytics/sources/sentiment`,
                    method: "GET",
                    session: session,
                });
                if (res.data) setData(res.data);
            } catch (error) {
                console.error("Error fetching sources", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [session]);

    if (loading) return <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>;

    const chartData = data.map(item => ({
        source: item.source,
        Positive: item.breakdown.positive,
        Negative: item.breakdown.negative,
        Neutral: item.breakdown.neutral,
        confidence: (item.avgConfidence * 100).toFixed(1) + '%' 
    }));

    return (
        <Card title="Phân tích cảm xúc theo nguồn tin" variant="borderless" style={{ marginTop: 20 }}>
            <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer>
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="source" />
                        <YAxis />
                        <Tooltip 
                            labelFormatter={(label, payload) => {
                                if (payload && payload.length > 0) {
                                    const conf = payload[0].payload.confidence;
                                    return `${label} (Tin cậy: ${conf})`;
                                }
                                return label;
                            }}
                        />
                        <Legend />
                        <Bar dataKey="Positive" stackId="a" fill="#52c41a" name="Tích cực" />
                        <Bar dataKey="Neutral" stackId="a" fill="#faad14" name="Trung tính" />
                        <Bar dataKey="Negative" stackId="a" fill="#f5222d" name="Tiêu cực" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
};

export default DashboardSources;