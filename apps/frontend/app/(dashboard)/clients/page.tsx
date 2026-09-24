"use client";

import {
  useEffect,
  useState
} from "react";

import type {
  Client
} from "@data-manage/types";

import {
  api
} from "../../../lib/api";

export default function ClientsPage() {
  const [
    clients,
    setClients
  ] =
    useState<Client[]>(
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
      setClients(
        await api<Client[]>(
          "/api/clients"
        )
      );
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Failed to load clients."
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
        "/api/clients",
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
          : "Failed to create client."
      );
    }
  }

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Clients
        </h1>

        <p className="text-sm text-muted-foreground">
          Manage dataset clients.
        </p>
      </div>

      <section className="grid gap-3 rounded-xl border bg-card p-5 md:grid-cols-[1fr_1fr_auto]">
        <input
          className="rounded-lg border bg-background px-3 py-2"
          placeholder="Client name"
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
        {clients.map(
          (client) => (
            <div
              key={client.id}
              className="p-5"
            >
              <p className="font-medium">
                {client.name}
              </p>

              {client.description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {
                    client.description
                  }
                </p>
              )}
            </div>
          )
        )}

        {!clients.length && (
          <div className="p-6 text-sm text-muted-foreground">
            No clients yet.
          </div>
        )}
      </section>
    </main>
  );
}
