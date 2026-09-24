"use client";

import {
  FormEvent,
  useState
} from "react";

import {
  useRouter
} from "next/navigation";

import Link from "next/link";

import {
  api
} from "../../../lib/api";

export default function LoginPage() {
  const router =
    useRouter();

  const [
    username,
    setUsername
  ] =
    useState("");

  const [
    password,
    setPassword
  ] =
    useState("");

  const [
    error,
    setError
  ] =
    useState("");

  const [
    loading,
    setLoading
  ] =
    useState(false);

  async function submit(
    event: FormEvent
  ) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      await api(
        "/api/auth/login",
        {
          method:
            "POST",

          body:
            JSON.stringify({
              username,
              password
            })
        }
      );

      router.push(
        "/dashboard"
      );

      router.refresh();
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Login failed."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 shadow-sm"
      >
        <div>
          <h1 className="text-2xl font-semibold">
            Sign in
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to Data Manage.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Username
          </label>

          <input
            className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            value={username}
            onChange={(event) =>
              setUsername(
                event.target.value
              )
            }
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Password
          </label>

          <input
            type="password"
            className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            value={password}
            onChange={(event) =>
              setPassword(
                event.target.value
              )
            }
            required
          />
        </div>

        {error && (
          <p className="text-sm text-destructive">
            {error}
          </p>
        )}

        <button
          disabled={loading}
          className="w-full rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
        >
          {loading
            ? "Signing in..."
            : "Sign in"}
        </button>

        <p className="text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link
            href="/register"
            className="text-foreground underline"
          >
            Register
          </Link>
        </p>
      </form>
    </main>
  );
}
