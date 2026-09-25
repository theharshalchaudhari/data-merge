"use client";

import {
  useEffect,
  useState,
} from "react";
import type {
  Client,
  View,
} from "@data-manage/types";
import { api } from "../../../lib/api";

export default function ViewsPage() {
  const [clients, setClients] =
    useState<Client[]>([]);
  const [views, setViews] =
    useState<View[]>([]);
  const [clientId, setClientId] =
    useState("");
  const [name, setName] =
    useState("");
  const [description, setDescription] =
    useState("");
  const [error, setError] =
    useState("");
  const [loading, setLoading] =
    useState(true);
  const [creating, setCreating] =
    useState(false);

  async function loadClients() {
    try {
      setError("");

      const result =
        await api<Client[]>(
          "/api/clients",
        );

      setClients(result);

      if (
        result.length > 0 &&
        !clientId
      ) {
        setClientId(result[0].id);
      }
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Failed to load clients.",
      );
    }
  }

  async function loadViews(
    selectedClientId: string,
  ) {
    if (!selectedClientId) {
      setViews([]);
      return;
    }

    try {
      setError("");

      const result =
        await api<View[]>(
          `/api/views?clientId=${encodeURIComponent(
            selectedClientId,
          )}`,
        );

      setViews(result);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Failed to load views.",
      );
    }
  }

  useEffect(() => {
    async function initialize() {
      setLoading(true);

      try {
        await loadClients();
      } finally {
        setLoading(false);
      }
    }

    void initialize();
  }, []);

  useEffect(() => {
    if (!clientId) {
      setViews([]);
      return;
    }

    void loadViews(clientId);
  }, [clientId]);

  async function create() {
    setError("");

    if (!clientId) {
      setError("Select a client.");
      return;
    }

    if (!name.trim()) {
      setError("View name is required.");
      return;
    }

    setCreating(true);

    try {
      await api<View>(
        "/api/views",
        {
          method: "POST",
          body: JSON.stringify({
            clientId,
            name: name.trim(),
            description:
              description.trim() ||
              undefined,
          }),
        },
      );

      setName("");
      setDescription("");

      await loadViews(clientId);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Failed to create view.",
      );
    } finally {
      setCreating(false);
    }
  }

  const selectedClient =
    clients.find(
      (client) =>
        client.id === clientId,
    );

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Views
        </h1>

        <p className="text-sm text-muted-foreground">
          Manage camera and dataset
          views for each client.
        </p>
      </div>

      <section className="rounded-xl border bg-card p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <select
            className="rounded-lg border bg-background px-3 py-2"
            value={clientId}
            onChange={(event) =>
              setClientId(
                event.target.value,
              )
            }
            disabled={
              loading ||
              clients.length === 0
            }
          >
            <option value="">
              Select client
            </option>

            {clients.map((client) => (
              <option
                key={client.id}
                value={client.id}
              >
                {client.name}
              </option>
            ))}
          </select>

          <input
            className="rounded-lg border bg-background px-3 py-2"
            placeholder="View name"
            value={name}
            onChange={(event) =>
              setName(
                event.target.value,
              )
            }
            disabled={
              !clientId || creating
            }
          />

          <input
            className="rounded-lg border bg-background px-3 py-2"
            placeholder="Description"
            value={description}
            onChange={(event) =>
              setDescription(
                event.target.value,
              )
            }
            disabled={
              !clientId || creating
            }
          />

          <button
            onClick={create}
            disabled={
              !clientId ||
              !name.trim() ||
              creating
            }
            className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating
              ? "Creating..."
              : "Create"}
          </button>
        </div>
      </section>

      {error && (
        <p className="text-sm text-destructive">
          {error}
        </p>
      )}

      {selectedClient && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-medium">
              {selectedClient.name}
            </h2>

            <p className="text-sm text-muted-foreground">
              Views configured for this
              client.
            </p>
          </div>

          <div className="divide-y rounded-xl border bg-card">
            {views.map((view) => (
              <div
                key={view.id}
                className="p-5"
              >
                <p className="font-medium">
                  {view.name}
                </p>

                {view.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {view.description}
                  </p>
                )}
              </div>
            ))}

            {!views.length && (
              <div className="p-6 text-sm text-muted-foreground">
                No views for this
                client yet.
              </div>
            )}
          </div>
        </section>
      )}

      {!loading &&
        !clients.length && (
          <section className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            No clients available.
            Create a client first.
          </section>
        )}
    </main>
  );
}