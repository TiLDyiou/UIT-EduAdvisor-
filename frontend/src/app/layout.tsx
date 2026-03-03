import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: "UIT EduAdvisor — Hỗ trợ lộ trình học tập",
  description:
    "Nền tảng hỗ trợ học vụ cho sinh viên trường ĐH Công nghệ Thông tin (UIT). Upload bảng điểm, xem roadmap lộ trình môn học.",
};

import { AuthProvider } from "@/lib/AuthContext";
import Navbar from "@/components/Navbar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${inter.variable} app-body`}>
        <AuthProvider>
          {/* Navigation */}
          <Navbar />

          {/* Main Content */}
          <div className="app-content">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}
