"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errMsg } from "@/lib/client";
import { btn, ErrorBox, input } from "@/components/ui";
import type { UserDTO } from "@/types";

const DEMOS = [
  { label: "Author · Priya Sharma", email: "priya.sharma@example.com", password: "Author@123" },
  { label: "Author · David Collins (no bank linked)", email: "david.collins@example.com", password: "Author@123" },
  { label: "Admin · Ops", email: "admin@bookleaf.in", password: "Admin@123" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { user } = await api<{ user: UserDTO }>("/api/auth/login", { method: "POST", json: { email, password } });
      router.replace(user.role === "admin" ? "/admin" : "/author/books");
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="font-serif text-3xl text-leaf-dark">BookLeaf</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">Sign in to track your books, royalties and support requests.</p>
      <form onSubmit={submit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        {error && <ErrorBox message={error} />}
        <label className="block text-sm font-medium">Email
          <input className={`${input} mt-1`} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block text-sm font-medium">Password
          <input className={`${input} mt-1`} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className={`${btn.primary} w-full`} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      <div className="mt-6 text-sm">
        <p className="mb-2 text-slate-500"></p>
        <ul className="space-y-1">
          {DEMOS.map((d) => (
            <li key={d.email}>
              <button type="button" className="text-leaf-dark underline-offset-2 hover:underline" onClick={() => { setEmail(d.email); setPassword(d.password); }}>
                {d.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
