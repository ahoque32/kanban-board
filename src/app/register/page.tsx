"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.2),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.12),transparent_24%),linear-gradient(180deg,var(--bg-primary),var(--bg-secondary))]" />
      <div className="relative w-full max-w-md">
        <div className="glass-card p-8 md:p-10">{children}</div>
      </div>
    </main>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const inviteEmail = searchParams.get("email") || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState(inviteEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <AuthShell>
        <div className="space-y-5 text-center">
          <div className="inline-flex items-center rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
            Invite only
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]">Registration</h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">You need an invite link to create an account. Contact your admin.</p>
          </div>
          <Link href="/login" className="text-sm font-medium text-[var(--accent-primary)] hover:underline">
            Already have an account? Login
          </Link>
        </div>
      </AuthShell>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name, email, password }),
    });

    setLoading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "Registration failed" }));
      setError(data.error || "Registration failed");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <AuthShell>
      <div className="space-y-7">
        <div className="space-y-3 text-center">
          <div className="inline-flex items-center rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
            KanbanFlow
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]">Create account</h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">Join the board with your invite and start contributing immediately.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input placeholder="Full name" value={name} onChange={(event) => setName(event.target.value)} required />
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            readOnly={!!inviteEmail}
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
          />
          {error ? <p className="text-sm text-[var(--accent-danger)]">{error}</p> : null}
          <Button type="submit" variant="primary" disabled={loading} className="w-full">
            {loading ? "Creating account..." : "Register"}
          </Button>
        </form>

        <p className="text-center text-sm text-[var(--text-secondary)]">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[var(--accent-primary)] hover:underline">
            Login
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
