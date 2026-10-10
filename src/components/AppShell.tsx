"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/client";
import type { UserDTO } from "@/types";
import { Spinner } from "./ui";

const NAV = {
  author: [
    { href: "/author/books", label: "My books" },
    { href: "/author/tickets", label: "My tickets" },
    { href: "/author/tickets/new", label: "New query" },
    { href: "/author/assistant", label: "Ask AI" },
  ],
  admin: [{ href: "/admin", label: "Ticket queue" }],
};

export default function AppShell({ role, children }: { role: "author" | "admin"; children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [user, setUser] = useState<UserDTO | null>(null);

  useEffect(() => {
    api<{ user: UserDTO }>("/api/auth/me")
      .then((r) => (r.user.role === role ? setUser(r.user) : router.replace(r.user.role === "admin" ? "/admin" : "/author/books")))
      .catch(() => router.replace("/login"));
  }, [role, router]);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (!user) return <div className="mx-auto max-w-5xl px-4"><Spinner /></div>;
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href={role === "admin" ? "/admin" : "/author/books"} className="font-serif text-lg text-leaf-dark">
            BookLeaf <span className="text-sm text-slate-500">{role === "admin" ? "Operations" : "Author portal"}</span>
          </Link>
          <nav className="flex gap-1 text-sm" aria-label="Main">
            {NAV[role].map((n) => {
              const active = n.href === path || (n.href !== "/author/tickets/new" && n.href !== "/admin" && path.startsWith(n.href) && !path.endsWith("/new"));
              return (
                <Link key={n.href} href={n.href} className={`rounded-md px-3 py-1.5 ${active ? "bg-leaf-soft font-medium text-leaf-dark" : "text-slate-600 hover:bg-slate-100"}`}>
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-slate-600">
            <span>{user.name}</span>
            <button onClick={logout} className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50">Sign out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
