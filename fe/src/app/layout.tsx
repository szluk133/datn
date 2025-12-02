import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AntdRegistry } from "@ant-design/nextjs-registry";

import "@/app/globals.css";
import NextAuthWrapper from "@/library/next.auth.wrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LVC",
  description: "...",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        key="root-body"
        className={inter.className}
        suppressHydrationWarning={true}
      >
        <AntdRegistry>
          <NextAuthWrapper>{children}</NextAuthWrapper>
        </AntdRegistry>
      </body>
    </html>
  );
}