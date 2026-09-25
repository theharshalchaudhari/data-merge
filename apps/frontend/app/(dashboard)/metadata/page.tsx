"use client";

import {
  Download,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import * as XLSX from "xlsx";
import { api } from "../../../lib/api";

type Annotation = {
  class_id: number;
  center_x: number;
  center_y: number;
  width: number;
  height: number;
};

type ClassMapping = {
  class_id: number;
  class_name: string;
};

type MetadataRecord = {
  id: string;
  name: string;
  client_name?: string;
  view_name?: string;
  view_id?: string;
  annotation_type?: string;
  annotations?: Annotation[];
  classes?: ClassMapping[];
  view_classes?: ClassMapping[];
};

type MetadataListResponse = {
  items: MetadataRecord[];
  classes?: ClassMapping[];
};

type MetadataRow = {
  client: string;
  view: string;
  name: string;
  className: string;
  classId: string;
  label: string;
  classIds: number[];
};

function isAnnotation(
  value: unknown,
): value is Annotation {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const item =
    value as Partial<Annotation>;

  return (
    Number.isInteger(item.class_id) &&
    typeof item.center_x === "number" &&
    typeof item.center_y === "number" &&
    typeof item.width === "number" &&
    typeof item.height === "number"
  );
}

function normalizeAnnotations(
  annotations: unknown,
): Annotation[] {
  if (!Array.isArray(annotations)) {
    return [];
  }

  return annotations.filter(isAnnotation);
}

function createLabel(
  annotation: Annotation,
): string {
  return [
    annotation.class_id,
    annotation.center_x,
    annotation.center_y,
    annotation.width,
    annotation.height,
  ]
    .map((value) => value.toString())
    .join(" ");
}

function getClassMappings(
  item: MetadataRecord,
  globalClasses: ClassMapping[],
): ClassMapping[] {
  if (
    Array.isArray(item.classes) &&
    item.classes.length > 0
  ) {
    return item.classes;
  }

  if (
    Array.isArray(item.view_classes) &&
    item.view_classes.length > 0
  ) {
    return item.view_classes;
  }

  return globalClasses;
}

function buildRows(
  data: MetadataListResponse | null,
): MetadataRow[] {
  const result: MetadataRow[] = [];

  const globalClasses =
    data?.classes ?? [];

  for (const item of data?.items ?? []) {
    const annotations =
      normalizeAnnotations(
        item.annotations,
      );

    const classMappings =
      getClassMappings(
        item,
        globalClasses,
      );

    const classMap = new Map<
      number,
      string
    >();

    for (const mapping of classMappings) {
      classMap.set(
        Number(mapping.class_id),
        mapping.class_name,
      );
    }

    const classIds = Array.from(
      new Set(
        annotations.map(
          (annotation) =>
            annotation.class_id,
        ),
      ),
    );

    const classNames = classIds.map(
      (classId) =>
        classMap.get(classId) ??
        `Class ${classId}`,
    );

    const labels = annotations
      .map(createLabel)
      .filter(Boolean);

    result.push({
      client:
        item.client_name ?? "—",
      view:
        item.view_name ?? "—",
      name: item.name,
      className:
        classNames.length > 0
          ? classNames.join(", ")
          : "—",
      classId:
        classIds.length > 0
          ? classIds.join(", ")
          : "—",
      label: labels.join("\n"),
      classIds,
    });
  }

  return result;
}

export default function MetadataPage() {
  const [data, setData] =
    useState<MetadataListResponse | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [clientFilter, setClientFilter] =
    useState("");

  const [viewFilter, setViewFilter] =
    useState("");

  const [classFilter, setClassFilter] =
    useState("");

  async function loadMetadata() {
    try {
      setLoading(true);
      setError("");

      const result =
        await api<MetadataListResponse>(
          "/api/metadata",
        );

      setData(result);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Failed to load metadata.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMetadata();
  }, []);

  const rows = useMemo(
    () => buildRows(data),
    [data],
  );

  const clients = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((row) => row.client)
          .filter(
            (value) => value !== "—",
          ),
      ),
    ).sort();
  }, [rows]);

  const views = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .filter(
            (row) =>
              !clientFilter ||
              row.client === clientFilter,
          )
          .map((row) => row.view)
          .filter(
            (value) => value !== "—",
          ),
      ),
    ).sort();
  }, [rows, clientFilter]);

  const classes = useMemo(() => {
    const values = new Set<string>();

    for (const row of rows) {
      if (row.className === "—") {
        continue;
      }

      for (const className of row.className
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)) {
        values.add(className);
      }
    }

    return Array.from(values).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (
        clientFilter &&
        row.client !== clientFilter
      ) {
        return false;
      }

      if (
        viewFilter &&
        row.view !== viewFilter
      ) {
        return false;
      }

      if (
        classFilter &&
        !row.className
          .split(",")
          .map((value) => value.trim())
          .includes(classFilter)
      ) {
        return false;
      }

      return true;
    });
  }, [
    rows,
    clientFilter,
    viewFilter,
    classFilter,
  ]);

  function downloadExcel() {
    const worksheet =
      XLSX.utils.json_to_sheet(
        filteredRows.map((row) => ({
          Client: row.client,
          View: row.view,
          Name: row.name,
          "Class Name": row.className,
          "Class ID": row.classId,
          Label: row.label,
        })),
      );

    worksheet["!cols"] = [
      { wch: 20 },
      { wch: 20 },
      { wch: 45 },
      { wch: 30 },
      { wch: 15 },
      { wch: 70 },
    ];

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Metadata",
    );

    XLSX.writeFile(
      workbook,
      "metadata.xlsx",
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              Metadata
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Annotation metadata and YOLO labels.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                void loadMetadata()
              }
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            >
              <RefreshCw
                className={
                  loading
                    ? "size-4 animate-spin"
                    : "size-4"
                }
              />

              Refresh
            </button>

            <button
              type="button"
              onClick={downloadExcel}
              disabled={
                loading ||
                filteredRows.length === 0
              }
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              <Download className="size-4" />

              Download Excel
            </button>
          </div>
        </div>

        <section className="mb-5 rounded-xl border bg-card">
          <div className="grid gap-3 p-4 md:grid-cols-3">
            <div>
              <label
                htmlFor="client"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Client
              </label>

              <select
                id="client"
                value={clientFilter}
                onChange={(event) => {
                  setClientFilter(
                    event.target.value,
                  );
                  setViewFilter("");
                }}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">
                  All clients
                </option>

                {clients.map((client) => (
                  <option
                    key={client}
                    value={client}
                  >
                    {client}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="view"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                View
              </label>

              <select
                id="view"
                value={viewFilter}
                onChange={(event) =>
                  setViewFilter(
                    event.target.value,
                  )
                }
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">
                  All views
                </option>

                {views.map((view) => (
                  <option
                    key={view}
                    value={view}
                  >
                    {view}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="class"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Class
              </label>

              <select
                id="class"
                value={classFilter}
                onChange={(event) =>
                  setClassFilter(
                    event.target.value,
                  )
                }
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">
                  All classes
                </option>

                {classes.map(
                  (className) => (
                    <option
                      key={className}
                      value={className}
                    >
                      {className}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-sm font-medium">
                Annotation Metadata
              </p>

              <p className="mt-0.5 text-xs text-muted-foreground">
                {filteredRows.length.toLocaleString()}{" "}
                images
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading metadata...
              </div>
            </div>
          ) : error ? (
            <div className="p-6 text-sm text-destructive">
              {error}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No metadata found.
            </div>
          ) : (
            <div className="max-h-[calc(100vh-18rem)] overflow-auto">
              <table className="w-full min-w-225 text-sm">
                <thead className="sticky top-0 z-10 border-b bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">
                      Client
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      View
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      Name
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      Class Name
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      Class ID
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      Label
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRows.map(
                    (row, index) => (
                      <tr
                        key={`${row.client}-${row.view}-${row.name}-${index}`}
                        className="border-b last:border-b-0 hover:bg-muted/50"
                      >
                        <td className="px-4 py-3">
                          {row.client}
                        </td>

                        <td className="px-4 py-3">
                          {row.view}
                        </td>

                        <td className="max-w-80 px-4 py-3">
                          <span
                            className="block truncate"
                            title={row.name}
                          >
                            {row.name}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          {row.className}
                        </td>

                        <td className="px-4 py-3 font-mono text-xs">
                          {row.classId}
                        </td>

                        <td className="max-w-160 px-4 py-3">
                          {row.label ? (
                            <pre className="whitespace-pre-wrap break-all rounded-md bg-muted px-2 py-1 font-mono text-xs">
                              {row.label}
                            </pre>
                          ) : (
                            <span className="text-muted-foreground">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}