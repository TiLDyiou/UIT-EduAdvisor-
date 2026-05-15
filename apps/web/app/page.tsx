import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="max-w-xl space-y-6 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">UIT EduAdvisor</p>
        <h1 className="text-4xl font-semibold tracking-tight">Cố vấn học vụ</h1>
        <p className="text-sm text-neutral-400">
          Milestone 3: Academic Tracker; Milestone 6: AI Mate (chat, RAG quy chế, bộ nhớ cục bộ).
        </p>
        <div className="flex flex-wrap justify-center gap-4 text-sm">
          <Link
            href="/ai-mate"
            className="rounded-md bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-600"
          >
            AI Mate
          </Link>
          <Link
            href="/tracker"
            className="rounded-md bg-gradient-to-r from-cyan-600 to-violet-600 px-4 py-2 font-medium text-white shadow hover:from-cyan-500 hover:to-violet-500 transition-all"
          >
            📊 Academic Tracker
          </Link>
          <Link
            href="/tracker/gpa-tools"
            className="rounded-md bg-violet-700 px-4 py-2 font-medium text-white hover:bg-violet-600"
          >
            🧮 GPA Tools
          </Link>
          <Link
            href="/onboarding"
            className="rounded-md bg-cyan-600 px-4 py-2 font-medium text-black hover:bg-cyan-500"
          >
            Onboarding
          </Link>
          <Link
            href="/scheduler"
            className="rounded-md bg-white px-4 py-2 font-medium text-black hover:bg-neutral-200 transition-all flex items-center gap-2"
          >
            📅 UIT Scheduler
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
