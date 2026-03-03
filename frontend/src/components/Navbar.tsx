"use client";

import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    logout();
    router.push("/");
  };

  return (
    <nav className="navbar">
      <div className="navbar__inner">
        <Link href="/" className="navbar__brand">
          <span className="navbar__logo">🎓</span>
          <span className="navbar__title">UIT EduAdvisor</span>
        </Link>

        <div className="navbar__links" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Link href="/upload" className="navbar__link">
            📄 Upload
          </Link>
          <Link href="/dashboard" className="navbar__link">
            🗺️ Roadmap
          </Link>

          {!isLoading && user ? (
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginLeft: "12px", paddingLeft: "16px", borderLeft: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#f8fafc", fontSize: "14px", fontWeight: 600 }}>
                <User size={16} color="#a78bfa" />
                <span>{user.ho_ten}</span>
              </div>
              <button
                onClick={handleLogout}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#f87171", display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", fontWeight: 600, padding: "4px 8px", borderRadius: "6px" }}
                className="hover:bg-red-900/20 transition-colors"
                title="Đăng xuất"
              >
                <LogOut size={16} /> Thoát
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
