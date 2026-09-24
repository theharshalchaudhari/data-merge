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

export default function RegisterPage() {
  const router =
    useRouter();

  const [
    name,
    setName
  ] =
    useState("");

  const [
    username,
    setUsername
  ] =
    useState("");

  const [
    email,
    setEmail
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
    success,
    setSuccess
  ] =
    useState("");

  async function submit(
    event: FormEvent
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    try {
      await api(
        "/api/auth/register",
        {
          method:
            "POST",

          body:
            JSON.stringify({
              name,
              username,
              email,
              password
            })
        }
      );

      setSuccess(
        "Registration submitted. Wait for administrator approval."
      );

      setTimeout(
        () =>
          router.push(
            "/login"
          ),
        1200
      );
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Registration failed."
      );
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-5 rounded-2xl border bg-card p-8 shadow-sm"
      >
        <div>
          <h1 className="text-2xl font-semibold">
            Create account
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            New accounts require administrator approval.
          </p>
        </div>

        <input
          className="w-full rounded-lg border bg-background px-3 py-2"
          placeholder="Full name"
          value={name}
          onChange={(event) =>
            setName(
              event.target.value
            )
          }
          required
        />

        <input
          className="w-full rounded-lg border bg-background px-3 py-2"
          placeholder="Username"
          value={username}
          onChange={(event) =>
            setUsername(
              event.target.value
            )
          }
          required
        />

        <input
          type="email"
          className="w-full rounded-lg border bg-background px-3 py-2"
          placeholder="Email"
          value={email}
          onChange={(event) =>
            setEmail(
              event.target.value
            )
          }
          required
        />

        <input
          type="password"
          className="w-full rounded-lg border bg-background px-3 py-2"
          placeholder="Password"
          value={password}
          onChange={(event) =>
            setPassword(
              event.target.value
            )
          }
          required
        />

        {error && (
          <p className="text-sm text-destructive">
            {error}
          </p>
        )}

        {success && (
          <p className="text-sm text-green-600">
            {success}
          </p>
        )}

        <button className="w-full rounded-lg bg-primary px-4 py-2 text-primary-foreground">
          Create account
        </button>

        <p className="text-center text-sm text-muted-foreground">
          Already registered?{" "}
          <Link
            href="/login"
            className="underline"
          >
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
