'use client'
import { handleDeleteUserAction } from "@/utils/actions";
import { DeleteTwoTone, EditTwoTone } from "@ant-design/icons";
import { Button, Popconfirm, Table } from "antd"
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from "react";
import UserCreate from "./user.create";
import UserUpdate from "./user.update";
import { IUser } from "@/types/next-auth"; // Import IUser

// Định nghĩa lại kiểu cho meta để tái sử dụng
interface IMeta {
    current: number;
    pageSize: number;
    pages: number;
    total: number;
}

interface IProps {
    users: IUser[]; // Sử dụng kiểu IUser cụ thể thay vì any
    meta?: IMeta; // FIX: Cho phép meta có thể là undefined
}
const UserTable = (props: IProps) => {
    // FIX: Cung cấp giá trị mặc định cho meta
    const { users, meta = { current: 1, pageSize: 10, pages: 0, total: 0 } } = props;
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const { replace } = useRouter();

    const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);
    const [dataUpdate, setDataUpdate] = useState<IUser | null>(null);

    const columns = [
        {
            title: "STT",
            render: (_: any, record: any, index: number) => {
                return (
                    <>{(index + 1) + (meta.current - 1) * (meta.pageSize)}</>
                )
            }
        },
        {
            title: 'Email',
            dataIndex: 'email',
        },
        {
            title: 'Name',
            dataIndex: 'name',
        },
        {
            title: 'Role',
            dataIndex: 'role',
        },
        {
            title: 'Actions',
            render: (text: any, record: IUser) => { // Sử dụng kiểu IUser
                return (
                    <>
                        <EditTwoTone
                            twoToneColor="#f57800" style={{ cursor: "pointer", margin: "0 20px" }}
                            onClick={() => {
                                setIsUpdateModalOpen(true);
                                setDataUpdate(record);
                            }}
                        />

                        <Popconfirm
                            placement="leftTop"
                            title={"Xác nhận xóa user"}
                            description={"Bạn có chắc chắn muốn xóa user này ?"}
                            onConfirm={async () => await handleDeleteUserAction(record?._id)}
                            okText="Xác nhận"
                            cancelText="Hủy"
                        >
                            <span style={{ cursor: "pointer" }}>
                                <DeleteTwoTone twoToneColor="#ff4d4f" />
                            </span>
                        </Popconfirm>
                    </>
                )
            }
        }

    ];

    const onChange = (pagination: any) => {
        if (pagination && pagination.current) {
            const params = new URLSearchParams(searchParams.toString());
            params.set('current', pagination.current);
            params.set('pageSize', pagination.pageSize);
            replace(`${pathname}?${params.toString()}`);
        }
    };


    return (
        <>
            <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20
            }}>
                <h2>Manager Users</h2>
                <Button type="primary" onClick={() => setIsCreateModalOpen(true)}>Create User</Button>
            </div>
            <Table
                bordered
                dataSource={users}
                columns={columns}
                rowKey={"_id"}
                pagination={
                    {
                        current: meta.current,
                        pageSize: meta.pageSize,
                        showSizeChanger: true,
                        total: meta.total,
                        showTotal: (total, range) => { return (<div> {range[0]}-{range[1]} / {total} rows</div>) }
                    }
                }
                onChange={onChange}
            />

            <UserCreate
                isCreateModalOpen={isCreateModalOpen}
                setIsCreateModalOpen={setIsCreateModalOpen}
            />

            <UserUpdate
                isUpdateModalOpen={isUpdateModalOpen}
                setIsUpdateModalOpen={setIsUpdateModalOpen}
                dataUpdate={dataUpdate}
                setDataUpdate={setDataUpdate}
            />
        </>
    )
}

export default UserTable;
