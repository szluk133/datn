'use client';

import React from 'react';
import { Layout } from 'antd';

const { Footer } = Layout;

const ClientFooter: React.FC = () => {
    return (
        <Footer style={{ textAlign: 'center' }}>
            test ©{new Date().getFullYear()} Created with Next.js & NestJS
        </Footer>
    );
};

export default ClientFooter;
