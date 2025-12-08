import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
    const token = await getToken({ 
        req, 
        secret: process.env.AUTH_SECRET as string, 
    });

    const url = req.nextUrl;
    const pathname = url.pathname;

    if (pathname.startsWith("/dashboard")) {
        
        if (!token) {
            const urlLogin = new URL("/auth/login", req.url);
            urlLogin.searchParams.set("callbackUrl", pathname);
            return NextResponse.redirect(urlLogin);
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