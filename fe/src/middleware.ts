import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
    const token = await getToken({ 
        req, 
        secret: process.env.AUTH_SECRET as string, 
        salt: process.env.AUTH_SALT as string 
    });

    const url = req.nextUrl;
    const pathname = url.pathname;

    // Kiểm tra truy cập /admin
    if (pathname.startsWith("/(admin)")) {
        if (!token) {
        return NextResponse.redirect(new URL("/auth/login", req.url));
        }

        if (token?.user?.role !== "admin") {
        return NextResponse.redirect(new URL("/", req.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico|auth|verify|$).*)',
    ],
};