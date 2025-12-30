'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
    Tabs, Card, Form, Input, Button, DatePicker, Row, Col, 
    Upload, Typography, message, Flex, theme, notification, Divider, Statistic,
    Table, Tag, Space, Popconfirm, Tooltip, Badge,
    Dropdown, Steps, Alert, Progress, Modal, List
} from 'antd';
import { 
    PlusOutlined, 
    UploadOutlined, 
    FileExcelOutlined, 
    SaveOutlined,
    CloudUploadOutlined,
    FileTextOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    UnorderedListOutlined,
    ReloadOutlined,
    RobotOutlined,
    DownloadOutlined,
    SearchOutlined,
    HistoryOutlined,
    EyeOutlined,
    InfoCircleOutlined,
    BulbOutlined,
    LinkOutlined,
    CalendarOutlined,
    QuestionCircleOutlined,
    FilterFilled,
    GlobalOutlined
} from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';
import { useChatbot } from '@/components/client/chatbot/chatbot.context';
import type { UploadProps, TableProps } from 'antd';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Dragger } = Upload;

interface IMyArticle {
    _id: string;
    article_id: string;
    title: string;
    content: string;
    website: string;
    publish_date: string;
    ai_sentiment_label?: string;
    ai_sentiment_score?: number;
    ai_summary?: string[];
    update_id?: string;
    createdAt?: string;
}

interface IBatchHistory {
    _id: string;
    update_id: string;
    user_id: string;
    created_at: string;
    updated_at: string;
}

interface IMyArticleListResponse {
    data: IMyArticle[];
    meta: {
        total: number;
        page: number;
        limit: number;
        total_pages: number;
    }
}

interface IHistoryResponse {
    data: IBatchHistory[];
    meta: {
        total: number;
        page: number;
        limit: number;
        total_pages: number;
    }
}

interface IEnrichResponse {
    status: string;
    message: string;
    processed_count: number;
}

