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
  // We check theme in head to avoid flash of light/dark mode
  return (
    <html lang="vi" className={`${notoSans.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen font-sans antialiased bg-[#f2f4f8] text-neutral-800 dark:bg-[#1a1b26] dark:text-[#a9b1d6] transition-colors duration-300">
        {children}
      </body>
    </html>
  );
}
