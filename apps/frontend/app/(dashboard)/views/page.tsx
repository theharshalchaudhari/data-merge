"use client";

import {
  useEffect,
  useState
} from "react";

import type {
  View
} from "@data-manage/types";

import {
  api
} from "../../../lib/api";

export default function ViewsPage() {
  const [
    views,
    setViews
  ] =
    useState<View[]>(
      []
    );

  const [
    name,
    setName
  ] =
    useState("");

  const [
    description,
    setDescription
  ] =
    useState("");

  const [
    error,
    setError
  ] =
    useState("");

  async function load() {
    try {
      setViews(
        await api<View[]>(
          "/api/views"
        )
      );
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Failed to load views."
      );
    }
  }

  useEffect(
    () => {
      void load();
    },
    []
  );

  async function create() {
    if (!name.trim()) {
      return;
    }

    try {
      await api(
        "/api/views",
        {
          method:
            "POST",

          body:
            JSON.stringify({
              name,
              description
            })
        }
      );

      setName("");
      setDescription("");

      await load();
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Failed to create view."
      );
    }
  }

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Views
        </h1>

        <p className="text-sm text-muted-foreground">
          Manage camera and dataset view types.
        </p>
      </div>

      <section className="grid gap-3 rounded-xl border bg-card p-5 md:grid-cols-[1fr_1fr_auto]">
        <input
          className="rounded-lg border bg-background px-3 py-2"
          placeholder="View name"
          value={name}
          onChange={(event) =>
            setName(
              event.target.value
            )
          }
        />

        <input
          className="rounded-lg border bg-background px-3 py-2"
          placeholder="Description"
          value={description}
          onChange={(event) =>
            setDescription(
              event.target.value
            )
          }
        />

        <button
          onClick={create}
          className="rounded-lg bg-primary px-4 py-2 text-primary-foreground"
        >
          Create
        </button>
      </section>

      {error && (
        <p className="text-sm text-destructive">
          {error}
        </p>
      )}

      <section className="divide-y rounded-xl border bg-card">
        {views.map(
          (view) => (
            <div
              key={view.id}
              className="p-5"
            >
              <p className="font-medium">
                {view.name}
              </p>

              {view.description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {
                    view.description
                  }
                </p>
              )}
            </div>
          )
        )}

        {!views.length && (
          <div className="p-6 text-sm text-muted-foreground">
            No views yet.
          </div>
        )}
      </section>
    </main>
  );
}
