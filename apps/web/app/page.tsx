export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="max-w-xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight">UIT EduAdvisor</h1>
        <p className="mt-4 text-sm text-neutral-400">
          Skeleton M0 - chưa có tính năng. Xem{" "}
          <code className="rounded bg-neutral-800 px-1.5 py-0.5">/api/health</code>{" "}
          để kiểm tra liveness.
        </p>
      </div>
    </main>
  );
}
