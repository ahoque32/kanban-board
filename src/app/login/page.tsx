"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "Login failed" }));
      setError(data.error || "Login failed");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.2),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.12),transparent_24%),linear-gradient(180deg,var(--bg-primary),var(--bg-secondary))]" />
      <div className="relative w-full max-w-md">
        <div className="glass-card p-8 md:p-10">
          <div className="space-y-7">
            <div className="space-y-3 text-center">
              <div className="inline-flex items-center rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
                KanbanFlow
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]">Welcome back</h1>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">Sign in to manage tasks, review status, and update the upload queue.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              <Input type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              {error ? <p className="text-sm text-[var(--accent-danger)]">{error}</p> : null}
              <Button type="submit" variant="primary" disabled={loading} className="w-full">
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <p className="text-center text-sm text-[var(--text-secondary)]">
              No account?{" "}
              <Link href="/register" className="font-medium text-[var(--accent-primary)] hover:underline">
                Register
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
