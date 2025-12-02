'use client'

import React, { useEffect, useState } from 'react';
import { Table, Tag, Card, Button, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';
import { ISystemLog } from '@/types/next-auth';
import dayjs from 'dayjs';

const SystemLogs = () => {
    const { data: session } = useSession();
    const [logs, setLogs] = useState<ISystemLog[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchLogs = async () => {
        if (!session) return;
        setLoading(true);
        try {
            const res = await sendRequest<ISystemLog[]>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/admin/logs?limit=20`,
                method: "GET",
                session: session,
            });
            if (res.data) {
                setLogs(res.data);
            }
        } catch (error) {
            console.error("Error fetching logs", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [session]);

    const columns: ColumnsType<ISystemLog> = [
        {
            title: 'Thời gian',
            dataIndex: 'timestamp',
            key: 'timestamp',
            width: 180,
            render: (text) => <span style={{ fontSize: '13px', color: '#595959' }}>{dayjs(text).format('DD/MM/YYYY HH:mm:ss')}</span>,
        },
        {
            title: 'Mức độ',
            dataIndex: 'level',
            key: 'level',
            width: 100,
            render: (level) => {
                let color = 'blue';
                if (level === 'ERROR') color = 'red';
                if (level === 'WARN') color = 'orange';
                return <Tag color={color}>{level}</Tag>;
            },
        },
        {
            title: 'Hành động',
            dataIndex: 'action',
            key: 'action',
            render: (text) => <span style={{ fontWeight: 600 }}>{text}</span>,
        },
        {
            title: 'Chi tiết',
            dataIndex: 'details',
            key: 'details',
            render: (details) => (
                <Tooltip title={JSON.stringify(details, null, 2)} styles={{ root: { maxWidth: 400 } }}>
                    <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <InfoCircleOutlined style={{ marginRight: 5, color: '#1890ff' }} />
                        Xem chi tiết
                    </span>
                </Tooltip>
            ),
        },
        {
            title: 'User ID',
            dataIndex: 'user_id',
            key: 'user_id',
            width: 150,
            ellipsis: true,
            render: (text) => <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{text}</span>
        },
    ];

    return (
        <Card 
            title="Nhật ký hoạt động hệ thống"
            extra={<Button type="text" icon={<ReloadOutlined />} onClick={fetchLogs} loading={loading} />}
            variant="borderless"
            >
            <Table 
                columns={columns} 
                dataSource={logs} 
                rowKey="_id" 
                pagination={{ pageSize: 5, size: 'small' }} 
                loading={loading}
                size="middle"
                scroll={{ x: 800 }}
            />
        </Card>
    );
};

export default SystemLogs;