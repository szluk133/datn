'use client'

import React, { useEffect, useState } from 'react';
import { Card, Spin } from 'antd';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';
import { ICategoryDistribution } from '@/types/next-auth';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const DashboardCategories = () => {
    const { data: session } = useSession();
    const [data, setData] = useState<ICategoryDistribution[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!session) return;
            try {
                const res = await sendRequest<ICategoryDistribution[]>({
                    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/analytics/categories/distribution`,
                    method: "GET",
                    session: session,
                });
                if (res.data) setData(res.data);
            } catch (error) {
                console.error("Error fetching categories", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [session]);

    if (loading) return <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>;

    return (
        <Card title="Phân bố danh mục bài viết" variant="borderless" style={{ marginTop: 20, height: '100%' }}>
            <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer>
                    <PieChart>
                        <Pie
                            data={data as any}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) =>
                                `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                            }
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="count"
                            nameKey="category"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
};

export default DashboardCategories;