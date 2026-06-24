import { Header } from "@/components/Layouts/Header";
import { Sidebar } from "@/components/Layouts/Sidebar";
import { UITMateWidget } from "@/components/UITMateWidget";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#131318]">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      <div className="flex w-full flex-col md:pl-[260px]">
        <Header />
        
        <main className="flex-1 overflow-x-hidden p-4 md:p-6 lg:p-8 text-[#e4e1e9]">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>

      <UITMateWidget />
    </div>
  );
}