const MyArticleMain = () => {
    const { token } = theme.useToken();
    const { data: session } = useSession();
    const [form] = Form.useForm();
    
    const { setPageContext } = useChatbot();
    
    const [activeTab, setActiveTab] = useState('manual');
    const [loading, setLoading] = useState(false);
    
    const [fileList, setFileList] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);
    const [importStats, setImportStats] = useState<{ success: number; failed: number; errors: any[] } | null>(null);

    const [articles, setArticles] = useState<IMyArticle[]>([]);
    const [meta, setMeta] = useState({ current: 1, pageSize: 10, total: 0 });
    const [loadingList, setLoadingList] = useState(false);
    const [loadingEnrich, setLoadingEnrich] = useState(false);
    const [loadingExport, setLoadingExport] = useState(false);
    const [filterUpdateId, setFilterUpdateId] = useState('');
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

    const [batchHistory, setBatchHistory] = useState<IBatchHistory[]>([]);
    const [metaHistory, setMetaHistory] = useState({ current: 1, pageSize: 10, total: 0 });
    const [loadingHistory, setLoadingHistory] = useState(false);

    const [isInstructionModalOpen, setIsInstructionModalOpen] = useState(false);

    useEffect(() => {
        if (filterUpdateId) {
            setPageContext({
                current_page: 'my_page',
                update_id: filterUpdateId
            });
        } else {
            setPageContext({
                current_page: 'my_page'
            });
        }

        return () => setPageContext(null);
    }, [filterUpdateId, setPageContext]);

    const fetchArticles = useCallback(async (page = 1, limit = 10, updateId = '') => {
        if (!session?.user?._id) return;
        setLoadingList(true);
        try {
            const query = new URLSearchParams({
                user_id: session.user._id,
                page: page.toString(),
                limit: limit.toString(),
            });
            if (updateId) query.append('update_id', updateId);

            const res = await sendRequest<IMyArticleListResponse>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/my-articles?${query.toString()}`,
                method: 'GET',
                session: session,
            });

            if (res?.data) {
                setArticles(res.data.data || []);
                if (res.data.meta) {
                    setMeta({
                        current: res.data.meta.page,
                        pageSize: res.data.meta.limit,
                        total: res.data.meta.total
                    });
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingList(false);
        }
    }, [session]);

    const fetchHistory = useCallback(async (page = 1, limit = 10) => {
        if (!session?.user?._id) return;
        setLoadingHistory(true);
        try {
            const query = new URLSearchParams({
                user_id: session.user._id,
                page: page.toString(),
                limit: limit.toString(),
            });
            const res = await sendRequest<IHistoryResponse>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/my-articles/history?${query.toString()}`,
                method: 'GET',
                session: session,
            });
            if (res?.data) {
                setBatchHistory(res.data.data || []);
                if (res.data.meta) {
                    setMetaHistory({
                        current: res.data.meta.page,
                        pageSize: res.data.meta.limit,
                        total: res.data.meta.total
                    });
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingHistory(false);
        }
    }, [session]);

    useEffect(() => {
        if (!session?.user?._id) return;
        if (activeTab === 'list') fetchArticles(meta.current, meta.pageSize, filterUpdateId);
        else if (activeTab === 'history') fetchHistory(metaHistory.current, metaHistory.pageSize);
    }, [activeTab, fetchArticles, fetchHistory, session]);

    const handleViewBatch = (updateId: string) => {
        setFilterUpdateId(updateId);
        setActiveTab('list');
        fetchArticles(1, 10, updateId);
        notification.info({
            title: 'Đã áp dụng bộ lọc',
            description: `Đang xem danh sách bài viết thuộc mã lô: ${updateId}`,
            icon: <FilterFilled style={{ color: token.colorPrimary }} />,
        });
    };

    const handleEnrich = async (targetUpdateId?: string) => {
        const idToUse = targetUpdateId || filterUpdateId;

        if (!idToUse) {
            notification.warning({ title: 'Thiếu thông tin', description: 'Vui lòng chọn Mã lô (Update ID) để phân tích.' });
            return;
        }
        setLoadingEnrich(true);
        try {
            const res = await sendRequest<IEnrichResponse>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/my-articles/enrich`,
                method: 'POST',
                body: { user_id: session?.user?._id, update_id: idToUse },
                session: session,
            });
            if (res?.data?.status === 'ok') {
                notification.success({ title: 'Kích hoạt thành công', description: res.data.message });
                if (activeTab === 'list' && filterUpdateId === idToUse) {
                    setTimeout(() => fetchArticles(1, meta.pageSize, idToUse), 2000);
                }
            } else {
                notification.error({ title: 'Lỗi', description: res?.message });
            }
        } catch (error) {
            notification.error({ title: 'Lỗi hệ thống', description: 'Không thể kết nối.' });
        } finally {
            setLoadingEnrich(false);
        }
    };

    const handleExport = async (type: 'batch' | 'list', targetUpdateId?: string) => {
        if (!session?.user?._id) return;
        
        const idToUse = targetUpdateId || filterUpdateId;

        if (type === 'batch' && !idToUse) return notification.warning({ title: 'Cảnh báo', description: 'Không tìm thấy Mã lô để xuất file.' });
        if (type === 'list' && selectedRowKeys.length === 0) return notification.warning({ title: 'Cảnh báo', description: 'Chọn ít nhất một bài viết.' });

        setLoadingExport(true);
        try {
            const query = new URLSearchParams({ user_id: session.user._id, type: type });
            if (type === 'batch') query.append('id', idToUse);
            if (type === 'list') query.append('ids', selectedRowKeys.join(','));

            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/my-articles/export?${query.toString()}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${session.access_token}` },
            });
            if (!response.ok) throw new Error('Export failed');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Export_${type}_${dayjs().format('DDMMYYYY')}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            notification.success({ title: 'Tải xuống thành công' });
        } catch (error) {
            notification.error({ title: 'Lỗi', description: 'Không thể xuất file.' });
        } finally {
            setLoadingExport(false);
        }
    };

    const onFinishManual = async (values: any) => {
        if (!session?.user?._id) return;
        setLoading(true);
        try {
            const payload = {
                user_id: session.user._id,
                title: values.title || "",
                content: values.content,
                website: values.website || "",
                publish_date: values.publish_date ? dayjs(values.publish_date).toISOString() : new Date().toISOString()
            };
            const res = await sendRequest<any>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/my-articles`,
                method: 'POST',
                body: payload,
                session: session,
            });
            if (res?.data) {
                notification.success({ title: 'Thành công', description: 'Tạo bài viết mới thành công!' });
                form.resetFields();
                if (res.data.update_id) handleViewBatch(res.data.update_id);
            } else {
                notification.error({ title: 'Thất bại', description: res.message });
            }
        } catch (error) {
            notification.error({ title: 'Lỗi', description: 'Lỗi kết nối.' });
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async () => {
        if (fileList.length === 0 || !session?.user?._id) return;
        const formData = new FormData();
        formData.append('file', fileList[0] as any);
        formData.append('user_id', session.user._id);
        setUploading(true);
        setImportStats(null);
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/my-articles/import`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.access_token}` },
                body: formData,
            });
            const data = await response.json();
            if (response.ok) {
                setFileList([]);
                setImportStats(data.stats);
                notification.success({ title: 'Import hoàn tất' });
                const updateId = data.update_id || data.data?.update_id;
                if (updateId) {
                    // Delay 1 chút để người dùng xem kết quả import trước khi chuyển tab
                    setTimeout(() => handleViewBatch(updateId), 3000);
                }
            } else {
                notification.error({ title: 'Import thất bại', description: data.message });
            }
        } catch (error) {
            notification.error({ title: 'Lỗi', description: 'Không thể upload file.' });
        } finally {
            setUploading(false);
        }
    };

    // --- COLUMNS ---
    const listColumns: TableProps<IMyArticle>['columns'] = [
        {
            title: 'Bài viết',
            dataIndex: 'title',
            key: 'title',
            width: 300,
            render: (text, record) => (
                <Space orientation="vertical" size={2}>
                    <Text strong style={{ fontSize: 15 }}>{text || 'Không có tiêu đề'}</Text>
                    {record.website && <Space size={4}><GlobalOutlined style={{ fontSize: 12, color: token.colorTextSecondary }} /><Text type="secondary" style={{ fontSize: 12 }}>{record.website}</Text></Space>}
                </Space>
            ),
        },
        {
            title: 'Phân tích AI',
            key: 'sentiment',
            width: 200,
            render: (_, record) => {
                const label = record.ai_sentiment_label;
                const score = record.ai_sentiment_score;
                if (!label) return <Tag icon={<RobotOutlined />}>Chưa phân tích</Tag>;
                
                let color = 'default';
                let icon = <InfoCircleOutlined />;
                if (label === 'Positive') { color = 'success'; icon = <CheckCircleOutlined />; }
                else if (label === 'Negative') { color = 'error'; icon = <CloseCircleOutlined />; }
                else if (label === 'Neutral') { color = 'warning'; icon = <InfoCircleOutlined />; }

                return (
                    <Space orientation="vertical" size={4}>
                        <Tag color={color} icon={icon} style={{ margin: 0 }}>{label}</Tag>
                        {score !== undefined && <Progress percent={Math.round(score * 100)} size="small" steps={5} strokeColor={token[color === 'success' ? 'colorSuccess' : color === 'error' ? 'colorError' : 'colorWarning']} />}
                    </Space>
                );
            }
        },
        {
            title: 'Tóm tắt nội dung',
            key: 'summary',
            render: (_, record) => {
                if (!record.ai_summary || record.ai_summary.length === 0) return <Text type="secondary" italic>Chưa có tóm tắt</Text>;
                return (
                    <div style={{ background: '#f5f5f5', padding: '8px 12px', borderRadius: 8 }}>
                        <ul style={{ paddingLeft: 16, margin: 0, fontSize: 13 }}>
                            {record.ai_summary.slice(0, 2).map((s, idx) => <li key={idx}>{s}</li>)}
                            {record.ai_summary.length > 2 && <li>...</li>}
                        </ul>
                    </div>
                );
            }
        },
        {
            title: 'Ngày xuất bản',
            dataIndex: 'publish_date',
            key: 'publish_date',
            width: 140,
            render: (date) => date ? <Tag icon={<CalendarOutlined />}>{dayjs(date).format('DD/MM/YYYY')}</Tag> : '-',
        },
    ];

    const historyColumns: TableProps<IBatchHistory>['columns'] = [
        {
            title: 'Thông tin đợt cập nhật',
            key: 'info',
            render: (_, record) => (
                <Space orientation="vertical" size={2}>
                    <Text strong><Tag color="geekblue">#{record.update_id}</Tag></Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>ID: {record._id}</Text>
                </Space>
            )
        },
        {
            title: 'Thời gian thực hiện',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (date) => (
                <Space>
                    <HistoryOutlined style={{ color: token.colorTextSecondary }} />
                    <Text>{dayjs(date).format('HH:mm - DD/MM/YYYY')}</Text>
                </Space>
            )
        },
        {
            title: 'Hành động',
            key: 'action',
            width: 320,
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title="Xem danh sách bài viết">
                        <Button 
                            icon={<EyeOutlined />} 
                            onClick={() => handleViewBatch(record.update_id)}
                        />
                    </Tooltip>
                    
                    <Tooltip title="Chạy phân tích AI cho toàn bộ lô này">
                        <Popconfirm
                            title="Kích hoạt phân tích AI?"
                            description="Hệ thống sẽ chạy phân tích tóm tắt và cảm xúc cho toàn bộ lô bài viết này."
                            onConfirm={() => handleEnrich(record.update_id)}
                            okText="Đồng ý" cancelText="Hủy"
                        >
                            <Button 
                                type="primary" 
                                ghost
                                icon={<RobotOutlined />} 
                                loading={loadingEnrich}
                            >
                                AI Enrich
                            </Button>
                        </Popconfirm>
                    </Tooltip>

                    <Tooltip title="Xuất file Excel cho lô này">
                        <Button 
                            icon={<DownloadOutlined />} 
                            onClick={() => handleExport('batch', record.update_id)}
                            loading={loadingExport}
                        >
                            Excel
                        </Button>
                    </Tooltip>
                </Space>
            )
        }
    ];

    // --- TAB CONTENTS ---
    const manualTab = (
        <Row gutter={24} style={{ marginTop: 24 }}>
            <Col xs={24} lg={16}>
                <Card title="Thông tin bài viết" variant="borderless" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <Form form={form} layout="vertical" onFinish={onFinishManual} size="large">
                        <Form.Item name="title" label="Tiêu đề bài viết" tooltip="Tiêu đề giúp bạn dễ dàng tìm kiếm lại sau này.">
                            <Input placeholder="Nhập tiêu đề..." prefix={<FileTextOutlined style={{ color: token.colorTextPlaceholder }} />} />
                        </Form.Item>
                        <Form.Item 
                            name="content" 
                            label="Nội dung chính" 
                            required 
                            tooltip="Nội dung càng chi tiết, AI phân tích càng chính xác."
                            rules={[{ required: true, message: 'Nội dung không được để trống' }]}
                        >
                            <TextArea rows={10} placeholder="Nhập hoặc dán nội dung bài viết vào đây..." showCount minLength={50} style={{ resize: 'none' }} />
                        </Form.Item>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item name="website" label="Nguồn Website">
                                    <Input placeholder="VD: dantri.com.vn" prefix={<LinkOutlined style={{ color: token.colorTextPlaceholder }} />} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="publish_date" label="Ngày xuất bản">
                                    <DatePicker style={{ width: '100%' }} showTime format="DD/MM/YYYY HH:mm" />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Form.Item>
                            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading} block style={{ height: 48, fontSize: 16 }}>
                                Lưu bài viết & Tạo mã lô
                            </Button>
                        </Form.Item>
                    </Form>
                </Card>
            </Col>
            <Col xs={24} lg={8}>
                <Card style={{ background: '#f6ffed', borderColor: '#b7eb8f' }} title={<Space><BulbOutlined style={{ color: '#52c41a' }} /> Mẹo sử dụng</Space>}>
                    <ul style={{ paddingLeft: 20, color: token.colorTextSecondary }}>
                        <li style={{ marginBottom: 8 }}>Nội dung bài viết nên dài trên <strong>50 ký tự</strong> để AI có thể phân tích cảm xúc hiệu quả.</li>
                        <li style={{ marginBottom: 8 }}>Bạn có thể nhập bài viết từ các nguồn bên ngoài hoặc tự viết ghi chú cá nhân.</li>
                        <li>Sau khi lưu, hệ thống sẽ tự động tạo một <strong>Update ID (Mã lô)</strong>. Bạn có thể dùng mã này để chạy phân tích AI hàng loạt.</li>
                    </ul>
                </Card>
            </Col>
        </Row>
    );

    const importTab = (
        <div style={{ marginTop: 24 }}>
            <Alert
                title="Quy trình Import dữ liệu"
                description="Thực hiện theo 3 bước đơn giản dưới đây để đưa lượng lớn dữ liệu vào hệ thống."
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
            />
            <Steps 
                current={fileList.length > 0 ? 1 : 0} 
                items={[
                    { title: 'Chuẩn bị File', content: 'Tải template chuẩn', icon: <FileExcelOutlined /> },
                    { title: 'Tải lên', content: 'Upload file .xlsx', icon: <CloudUploadOutlined /> },
                    { title: 'Hoàn tất', content: 'Xem kết quả & ID', icon: <CheckCircleOutlined /> }
                ]}
                style={{ marginBottom: 32, padding: '0 24px' }}
            />
            
            <Row gutter={24}>
                <Col xs={24} md={14}>
                    <Dragger 
                        fileList={fileList}
                        onRemove={() => { setFileList([]); setImportStats(null); }}
                        beforeUpload={(file) => {
                            const isExcel = file.type.includes('sheet') || file.type.includes('excel');
                            if (!isExcel) { message.error('Chỉ chấp nhận file Excel!'); return Upload.LIST_IGNORE; }
                            setFileList([file]); return false;
                        }}
                        style={{ background: '#fafafa', border: `2px dashed ${token.colorPrimary}`, padding: 32 }}
                    >
                        <p className="ant-upload-drag-icon"><CloudUploadOutlined style={{ color: token.colorPrimary, fontSize: 48 }} /></p>
                        <p className="ant-upload-text" style={{ fontSize: 16 }}>Kéo thả file Excel vào đây</p>
                        <p className="ant-upload-hint">Hoặc click để chọn file từ máy tính</p>
                    </Dragger>
                    
                    <Button 
                        type="primary" onClick={handleUpload} 
                        disabled={fileList.length === 0} loading={uploading} 
                        icon={<UploadOutlined />} size="large" block 
                        style={{ marginTop: 24, height: 48 }}
                    >
                        {uploading ? 'Đang xử lý dữ liệu...' : 'Bắt đầu Import'}
                    </Button>
                </Col>
                <Col xs={24} md={10}>
                    <Card title="Cấu trúc File Excel" size="small" style={{ background: '#f9f9f9', marginBottom: 24 }}>
                        <ul style={{ paddingLeft: 20, margin: 0, fontSize: 13 }}>
                            <li>Cột A: <strong>Title</strong> (Tiêu đề)</li>
                            <li>Cột B: <strong>Content</strong> (Nội dung - Bắt buộc)</li>
                            <li>Cột C: <strong>Website</strong> (Nguồn)</li>
                            <li>Cột D: <strong>Publish Date</strong> (Ngày xuất bản)</li>
                        </ul>
                        <Divider style={{ margin: '12px 0' }} />
                        <Text type="secondary" style={{ fontSize: 12 }}>* Dữ liệu bắt đầu từ dòng số 2 (Bỏ qua header)</Text>
                    </Card>

                    {importStats && (
                        <Card title="Kết quả Import" style={{ borderColor: token.colorSuccess }} headStyle={{ color: token.colorSuccess }}>
                            <Row gutter={16} style={{ textAlign: 'center' }}>
                                <Col span={12}><Statistic title="Thành công" value={importStats.success} valueStyle={{ color: token.colorSuccess }} prefix={<CheckCircleOutlined />} /></Col>
                                <Col span={12}><Statistic title="Thất bại" value={importStats.failed} valueStyle={{ color: token.colorError }} prefix={<CloseCircleOutlined />} /></Col>
                            </Row>
                            {importStats.errors?.length > 0 && (
                                <div style={{ marginTop: 16, maxHeight: 120, overflowY: 'auto', background: '#fff2f0', padding: 8, borderRadius: 8 }}>
                                    <Text type="danger" strong style={{ fontSize: 12 }}>Chi tiết lỗi:</Text>
                                    <ul style={{ paddingLeft: 20, margin: '4px 0 0 0', fontSize: 11 }}>
                                        {importStats.errors.map((err, idx) => <li key={idx}>Dòng {err.row || '?'}: {err.error}</li>)}
                                    </ul>
                                </div>
                            )}
                        </Card>
                    )}
                </Col>
            </Row>
        </div>
    );

    const listTab = (
        <div style={{ marginTop: 24 }}>
            <Card style={{ marginBottom: 24, borderRadius: 12, border: `1px solid ${token.colorBorderSecondary}` }}>
                <Flex justify="space-between" align="center" wrap="wrap" gap={16}>
                    <Space size="middle">
                        <Button 
                            icon={<ReloadOutlined />} 
                            onClick={() => fetchArticles(1, meta.pageSize, filterUpdateId)}
                            loading={loadingList}
                        >
                            Làm mới danh sách
                        </Button>
                        
                        {/* Chỉ hiển thị nút Enrich nếu đang lọc theo ID */}
                        {filterUpdateId && (
                            <Popconfirm
                                title="Kích hoạt phân tích AI?"
                                description="Hệ thống sẽ chạy phân tích tóm tắt và cảm xúc cho toàn bộ lô bài viết này."
                                onConfirm={() => handleEnrich()}
                                okText="Đồng ý" cancelText="Hủy"
                            >
                                <Button 
                                    type="primary" icon={<RobotOutlined />} loading={loadingEnrich}
                                    style={{ background: '#722ed1', borderColor: '#722ed1' }}
                                >
                                    Phân tích AI (Enrich)
                                </Button>
                            </Popconfirm>
                        )}
                    </Space>

                    <Space size="middle">
                        {/* Nút Xuất Excel */}
                        <Space.Compact>
                            <Button loading={loadingExport}>
                                Xuất Excel
                            </Button>
                            <Dropdown
                                menu={{ items: [
                                    { key: 'batch', label: 'Xuất theo Lô hiện tại', icon: <DownloadOutlined />, onClick: () => handleExport('batch'), disabled: !filterUpdateId },
                                    { key: 'list', label: `Xuất ${selectedRowKeys.length} bài đã chọn`, icon: <CheckCircleOutlined />, disabled: selectedRowKeys.length === 0, onClick: () => handleExport('list') }
                                ] }}
                                trigger={['click']}
                            >
                                <Button icon={<FileExcelOutlined />} loading={loadingExport} />
                            </Dropdown>
                        </Space.Compact>
                    </Space>
                </Flex>
                
                {filterUpdateId && (
                    <div style={{ marginTop: 16 }}>
                        <Tag 
                            color="geekblue" 
                            closable 
                            onClose={() => {
                                setFilterUpdateId('');
                                // Tự động load lại toàn bộ danh sách khi tắt filter
                                setTimeout(() => fetchArticles(1, meta.pageSize, ''), 100);
                            }}
                            style={{ fontSize: 14, padding: '4px 10px' }}
                        >
                            <FilterFilled /> Đang lọc theo Mã lô: {filterUpdateId}
                        </Tag>
                    </div>
                )}
            </Card>

            <Table 
                columns={listColumns} 
                dataSource={articles}
                rowKey="_id"
                loading={loadingList}
                rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
                pagination={{
                    current: meta.current, pageSize: meta.pageSize, total: meta.total,
                    onChange: (p, ps) => fetchArticles(p, ps, filterUpdateId),
                    showSizeChanger: true, showTotal: (t) => `Tổng ${t} bài`
                }}
                bordered
                scroll={{ x: 1000 }}
            />
        </div>
    );

    const historyTab = (
        <div style={{ marginTop: 24 }}>
            <Alert title="Nhật ký hoạt động" description="Lưu lại lịch sử các lần bạn tạo thủ công hoặc import file Excel." type="success" showIcon style={{ marginBottom: 24 }} />
            <Table 
                columns={historyColumns} 
                dataSource={batchHistory}
                rowKey="_id"
                loading={loadingHistory}
                pagination={{
                    current: metaHistory.current, pageSize: metaHistory.pageSize, total: metaHistory.total,
                    onChange: (p, ps) => fetchHistory(p, ps),
                    showTotal: (t) => `Tổng ${t} bản ghi`
                }}
            />
        </div>
    );

    // --- MODAL HƯỚNG DẪN ---
    const renderInstructionModal = () => (
        <Modal
            title={<Space><BulbOutlined style={{ color: token.colorPrimary }} /> <span style={{ fontSize: 18 }}>Hướng dẫn sử dụng</span></Space>}
            open={isInstructionModalOpen}
            onCancel={() => setIsInstructionModalOpen(false)}
            footer={[<Button key="close" onClick={() => setIsInstructionModalOpen(false)}>Đã hiểu</Button>]}
            width={700}
        >
            <Tabs defaultActiveKey="1" items={[
                {
                    key: '1',
                    label: 'Tạo thủ công',
                    children: (
                        <div>
                            {[
                                'Điền Tiêu đề và Nội dung bài viết (Nội dung bắt buộc > 50 ký tự).',
                                'Chọn nguồn Website và Ngày xuất bản (nếu có).',
                                'Nhấn "Lưu bài viết". Hệ thống sẽ tự động tạo một Mã lô (Update ID).',
                                'Sau khi lưu, bạn sẽ được chuyển sang tab Danh sách để xem hoặc chạy AI Enrich.'
                            ].map((item, index) => (
                                <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                                    <Badge count={index + 1} style={{ backgroundColor: token.colorPrimary, marginRight: 12 }} />
                                    {item}
                                </div>
                            ))}
                        </div>
                    )
                },
                {
                    key: '2',
                    label: 'Import Excel',
                    children: (
                        <div>
                            {[
                                'Chuẩn bị file Excel (.xlsx) theo cấu trúc mẫu: Cột A (Title), B (Content), C (Website), D (Publish Date).',
                                'Kéo thả file vào khu vực upload hoặc click để chọn file.',
                                'Nhấn "Bắt đầu Import". Hệ thống sẽ xử lý và trả về kết quả Thành công/Thất bại.',
                                'Nếu có lỗi (ví dụ thiếu nội dung), hệ thống sẽ báo chi tiết dòng bị lỗi.',
                                'Tương tự, sau khi import xong, bạn có thể xem lại trong tab Lịch sử hoặc Danh sách.'
                            ].map((item, index) => (
                                <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                                    <Badge count={index + 1} style={{ backgroundColor: token.colorSuccess, marginRight: 12 }} />
                                    {item}
                                </div>
                            ))}
                        </div>
                    )
                },
                {
                    key: '3',
                    label: 'Phân tích & Xuất',
                    children: (
                        <div>
                            {[
                                'Trong tab Danh sách hoặc Lịch sử, bạn sẽ thấy nút "Phân tích AI (Enrich)".',
                                'Chức năng Enrich sẽ gửi bài viết sang hệ thống AI để tóm tắt và phân tích cảm xúc.',
                                'Sau khi phân tích xong, kết quả sẽ hiện ở các cột "Phân tích AI" và "Tóm tắt".',
                                'Bạn có thể Xuất Excel toàn bộ lô bài viết hoặc chỉ xuất các bài được chọn.'
                            ].map((item, index) => (
                                <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                                    <Badge count={index + 1} style={{ backgroundColor: '#722ed1', marginRight: 12 }} />
                                    {item}
                                </div>
                            ))}
                        </div>
                    )
                }
            ]} />
        </Modal>
    );

    const tabItems = [
        { key: 'manual', label: <span style={{ fontSize: 15 }}><PlusOutlined /> Tạo thủ công</span>, children: manualTab },
        { key: 'import', label: <span style={{ fontSize: 15 }}><FileExcelOutlined /> Import Excel</span>, children: importTab },
        { key: 'list', label: <span style={{ fontSize: 15 }}><UnorderedListOutlined /> Danh sách bài viết</span>, children: listTab },
        { key: 'history', label: <span style={{ fontSize: 15 }}><HistoryOutlined /> Lịch sử cập nhật</span>, children: historyTab }
    ];

    return (
        <Card
            style={{ borderRadius: 24, boxShadow: '0 10px 30px rgba(0,0,0,0.08)', minHeight: 700, border: 'none' }}
            styles={{ body: { padding: '32px' } }}
        >
            <Flex justify="space-between" align="center" style={{ marginBottom: 32 }}>
                <div>
                    <Title level={2} style={{ margin: 0 }}>Quản lý bài viết</Title>
                    <Paragraph type="secondary" style={{ fontSize: 16, marginTop: 8, margin: 0 }}>
                        Trung tâm quản lý dữ liệu cá nhân tích hợp AI.
                    </Paragraph>
                </div>
                <Space>
                    <Button icon={<QuestionCircleOutlined />} onClick={() => setIsInstructionModalOpen(true)}>Hướng dẫn</Button>
                </Space>
            </Flex>

            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={tabItems}
                type="card"
                size="large"
                style={{ marginBottom: 32 }}
                tabBarStyle={{ marginBottom: 0 }}
            />

            {renderInstructionModal()}
        </Card>
    );
};

export default MyArticleMain;