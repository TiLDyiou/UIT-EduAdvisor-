import Link from "next/link";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/curricula", label: "Curricula" },
  { href: "/admin/resources", label: "Resources" },
  { href: "/admin/tooltips", label: "Tooltips" },
  { href: "/admin/policies", label: "Policies" },
  { href: "/admin/imports", label: "Imports" },
  { href: "/admin/jobs", label: "Jobs" },
  { href: "/admin/audit", label: "Audit" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-neutral-950 text-neutral-100">
      <div className="border-b border-neutral-800 bg-neutral-900/70">
        <nav className="mx-auto flex max-w-6xl flex-wrap gap-2 px-6 py-3 text-xs">
          {links.map((x) => (
            <Link
              key={x.href}
              href={x.href}
              className="rounded border border-neutral-700 px-2 py-1 hover:border-cyan-500"
            >
              {x.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
