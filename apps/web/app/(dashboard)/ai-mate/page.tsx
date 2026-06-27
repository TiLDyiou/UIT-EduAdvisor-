"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AiMatePage() {
  const router = useRouter();

  useEffect(() => {
    localStorage.setItem("open_uit_mate", "true");
    router.replace("/");
  }, [router]);

  return (
    <div className="flex h-[50vh] items-center justify-center text-sm text-neutral-400">
      Đang chuyển hướng đến trang chủ và mở trợ lý học tập UIT Mate...
    </div>
  );
}
