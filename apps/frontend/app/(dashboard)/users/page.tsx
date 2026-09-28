"use client";

import { useEffect, useState } from "react";
import type { User, UserRole } from "@data-manage/types";
import { api } from "../../../lib/api";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setError("");
        setUsers(await api<User[]>("/api/users"));
      } catch (value) {
        setError(
          value instanceof Error
            ? value.message
            : "Failed to load users."
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  async function updateRole(
    id: string,
    role: UserRole
  ) {
    setUpdatingId(id);
    setError("");

    try {
      const updated = await api<User>(
        `/api/users/${id}/role`,
        {
          method: "PATCH",
          body: JSON.stringify({ role })
        }
      );

      setUsers((current) =>
        current.map((user) =>
          user.id === id
            ? updated
            : user
        )
      );
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Failed to update role."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <main className="space-y-5 p-6">
      <div>
        <h1 className="text-3xl font-semibold">
          Users
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage access permissions.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          {error}
        </p>
      )}

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="grid grid-cols-4 border-b px-4 py-3 text-sm font-medium">
          <span>Name</span>
          <span>Username</span>
          <span>Email</span>
          <span>Role</span>
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Loading users...
          </div>
        ) : users.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No users found.
          </div>
        ) : (
          users.map((user) => (
            <div
              key={user.id}
              className="grid grid-cols-4 items-center border-b px-4 py-3 text-sm last:border-0"
            >
              <span className="truncate">
                {user.name}
              </span>

              <span className="truncate">
                {user.username}
              </span>

              <span className="truncate">
                {user.email}
              </span>

              <select
                className="w-full rounded-lg border bg-background px-2 py-1 disabled:opacity-50"
                value={user.role}
                disabled={updatingId === user.id}
                onChange={(event) =>
                  void updateRole(
                    user.id,
                    event.target.value as UserRole
                  )
                }
              >
                <option value="pending">
                  Pending
                </option>
                <option value="viewer">
                  Viewer
                </option>
                <option value="editor">
                  Editor
                </option>
                <option value="admin">
                  Admin
                </option>
              </select>
            </div>
          ))
        )}
      </section>
    </main>
  );
}