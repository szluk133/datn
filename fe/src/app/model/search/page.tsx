'use client';

import React from 'react';
import ArticleList from "@/components/client/article/article.list";
import { Breadcrumb, Flex, Typography, theme } from "antd";
import { HomeOutlined, SearchOutlined, SafetyCertificateFilled } from "@ant-design/icons";
import Link from "next/link";

const { Title, Text } = Typography;

const SearchPage = () => {
    const { token } = theme.useToken();

    return (
        <div style={{ 
            backgroundColor: '#f0f2f5', 
            minHeight: '100vh', 
            paddingBottom: '60px',
            backgroundImage: 'radial-gradient(#e6f7ff 1px, transparent 1px)',
            backgroundSize: '24px 24px'
        }}>
            <div style={{ 
                height: '64px', 
                background: 'rgba(255, 255, 255, 0.8)', 
                backdropFilter: 'blur(8px)',
                borderBottom: '1px solid rgba(0,0,0,0.05)', 
                marginBottom: 40,
                position: 'sticky',
                top: 0,
                zIndex: 10
            }}>
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: '100%', display: 'flex', alignItems: 'center' }}>
                    <Breadcrumb 
                        items={[
                            { title: <Link href="/model"><HomeOutlined /></Link> },
                            { title: <span style={{ color: token.colorText, fontWeight: 500 }}><SearchOutlined /> Công cụ tìm kiếm</span> }
                        ]}
                    />
                </div>
            </div>

            <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px' }}>
                <Flex vertical gap={32}>
                    <div style={{ textAlign: 'center', marginBottom: 8 }}>
                        <Title level={1} style={{ margin: '0 0 16px 0', fontSize: 36, fontWeight: 800, letterSpacing: '-1px' }}>
                            <span style={{ 
                                background: `linear-gradient(to right, ${token.colorPrimary}, ${token.colorSuccess})`,
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent'
                            }}>
                                Công cụ tìm kiếm nâng cao
                            </span>
                        </Title>
                        <Text type="secondary" style={{ fontSize: 18, maxWidth: 600, display: 'inline-block' }}>
                            Thu thập, phân tích và tổng hợp dữ liệu tin tức uy tín chỉ trong vài giây.
                        </Text>
                        
                        <Flex justify="center" gap={24} style={{ marginTop: 24 }}>
                            <Flex align="center" gap={8}>
                                <SafetyCertificateFilled style={{ color: token.colorSuccess }} />
                                <Text strong style={{ fontSize: 13 }}>Nguồn tin xác thực</Text>
                            </Flex>
                            <Flex align="center" gap={8}>
                                <SafetyCertificateFilled style={{ color: token.colorPrimary }} />
                                <Text strong style={{ fontSize: 13 }}>Phân tích AI Realtime</Text>
                            </Flex>
                        </Flex>
                    </div>
                    
                    <div className="animate-fade-in-up">
                        <ArticleList />
                    </div>
                </Flex>
            </div>

            <style jsx global>{`
                .animate-fade-in-up {
                    animation: fadeInUp 0.6s ease-out forwards;
                    opacity: 0;
                    transform: translateY(20px);
                }
                @keyframes fadeInUp {
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );
};

export default SearchPage;