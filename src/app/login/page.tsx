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
    <main className="relative flex min-h-screen items-center justify-center px-4 py-8">
      <div className="glass w-full max-w-md p-8">
        <div className="content-layer space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold text-white">KanbanFlow Login</h1>
            <p className="text-sm text-slate-100">Email and password authentication</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {error ? <p className="text-sm text-red-300">{error}</p> : null}
            <Button type="submit" variant="primary" disabled={loading} className="w-full">
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <p className="text-center text-sm text-slate-100">
            No account?{" "}
            <Link href="/register" className="text-cyan-300 hover:underline">
              Register
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
