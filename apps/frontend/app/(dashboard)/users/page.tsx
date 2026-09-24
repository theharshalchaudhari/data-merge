"use client";

import {
  useEffect,
  useState
} from "react";

import type {
  User,
  UserRole
} from "@data-manage/types";

import {
  api
} from "../../../lib/api";

export default function UsersPage() {
  const [
    users,
    setUsers
  ] =
    useState<User[]>(
      []
    );

  const [
    error,
    setError
  ] =
    useState("");

  async function load() {
    try {
      setUsers(
        await api<User[]>(
          "/api/users"
        )
      );
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Failed to load users."
      );
    }
  }

  useEffect(
    () => {
      void load();
    },
    []
  );

  async function updateRole(
    id: string,
    role: UserRole
  ) {
    try {
      await api(
        `/api/users/${id}/role`,
        {
          method:
            "PATCH",

          body:
            JSON.stringify({
              role
            })
        }
      );

      await load();
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Failed to update role."
      );
    }
  }

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">
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
        <div className="grid grid-cols-4 border-b p-4 text-sm font-medium">
          <span>Name</span>
          <span>Username</span>
          <span>Email</span>
          <span>Role</span>
        </div>

        {users.map(
          (user) => (
            <div
              key={user.id}
              className="grid grid-cols-4 items-center border-b p-4 text-sm last:border-b-0"
            >
              <span>
                {user.name}
              </span>

              <span>
                {user.username}
              </span>

              <span>
                {user.email}
              </span>

              <select
                className="rounded-lg border bg-background px-2 py-1"
                value={user.role}
                onChange={(
                  event
                ) =>
                  updateRole(
                    user.id,
                    event.target
                      .value as UserRole
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
          )
        )}
      </section>
    </main>
  );
}
