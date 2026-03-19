"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      <main className="relative flex min-h-screen items-center justify-center px-4 py-8">
        <div className="glass w-full max-w-md p-8">
          <div className="content-layer space-y-4 text-center">
            <h1 className="text-2xl font-semibold text-white">Registration</h1>
            <p className="text-sm text-slate-100">
              You need an invite link to create an account. Contact your admin.
            </p>
            <Link href="/login" className="text-cyan-300 hover:underline text-sm">
              Already have an account? Login
            </Link>
          </div>
        </div>
      </main>
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
    <main className="relative flex min-h-screen items-center justify-center px-4 py-8">
      <div className="glass w-full max-w-md p-8">
        <div className="content-layer space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold text-white">Create Account</h1>
            <p className="text-sm text-slate-100">Join KanbanFlow</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              placeholder="Full name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
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
            {error ? <p className="text-sm text-red-300">{error}</p> : null}
            <Button type="submit" variant="primary" disabled={loading} className="w-full">
              {loading ? "Creating account..." : "Register"}
            </Button>
          </form>

          <p className="text-center text-sm text-slate-100">
            Already have an account?{" "}
            <Link href="/login" className="text-cyan-300 hover:underline">
              Login
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
