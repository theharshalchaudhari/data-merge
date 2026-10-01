"use client";

import {
  FormEvent,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

export default function LoginForm() {
  const router = useRouter();
  const searchParams =
    useSearchParams();

  const [username, setUsername] =
    useState("");
  const [password, setPassword] =
    useState("");
  const [error, setError] =
    useState("");
  const [loading, setLoading] =
    useState(false);

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    const trimmedUsername =
      username.trim();

    if (!trimmedUsername) {
      setError(
        "Username is required.",
      );
      return;
    }

    if (!password) {
      setError(
        "Password is required.",
      );
      return;
    }

    setError("");
    setLoading(true);

    try {
      await api(
        "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            username:
              trimmedUsername,
            password,
          }),
        },
      );

      await api(
        "/api/auth/me",
      );

      const next =
        searchParams.get("next");

      const destination =
        next &&
        next.startsWith("/") &&
        !next.startsWith("//")
          ? next
          : "/dashboard";

      window.location.replace(
        destination,
      );
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Login failed.",
      );
      setLoading(false);
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
          <label
            htmlFor="username"
            className="text-sm font-medium"
          >
            Username
          </label>

          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            value={username}
            onChange={(event) =>
              setUsername(
                event.target.value,
              )
            }
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="password"
            className="text-sm font-medium"
          >
            Password
          </label>

          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            value={password}
            onChange={(event) =>
              setPassword(
                event.target.value,
              )
            }
            disabled={loading}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
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