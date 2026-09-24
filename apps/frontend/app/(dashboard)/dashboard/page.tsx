"use client";

import {
  useEffect,
  useState
} from "react";

import type {
  DashboardResponse
} from "@data-manage/types";

import {
  api
} from "../../../lib/api";

export default function DashboardPage() {
  const [
    data,
    setData
  ] =
    useState<DashboardResponse | null>(
      null
    );

  const [
    error,
    setError
  ] =
    useState("");

  useEffect(
    () => {
      api<DashboardResponse>(
        "/api/dashboard"
      )
        .then(setData)
        .catch(
          (value) =>
            setError(
              value instanceof Error
                ? value.message
                : "Failed to load dashboard."
            )
        );
    },
    []
  );

  if (error) {
    return (
      <main className="p-6">
        <p className="text-destructive">
          {error}
        </p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="p-6">
        Loading dashboard...
      </main>
    );
  }

  const cards = [
    [
      "Clients",
      data.stats.clients
    ],
    [
      "Views",
      data.stats.views
    ],
    [
      "Images",
      data.stats.images
    ],
    [
      "Annotations",
      data.stats.annotations
    ],
    [
      "Users",
      data.stats.users
    ]
  ];

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Dashboard
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Dataset and metadata overview.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map(
          ([
            label,
            value
          ]) => (
            <div
              key={label}
              className="rounded-xl border bg-card p-5"
            >
              <p className="text-sm text-muted-foreground">
                {label}
              </p>

              <p className="mt-2 text-3xl font-semibold">
                {value}
              </p>
            </div>
          )
        )}
      </div>

      <section className="rounded-xl border bg-card">
        <div className="border-b p-5">
          <h2 className="font-semibold">
            Clients
          </h2>
        </div>

        {data.clients.map(
          (client) => (
            <div
              key={
                client.client_id
              }
              className="flex items-center justify-between border-b p-4 last:border-b-0"
            >
              <span>
                {
                  client.client_name
                }
              </span>

              <span className="text-sm text-muted-foreground">
                {
                  client.images
                }{" "}
                images ·{" "}
                {
                  client.annotations
                }{" "}
                annotations
              </span>
            </div>
          )
        )}
      </section>
    </main>
  );
}
