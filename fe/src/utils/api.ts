import queryString from 'query-string';
import { Session } from 'next-auth';

// Định nghĩa kiểu dữ liệu cho props của hàm sendRequest
export interface IRequest {
    url: string;
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: any;
    queryParams?: any;
    useCredentials?: boolean;
    headers?: HeadersInit;
    nextOption?: RequestInit;
    session?: Session | null; // Thêm session để xử lý xác thực
}

// Định nghĩa kiểu dữ liệu chung cho phản hồi từ backend
export interface IBackendRes<T> {
    statusCode: number;
    message: string;
    data?: T;
    error?: string;
}

/**
 * Hàm sendRequest chung sử dụng async/await và fetch
 */
export const sendRequest = async <T>(props: IRequest): Promise<IBackendRes<T>> => {
    let {
        url,
        method,
        body,
        queryParams = {},
        useCredentials = false,
        headers = {},
        nextOption = {},
        session
    } = props;

    const options: RequestInit = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        ...nextOption
    };

    if (useCredentials) {
        options.credentials = "include";
    }

    // Tự động đính kèm Authorization header nếu có session
    if (session?.access_token) {
        (options.headers as Record<string, string>)['Authorization'] = `Bearer ${session.access_token}`;
    }

    if (Object.keys(queryParams).length > 0) {
        url = `${url}?${queryString.stringify(queryParams)}`;
    }

    // try/catch block nằm ở đây để xử lý lỗi mạng
    try {
        const res = await fetch(url, options);

        // Nếu response OK (2xx)
        if (res.ok) {
            // Trả về dữ liệu JSON (đã bao gồm `data`, `message`... từ backend)
            return await res.json();
        } else {
            // Nếu response lỗi (4xx, 5xx)
            const json = await res.json();
            return {
                statusCode: res.status,
                message: json?.message ?? "Đã có lỗi xảy ra",
                error: json?.error ?? ""
            };
        }
    } catch (error) {
        // Lỗi mạng (không kết nối được, v.v.)
        console.error("Lỗi Fetch API:", error);
        return {
            statusCode: 500, // Mã lỗi tùy chỉnh cho lỗi mạng
            message: (error as Error).message || 'Lỗi mạng hoặc server không phản hồi',
        };
    }
};

// (Giữ nguyên hàm sendRequestFile nếu bạn cần)
export const sendRequestFile = async <T>(props: IRequest): Promise<IBackendRes<T>> => {
    let {
        url,
        method,
        body,
        queryParams = {},
        useCredentials = false,
        headers = {},
        nextOption = {},
        session
    } = props;

    const options: RequestInit = {
        method: method,
        headers: { ...headers },
        body: body ? body : undefined,
        ...nextOption
    };

    if (useCredentials) {
        options.credentials = "include";
    }

    if (session?.access_token) {
        (options.headers as Record<string, string>)['Authorization'] = `Bearer ${session.access_token}`;
    }

    if (Object.keys(queryParams).length > 0) {
        url = `${url}?${queryString.stringify(queryParams)}`;
    }

    try {
        const res = await fetch(url, options);
        if (res.ok) {
            return await res.json();
        } else {
            const json = await res.json();
            return {
                statusCode: res.status,
                message: json?.message ?? "Đã có lỗi xảy ra",
                error: json?.error ?? ""
            };
        }
    } catch (error) {
        console.error("Lỗi Fetch API (file):", error);
        return {
            statusCode: 500,
            message: (error as Error).message || 'Lỗi mạng hoặc server không phản hồi',
        };
    }
};