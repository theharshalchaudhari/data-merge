"use client";

import {
  useEffect,
  useState
} from "react";

import type {
  MetadataListResponse
} from "@data-manage/types";

import {
  api
} from "../../../lib/api";

export default function MetadataPage() {
  const [
    data,
    setData
  ] =
    useState<MetadataListResponse | null>(
      null
    );

  const [
    error,
    setError
  ] =
    useState("");

  useEffect(
    () => {
      api<MetadataListResponse>(
        "/api/metadata"
      )
        .then(setData)
        .catch(
          (value) =>
            setError(
              value instanceof Error
                ? value.message
                : "Failed to load metadata."
            )
        );
    },
    []
  );

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Metadata
        </h1>

        <p className="text-sm text-muted-foreground">
          Canonical image and annotation records.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          {error}
        </p>
      )}

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="grid grid-cols-5 border-b p-4 text-sm font-medium">
          <span>Name</span>
          <span>Client</span>
          <span>View</span>
          <span>Type</span>
          <span>Annotations</span>
        </div>

        {!data && (
          <div className="p-6 text-sm text-muted-foreground">
            Loading...
          </div>
        )}

        {data?.items.map(
          (item) => (
            <div
              key={item.id}
              className="grid grid-cols-5 border-b p-4 text-sm last:border-b-0"
            >
              <span className="truncate">
                {item.name}
              </span>

              <span>
                {
                  item.client_name
                }
              </span>

              <span>
                {
                  item.view_name
                }
              </span>

              <span>
                {
                  item.annotation_type
                }
              </span>

              <span>
                {
                  item.annotations
                    .length
                }
              </span>
            </div>
          )
        )}
      </section>
    </main>
  );
}
