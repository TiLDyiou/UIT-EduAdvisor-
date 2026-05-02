import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="vi" className="dark">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
