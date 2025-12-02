'use client';

import React from 'react';
import { Breadcrumb } from 'antd';
import { HomeOutlined, ReadOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface IProps {
    title: string;
}

const ArticleDetailBreadcrumb = (props: IProps) => {
    const { title } = props;
    const router = useRouter();

    return (
        <Breadcrumb
            items={[
                {
                    title: <Link href="/model"><HomeOutlined /></Link>,
                },
                {
                    title: (
                        <span 
                            onClick={() => router.back()} 
                            style={{ 
                                cursor: 'pointer', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: 4,
                                color: 'rgba(0, 0, 0, 0.45)',
                                transition: 'color 0.3s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#1890ff'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(0, 0, 0, 0.45)'}
                        >
                            <ReadOutlined /> Bài báo
                        </span>
                    ),
                },
                {
                    title: (
                        <span 
                            style={{ 
                                maxWidth: '300px', 
                                display: 'inline-block', 
                                overflow: 'hidden', 
                                whiteSpace: 'nowrap', 
                                textOverflow: 'ellipsis', 
                                verticalAlign: 'bottom' 
                            }} 
                            title={title}
                        >
                            {title}
                        </span>
                    ),
                },
            ]}
            style={{ marginBottom: 16 }}
        />
    );
};

export default ArticleDetailBreadcrumb;