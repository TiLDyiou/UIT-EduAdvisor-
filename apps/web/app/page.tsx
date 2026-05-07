import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="max-w-xl space-y-6 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">UIT EduAdvisor</p>
        <h1 className="text-4xl font-semibold tracking-tight">Cố vấn học vụ</h1>
        <p className="text-sm text-neutral-400">
          Milestone 2: đăng nhập DAA/Moodle lần đầu, đồng bộ dữ liệu và quản lý phiên bảo mật.
        </p>
        <div className="flex flex-wrap justify-center gap-4 text-sm">
          <Link
            href="/onboarding"
            className="rounded-md bg-cyan-600 px-4 py-2 font-medium text-black hover:bg-cyan-500"
          >
            Onboarding
          </Link>
          <Link
            href="/settings"
            className="rounded-md border border-neutral-700 px-4 py-2 text-neutral-200 hover:border-cyan-700"
          >
            Cài đặt
          </Link>
        </div>
      </div>
    </main>
  );
}
