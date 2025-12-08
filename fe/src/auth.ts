import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { InactiveAccountError, InvalidEmailPasswordError } from "./utils/errors"
import { sendRequest } from "./utils/api"
import { IBackendRes } from "./utils/api"
import { IUser } from "./types/next-auth"

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
        const res = await sendRequest<ILogin>({
          method: "POST",
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/login`,
          body: {
            username: credentials.username,
            password: credentials.password
          }
        })

        if (res.statusCode === 201 && res.data) {
          return {
            _id: res.data.user?._id,
            name: res.data.user?.name,
            email: res.data.user?.email,
            role: res.data.user?.role,
            access_token: res.data.access_token,
          } as any;
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
  callbacks: {
    jwt({ token, user }) {
      if (user) { 
        token.user = {
                _id: (user as any)._id,
                name: (user as any).name,
                email: (user as any).email,
                role: (user as any).role,
        };
        token.access_token = (user as any).access_token;
      }
      return token;
    },
    session({ session, token }) {
      (session.user as IUser) = token.user as IUser;
        session.access_token = token.access_token as string;
      return session;
    },
    authorized: async ({ auth }) => {

      return !!auth
    },
  },
})

