import { auth } from "@/auth";
import UserTable from "@/components/admin/user/user.table";
import { sendRequest } from "@/utils/api";
import { IUser } from "@/types/next-auth";

// Định nghĩa kiểu dữ liệu cho phần 'meta' của phân trang
interface IMeta {
    current: number;
    pageSize: number;
    pages: number;
    total: number;
}

// Định nghĩa kiểu dữ liệu cho toàn bộ 'data' trả về từ API users
interface IPaginatedUsers {
    meta: IMeta;
    results: IUser[];
}

const ManageUserPage = async ({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) => {

    // 🔥 Phải await searchParams
    const params = await searchParams;

    const current = Number(params.current ?? 1);
    const pageSize = Number(params.pageSize ?? 10);

    const session = await auth();

    // Gửi API lấy danh sách user
    const res = await sendRequest<IPaginatedUsers>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/users`,
        method: "GET",
        queryParams: { current, pageSize },
        headers: {
            Authorization: `Bearer ${session?.access_token}`,
        },
        nextOption: { next: { tags: ["list-users"] } },
    });

    const users = res?.data?.results ?? [];
    const meta = res?.data?.meta;

    return (
        <div>
            <UserTable users={users} meta={meta} />
        </div>
    );
};

export default ManageUserPage;
