'use server'

import { auth, signIn } from "@/auth";
import { revalidateTag } from 'next/cache'
import { sendRequest } from "./api";


export async function authenticate(username: string, password: string) {
    try {
        // Attempt to sign in. If credentials are wrong, it throws an error.
        await signIn("credentials", {
            username: username,
            password: password,
            redirect: false,
        })

        // If signIn does not throw, login is successful.
        // Now, get the session which contains the user's details.
        const session = await auth();

        // Return a success object with the user data.
        return { success: true, user: session?.user };

    } catch (error) {
        // This logic correctly handles your custom errors.
        if ((error as any).name === "InvalidEmailPasswordError") {
            return {
                error: (error as any).type,
                code: 1
            }

        } else if ((error as any).name === "InactiveAccountError") {
            return {
                error: (error as any).type,
                code: 2
            }
        } else {
            // Fallback for other errors, including generic credential errors.
            return {
                error: "Invalid email or password",
                code: 0
            }
        }
    }
}

export const handleCreateUserAction = async (data: any) => {
    const session = await auth();
    const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/users`,
        method: "POST",
        headers: {
            Authorization: `Bearer ${session?.user?.access_token}`,
        },
        body: { ...data }
    })
    revalidateTag("list-users")
    return res;
}

export const handleUpdateUserAction = async (data: any) => {
    const session = await auth();
    const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/users`,
        method: "PATCH",
        headers: {
            Authorization: `Bearer ${session?.user?.access_token}`,
        },
        body: { ...data }
    })
    revalidateTag("list-users")
    return res;
}

export const handleDeleteUserAction = async (id: any) => {
    const session = await auth();
    const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/users/${id}`,
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${session?.user?.access_token}`,
        },
    })

    revalidateTag("list-users")
    return res;
}
