import React from 'react';
import ArticleList from "@/components/client/article/article.list";
import { Breadcrumb } from "antd";
import { HomeOutlined, SearchOutlined } from "@ant-design/icons";
import Link from "next/link";

const SearchPage = () => {
    return (
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
            {/* Breadcrumb điều hướng về Home */}
            <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                    <Link href="/model" style={{ color: 'rgba(0, 0, 0, 0.45)' }}>
                        <HomeOutlined /> Bài đã lưu
                    </Link>
                    <span style={{ color: 'rgba(0, 0, 0, 0.45)' }}>/</span>
                    <span><SearchOutlined /> Tìm kiếm</span>
                </div>
            </div>

            <h2 style={{ textAlign: 'center', marginBottom: 30 }}>Tìm kiếm bài báo</h2>
            
            <ArticleList />
        </div>
    );
};

export default SearchPage;