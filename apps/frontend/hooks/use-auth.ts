"use client";

import {
  useCallback,
  useEffect,
  useState
} from "react";

import type {
  AuthUser
} from "@data-manage/types";

import {
  api
} from "../lib/api";

export function useAuth() {
  const [
    user,
    setUser
  ] =
    useState<AuthUser | null>(
      null
    );

  const [
    loading,
    setLoading
  ] =
    useState(true);

  const refresh =
    useCallback(
      async () => {
        try {
          const result =
            await api<{
              user: AuthUser;
            }>(
              "/api/auth/me"
            );

          setUser(
            result.user
          );
        } catch {
          setUser(null);
        } finally {
          setLoading(
            false
          );
        }
      },
      []
    );

  useEffect(
    () => {
      void refresh();
    },
    [refresh]
  );

  const logout =
    useCallback(
      async () => {
        await api(
          "/api/auth/logout",
          {
            method:
              "POST"
          }
        );

        setUser(null);
      },
      []
    );

  return {
    user,
    loading,
    refresh,
    logout
  };
}
