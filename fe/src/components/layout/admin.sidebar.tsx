'use client'
import Layout from "antd/es/layout";
import Menu from "antd/es/menu";
import {
    AppstoreOutlined,
    TeamOutlined,
    FileTextOutlined,
    TagsOutlined
} from '@ant-design/icons';
import React, { useContext } from 'react';
import { AdminContext } from "@/library/admin.context";
import type { MenuProps } from 'antd';
import Link from 'next/link'

type MenuItem = Required<MenuProps>['items'][number];

const AdminSideBar = () => {
    const { Sider } = Layout;
    const { collapseMenu } = useContext(AdminContext)!;

    const items: MenuItem[] = [
        {
            key: 'grp',
            label: 'Admin Panel',
            type: 'group',
            children: [
                {
                    key: "dashboard",
                    label: <Link href={"/dashboard"}>Dashboard</Link>,
                    icon: <AppstoreOutlined />,
                },
                {
                    key: "users",
                    label: <Link href={"/dashboard/user"}>Quản lý User</Link>,
                    icon: <TeamOutlined />,
                },
                {
                    key: "articles",
                    label: <Link href={"/dashboard/article"}>Quản lý Bài viết</Link>,
                    icon: <FileTextOutlined />,
                },
                {
                    key: "topics",
                    label: <Link href={"/dashboard/topic"}>Quản lý Chủ đề</Link>,
                    icon: <TagsOutlined />,
                },
            ],
        },
    ];

    return (
        <Sider collapsed={collapseMenu} theme="light">
            <Menu
                mode="inline"
                defaultSelectedKeys={['dashboard']}
                items={items}
                style={{ height: '100vh', borderRight: 0 }}
            />
        </Sider>
    )
}

export default AdminSideBar;