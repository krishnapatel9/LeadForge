"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { getSession, safeNextPath, setSession } from "../../lib/auth";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in: go straight on
  useEffect(() => {
    if (getSession()) router.replace(next);
  }, [next, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // apiFetch waits for a sleeping API to start instead of failing at once
      const res = await apiFetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.status === 429) {
        setError("Too many failed attempts. Wait 15 minutes and try again.");
        return;
      }
      if (!res.ok) {
        setError("That email and password don't match an active account.");
        return;
      }
      const data = await res.json();
      setSession(data.access_token, data.user, data.expires_in);
      router.replace(next);
    } catch {
      setError("Can't reach the LeadForge API. Check that it is running.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-wrap" aria-labelledby="login-title">
      <form className="auth-card" onSubmit={onSubmit} noValidate>
        <h1 id="login-title">Sign in</h1>
        <p className="sub">Use the account your LeadForge admin created for you.</p>

        <label className="auth-field">
          <span>Work email</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="auth-field">
          <span>Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <button className="btn p auth-submit" type="submit" disabled={submitting || !email || !password}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </section>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
