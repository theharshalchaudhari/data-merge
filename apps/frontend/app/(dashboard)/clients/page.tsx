"use client";

import { useEffect, useMemo, useState } from "react";
import type { Client, View } from "@data-manage/types";
import { api } from "../../../lib/api";
import { useAuth } from "../../../hooks/use-auth";

type DeleteTarget =
  | { type: "client"; item: Client }
  | { type: "view"; item: View };

const menuItem =
  "w-full rounded px-3 py-2 text-left text-sm hover:bg-secondary";

const input =
  "h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary";

const textarea =
  "min-h-20 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function Modal({
  children,
  onClose
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-xl border bg-card p-5 shadow-xl">
        {children}
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "editor";

  const [clients, setClients] = useState<Client[]>([]);
  const [views, setViews] = useState<Record<string, View[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"client" | "view" | null>(null);
  const [viewClientId, setViewClientId] = useState("");
  const [renameTarget, setRenameTarget] = useState<View | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [clientForm, setClientForm] = useState({
    name: "",
    description: ""
  });

  const [viewForm, setViewForm] = useState({
    name: "",
    description: ""
  });

  useEffect(() => {
    async function load() {
      try {
        const clients = await api<Client[]>("/api/clients");
        const entries = await Promise.all(
          clients.map(async (client) => [
            client.id,
            await api<View[]>(
              `/api/views?clientId=${encodeURIComponent(client.id)}`
            )
          ] as const)
        );

        setClients(clients);
        setViews(Object.fromEntries(entries));
      } catch (value) {
        setError(
          value instanceof Error
            ? value.message
            : "Failed to load clients."
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const recommendations = useMemo(() => {
    const current = new Set(
      (views[viewClientId] ?? []).map((view) =>
        view.name.toLowerCase()
      )
    );

    return [...new Map(
      Object.values(views).flat().map((view) => [
        view.name.toLowerCase(),
        view.name
      ])
    ).values()]
      .filter((name) => !current.has(name.toLowerCase()))
      .sort((a, b) => a.localeCompare(b));
  }, [views, viewClientId]);

  function openClientDialog() {
    setClientForm({ name: "", description: "" });
    setError("");
    setDialog("client");
  }

  function openViewDialog(clientId: string) {
    setViewClientId(clientId);
    setViewForm({ name: "", description: "" });
    setError("");
    setMenu(null);
    setDialog("view");
  }

  function openRename(view: View) {
    setRenameTarget(view);
    setRenameName(view.name);
    setError("");
    setMenu(null);
  }

  function openDelete(target: DeleteTarget) {
    setDeleteTarget(target);
    setError("");
    setMenu(null);
  }

  async function createClient() {
    if (!clientForm.name.trim()) return;

    setSaving(true);
    setError("");

    try {
      const client = await api<Client>("/api/clients", {
        method: "POST",
        body: JSON.stringify({
          name: clientForm.name.trim(),
          description: clientForm.description.trim() || undefined
        })
      });

      setClients((current) => [...current, client]);
      setViews((current) => ({ ...current, [client.id]: [] }));
      setDialog(null);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Failed to create client."
      );
    } finally {
      setSaving(false);
    }
  }

  async function createView() {
    const name = viewForm.name.trim();
    if (!viewClientId || !name) return;

    if (
      (views[viewClientId] ?? []).some(
        (view) => view.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      setError("A view with this name already exists for this client.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const view = await api<View>("/api/views", {
        method: "POST",
        body: JSON.stringify({
          clientId: viewClientId,
          name,
          description: viewForm.description.trim() || undefined
        })
      });

      setViews((current) => ({
        ...current,
        [viewClientId]: [...(current[viewClientId] ?? []), view]
      }));

      setSelectedView(view.id);
      setDialog(null);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Failed to create view."
      );
    } finally {
      setSaving(false);
    }
  }

  async function renameView() {
    if (!renameTarget) return;

    const name = renameName.trim();
    if (!name || name === renameTarget.name) return;

    setBusyId(renameTarget.id);
    setError("");

    try {
      const updated = await api<View>(
        `/api/views/${renameTarget.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name })
        }
      );

      setViews((current) => ({
        ...current,
        [renameTarget.clientId]: (
          current[renameTarget.clientId] ?? []
        ).map((view) =>
          view.id === renameTarget.id ? updated : view
        )
      }));

      setRenameTarget(null);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Failed to rename view."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function deleteClient(client: Client) {
    setBusyId(client.id);
    setError("");

    try {
      await api(`/api/clients/${client.id}`, {
        method: "DELETE"
      });

      setClients((current) =>
        current.filter((item) => item.id !== client.id)
      );

      setViews((current) => {
        const next = { ...current };
        delete next[client.id];
        return next;
      });

      setDeleteTarget(null);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Failed to delete client."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function deleteView(view: View) {
    setBusyId(view.id);
    setError("");

    try {
      await api(`/api/views/${view.id}`, {
        method: "DELETE"
      });

      setViews((current) => ({
        ...current,
        [view.clientId]: (current[view.clientId] ?? []).filter(
          (item) => item.id !== view.id
        )
      }));

      if (selectedView === view.id) setSelectedView(null);
      setDeleteTarget(null);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Failed to delete view."
      );
    } finally {
      setBusyId(null);
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;

    if (deleteTarget.type === "client") {
      void deleteClient(deleteTarget.item);
    } else {
      void deleteView(deleteTarget.item);
    }
  }

  return (
    <main className="p-5">
      <header className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Clients & Views</h1>
        </div>

        {canManage && (
          <button
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            type="button"
            onClick={openClientDialog}
          >
            + Add Client
          </button>
        )}
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading clients...
        </div>
      ) : !clients.length ? (
        <div className="rounded-lg border border-dashed bg-card p-10 text-center">
          <p className="text-sm font-medium">No clients yet</p>

          {canManage && (
            <button
              className="mt-3 text-sm font-medium text-primary hover:underline"
              type="button"
              onClick={openClientDialog}
            >
              Add Client
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {clients.map((client) => {
            const clientViews = views[client.id] ?? [];
            const clientMenu = menu === `client:${client.id}`;

            return (
              <section
                className="rounded-lg border bg-card"
                key={client.id}
              >
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="shrink-0 font-semibold">
                      {client.name}
                    </h2>

                    {client.description && (
                      <span className="truncate text-sm text-muted-foreground">
                        ({client.description})
                      </span>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {clientViews.length}{" "}
                      {clientViews.length === 1 ? "view" : "views"}
                    </span>

                    {canManage && (
                      <>
                        <button
                          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                          type="button"
                          onClick={() => openViewDialog(client.id)}
                        >
                          + Add View
                        </button>

                        <div className="relative">
                          <button
                            className="flex size-8 items-center justify-center rounded-md border text-lg leading-none hover:bg-secondary"
                            type="button"
                            onClick={() =>
                              setMenu(
                                clientMenu
                                  ? null
                                  : `client:${client.id}`
                              )
                            }
                          >
                            ⋮
                          </button>

                          {clientMenu && (
                            <div className="absolute right-0 top-9 z-20 w-36 rounded-md border bg-popover p-1 shadow-md">
                              <button
                                className={`${menuItem} text-destructive hover:bg-destructive/10`}
                                type="button"
                                onClick={() =>
                                  openDelete({
                                    type: "client",
                                    item: client
                                  })
                                }
                              >
                                Delete Client
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="border-t px-4 py-3">
                  {clientViews.length ? (
                    <div className="flex flex-wrap gap-2">
                      {clientViews.map((view) => {
                        const selected = selectedView === view.id;
                        const viewMenu = menu === `view:${view.id}`;

                        return (
                          <div
                            className="relative p-1"
                            key={view.id}
                          >
                            <button
                              className="rounded-md bg-secondary px-4 py-2 pr-8 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 data-[selected=true]:bg-primary/15 data-[selected=true]:text-primary data-[selected=true]:ring-1 data-[selected=true]:ring-primary/30"
                              data-selected={selected}
                              type="button"
                              onClick={() => {
                                setSelectedView(view.id);
                                setMenu(null);
                              }}
                            >
                              {view.name}
                            </button>

                            {canManage && (
                              <>
                                <button
                                  className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-xs hover:bg-background/70"
                                  type="button"
                                  onClick={() =>
                                    setMenu(
                                      viewMenu
                                        ? null
                                        : `view:${view.id}`
                                    )
                                  }
                                >
                                  ⋮
                                </button>

                                {viewMenu && (
                                  <div className="absolute right-0 top-9 z-20 w-32 rounded-md border bg-popover p-1 shadow-md">
                                    <button
                                      className={menuItem}
                                      type="button"
                                      onClick={() => openRename(view)}
                                    >
                                      Rename
                                    </button>

                                    <button
                                      className={`${menuItem} text-destructive hover:bg-destructive/10`}
                                      type="button"
                                      onClick={() =>
                                        openDelete({
                                          type: "view",
                                          item: view
                                        })
                                      }
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      No views
                    </span>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {dialog === "client" && canManage && (
        <Modal onClose={() => !saving && setDialog(null)}>
          <h2 className="font-semibold">Add Client</h2>

          <div className="mt-4 space-y-3">
            <input
              className={input}
              autoFocus
              placeholder="Client name"
              value={clientForm.name}
              onChange={(e) =>
                setClientForm({
                  ...clientForm,
                  name: e.target.value
                })
              }
            />

            <textarea
              className={textarea}
              placeholder="Description (optional)"
              value={clientForm.description}
              onChange={(e) =>
                setClientForm({
                  ...clientForm,
                  description: e.target.value
                })
              }
            />
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              className="rounded-md border px-4 py-2 text-sm hover:bg-secondary"
              type="button"
              disabled={saving}
              onClick={() => setDialog(null)}
            >
              Cancel
            </button>

            <button
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              type="button"
              disabled={saving || !clientForm.name.trim()}
              onClick={() => void createClient()}
            >
              {saving ? "Creating..." : "Create Client"}
            </button>
          </div>
        </Modal>
      )}

      {dialog === "view" && canManage && (
        <Modal onClose={() => !saving && setDialog(null)}>
          <h2 className="font-semibold">Add View</h2>

          <div className="mt-4 space-y-3">
            <input
              className={input}
              autoFocus
              placeholder="View name"
              value={viewForm.name}
              onChange={(e) =>
                setViewForm({
                  ...viewForm,
                  name: e.target.value
                })
              }
            />

            {recommendations.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-muted-foreground">
                  Existing view names
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {recommendations.map((name) => (
                    <button
                      className="rounded-md bg-secondary px-2.5 py-1.5 text-xs text-secondary-foreground hover:bg-secondary/80"
                      key={name}
                      type="button"
                      onClick={() =>
                        setViewForm({
                          ...viewForm,
                          name
                        })
                      }
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <textarea
              className={textarea}
              placeholder="Description (optional)"
              value={viewForm.description}
              onChange={(e) =>
                setViewForm({
                  ...viewForm,
                  description: e.target.value
                })
              }
            />
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              className="rounded-md border px-4 py-2 text-sm hover:bg-secondary"
              type="button"
              disabled={saving}
              onClick={() => setDialog(null)}
            >
              Cancel
            </button>

            <button
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              type="button"
              disabled={saving || !viewForm.name.trim()}
              onClick={() => void createView()}
            >
              {saving ? "Creating..." : "Create View"}
            </button>
          </div>
        </Modal>
      )}

      {renameTarget && (
        <Modal onClose={() => !busyId && setRenameTarget(null)}>
          <h2 className="font-semibold">Rename View</h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Change the name of "{renameTarget.name}".
          </p>

          <input
            className={`${input} mt-4`}
            autoFocus
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && void renameView()
            }
          />

          <div className="mt-5 flex justify-end gap-2">
            <button
              className="rounded-md border px-4 py-2 text-sm hover:bg-secondary"
              type="button"
              disabled={!!busyId}
              onClick={() => setRenameTarget(null)}
            >
              Cancel
            </button>

            <button
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              type="button"
              disabled={
                !!busyId ||
                !renameName.trim() ||
                renameName.trim() === renameTarget.name
              }
              onClick={() => void renameView()}
            >
              {busyId ? "Saving..." : "Save"}
            </button>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal onClose={() => !busyId && setDeleteTarget(null)}>
          <h2 className="font-semibold">
            Delete {deleteTarget.type === "client" ? "Client" : "View"}?
          </h2>

          <p className="mt-2 text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <span className="font-medium text-foreground">
              {deleteTarget.item.name}
            </span>
            ? This action cannot be undone.
          </p>

          <div className="mt-5 flex justify-end gap-2">
            <button
              className="rounded-md border px-4 py-2 text-sm hover:bg-secondary"
              type="button"
              disabled={!!busyId}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </button>

            <button
              className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50"
              type="button"
              disabled={!!busyId}
              onClick={confirmDelete}
            >
              {busyId ? "Deleting..." : "Delete"}
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}