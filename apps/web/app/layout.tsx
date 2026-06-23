import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";

import "./globals.css";

const notoSans = Noto_Sans({
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-noto-sans",
});

export const metadata: Metadata = {
  title: "UIT EduAdvisor",
  description: "All-in-one academic advisor for UIT students",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Dark mode is the default per PRD 5.3. We force `dark` on <html> so
  // Tailwind `dark:` variants and the system color-scheme both apply.
  return (
    <html lang="vi" className={`dark ${notoSans.variable}`}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
