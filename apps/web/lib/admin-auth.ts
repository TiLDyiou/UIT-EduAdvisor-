"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { fetchAdminMe, type AdminMe } from "@/lib/admin";

export function useAdminGuard() {
  const router = useRouter();
  const [me, setMe] = useState<AdminMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchAdminMe();
      if (cancelled) return;
      if (r.unauthorized) {
        router.replace("/admin/login");
        return;
      }
      if (r.ok && r.me) setMe(r.me);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return { me, loading };
}
