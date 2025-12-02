import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { InactiveAccountError, InvalidEmailPasswordError } from "./utils/errors"
import { sendRequest } from "./utils/api"
import { IBackendRes } from "./utils/api" // Giả sử IBackendRes cũng ở trong api.ts
import { IUser } from "./types/next-auth"

// Giả sử ILogin có cấu trúc này, dựa trên hàm authorize
interface ILogin {
    user: IUser;
    access_token: string;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: {},
        password: {},
      },
      authorize: async (credentials) => {
        const res = await sendRequest<ILogin>({ // Đảm bảo kiểu ILogin đúng
          method: "POST",
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/login`,
          body: {
            username: credentials.username,
            password: credentials.password
          }
        })

        // Dùng kiểu 'any' cho `res.data` ở đây để linh hoạt
        if (res.statusCode === 201 && res.data) {
          // Trả về đối tượng đầy đủ cho callback `jwt`
          return {
            _id: res.data.user?._id,
            name: res.data.user?.name,
            email: res.data.user?.email,
            role: res.data.user?.role,
            access_token: res.data.access_token, // Trả về token ở cấp cao nhất
          } as any; // Dùng `as any` ở đây để cho phép `access_token`
        } else if (+res.statusCode === 401) {
          throw new InvalidEmailPasswordError()
        } else if (+res.statusCode === 400) {
          throw new InactiveAccountError()
        } else {
          throw new Error(res.message || "Internal server error")
        }

      },
    }),
  ],
  pages: {
    signIn: "/auth/login",
  },
  // --- PHẦN SỬA LỖI QUAN TRỌNG NHẤT ---
  callbacks: {
    jwt({ token, user }) {
      if (user) { 
        // `user` là đối tượng trả về từ `authorize`
        // 1. Tách thông tin user và gán vào `token.user`
        token.user = {
            _id: (user as any)._id,
            name: (user as any).name,
            email: (user as any).email,
            role: (user as any).role,
        };
        // 2. Gán access_token vào cấp cao nhất của `token`
        token.access_token = (user as any).access_token;
      }
      return token;
    },
    session({ session, token }) {
      // 1. Gán thông tin user từ token vào `session.user`
      (session.user as IUser) = token.user as IUser;
      // 2. Gán access_token từ token vào cấp cao nhất của `session`
      session.access_token = token.access_token as string; // <-- ĐÂY LÀ DÒNG SỬA LỖI
      return session;
    },
    authorized: async ({ auth }) => {
      // Logged in users are authenticated, 
      //otherwise redirect to login page
      return !!auth
    },
  },
})

