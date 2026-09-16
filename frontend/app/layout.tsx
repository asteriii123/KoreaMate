import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppShell } from "../components/shell/app-shell";

export const metadata: Metadata = {
  title: "KoreaMate",
  description: "一句话规划韩国旅行，或完成韩语翻译。",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
