"use client";

import {
  Download,
  ImageDown,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as XLSX from "xlsx";

import { api } from "../../../lib/api";

type Annotation = {
  class_name: string;
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
};

type MetadataListResponse = {
  items: MetadataRecord[];
  classes?: ClassMapping[];
};

type DatasetClass = {
  id: string;
  dataset_type_id: string;
  class_id: number;
  class_name: string;
};

type DatasetType = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  classes: DatasetClass[];
};

type DatasetTypeResponse =
  | DatasetType[]
  | {
      items?: DatasetType[];
    };

type MetadataRow = {
  client: string;
  view: string;
  name: string;
  annotations: Annotation[];
};

type DisplayRow = {
  client: string;
  view: string;
  name: string;
  className: string;
  classId: string;
  label: string;
  annotations: Annotation[];
};

type ModelOption = {
  key: string;
  label: string;
  map: Map<string, number>;
};

const GLOBAL_MODEL_KEY = "__global__";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000";

function isAnnotation(
  value: unknown,
): value is Annotation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<Annotation>;

  return (
    typeof item.class_name === "string" &&
    typeof item.center_x === "number" &&
    typeof item.center_y === "number" &&
    typeof item.width === "number" &&
    typeof item.height === "number"
  );
}

function normalizeAnnotations(
  value: unknown,
): Annotation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isAnnotation);
}

function createYoloLabel(
  annotation: Annotation,
  classMap: Map<string, number>,
): string | null {
  const classId = classMap.get(
    annotation.class_name,
  );

  if (classId === undefined) {
    return null;
  }

  return [
    classId,
    annotation.center_x,
    annotation.center_y,
    annotation.width,
    annotation.height,
  ]
    .map((value) => value.toString())
    .join(" ");
}

function getDatasetTypes(
  response: DatasetTypeResponse,
): DatasetType[] {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response.items)) {
    return response.items;
  }

  return [];
}

function buildRows(
  data: MetadataListResponse | null,
): MetadataRow[] {
  return (data?.items ?? []).map((item) => ({
    client: item.client_name ?? "—",
    view: item.view_name ?? "—",
    name: item.name,
    annotations: normalizeAnnotations(
      item.annotations,
    ),
  }));
}

function createDownloadUrl(
  endpoint: string,
  filters: {
    client: string;
    view: string;
    name: string;
    classes: string[];
    datasetTypeId: string;
  },
): string {
  const query = new URLSearchParams();

  if (filters.client) {
    query.set("client", filters.client);
  }

  if (filters.view) {
    query.set("view", filters.view);
  }

  if (filters.name) {
    query.set("name", filters.name);
  }

  if (filters.classes.length > 0) {
    query.set(
      "classes",
      filters.classes.join(","),
    );
  }

  if (filters.datasetTypeId) {
    query.set(
      "datasetTypeId",
      filters.datasetTypeId,
    );
  }

  return `${API_URL}${endpoint}?${query.toString()}`;
}

export default function MetadataPage() {
  const [data, setData] =
    useState<MetadataListResponse | null>(
      null,
    );
  const [datasetTypes, setDatasetTypes] =
    useState<DatasetType[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState("");
  const [clientFilter, setClientFilter] =
    useState("");
  const [viewFilter, setViewFilter] =
    useState("");
  const [nameFilter, setNameFilter] =
    useState("");
  const [selectedClasses, setSelectedClasses] =
    useState<string[]>([]);
  const [selectedModelKey, setSelectedModelKey] =
    useState(GLOBAL_MODEL_KEY);
  const [classMenuOpen, setClassMenuOpen] =
    useState(false);
  const classMenuRef =
    useRef<HTMLDivElement>(null);

  async function loadMetadata() {
    try {
      setLoading(true);
      setError("");

      const [
        metadataResult,
        datasetTypeResult,
      ] = await Promise.all([
        api<MetadataListResponse>(
          "/api/metadata",
        ),
        api<DatasetTypeResponse>(
          "/api/dataset-types",
        ),
      ]);

      setData(metadataResult);

      const types =
        getDatasetTypes(datasetTypeResult);

      setDatasetTypes(types);

      if (
        selectedModelKey !== GLOBAL_MODEL_KEY &&
        !types.some(
          (type) =>
            type.id === selectedModelKey,
        )
      ) {
        setSelectedModelKey(
          GLOBAL_MODEL_KEY,
        );
      }
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

  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent,
    ) {
      if (
        classMenuRef.current &&
        !classMenuRef.current.contains(
          event.target as Node,
        )
      ) {
        setClassMenuOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      );
    };
  }, []);

  const rows = useMemo(
    () => buildRows(data),
    [data],
  );

  const globalClassMap = useMemo(() => {
    const map = new Map<
      string,
      number
    >();

    for (
      const mapping of data?.classes ?? []
    ) {
      map.set(
        mapping.class_name,
        Number(mapping.class_id),
      );
    }

    return map;
  }, [data]);

  const modelOptions = useMemo<
    ModelOption[]
  >(() => {
    const options: ModelOption[] = [];

    options.push({
      key: GLOBAL_MODEL_KEY,
      label: "Default",
      map: globalClassMap,
    });

    for (const datasetType of datasetTypes) {
      const map = new Map<
        string,
        number
      >();

      for (
        const mapping of datasetType.classes ??
        []
      ) {
        map.set(
          mapping.class_name,
          Number(mapping.class_id),
        );
      }

      options.push({
        key: datasetType.id,
        label: datasetType.name,
        map,
      });
    }

    return options;
  }, [datasetTypes, globalClassMap]);

  const selectedModel = useMemo(
    () =>
      modelOptions.find(
        (option) =>
          option.key === selectedModelKey,
      ) ??
      modelOptions[0] ??
      {
        key: GLOBAL_MODEL_KEY,
        label: "Default",
        map: globalClassMap,
      },
    [
      modelOptions,
      selectedModelKey,
      globalClassMap,
    ],
  );

  const clients = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((row) => row.client)
            .filter(
              (value) => value !== "—",
            ),
        ),
      ).sort(),
    [rows],
  );

  const views = useMemo(
    () =>
      Array.from(
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
      ).sort(),
    [rows, clientFilter],
  );

  const classes = useMemo(
    () =>
      Array.from(
        selectedModel.map.keys(),
      ).sort((a, b) =>
        a.localeCompare(b),
      ),
    [selectedModel],
  );

  const allAnnotatedClasses = useMemo(
    () => {
      const values = new Set<string>();

      for (const row of rows) {
        for (
          const annotation of row.annotations
        ) {
          if (annotation.class_name) {
            values.add(
              annotation.class_name,
            );
          }
        }
      }

      return Array.from(values).sort(
        (a, b) => a.localeCompare(b),
      );
    },
    [rows],
  );

  const excludedClasses = useMemo(() => {
    const values = new Set<string>();

    for (
      const className of allAnnotatedClasses
    ) {
      if (
        !selectedModel.map.has(className)
      ) {
        values.add(className);
      }
    }

    return Array.from(values).sort(
      (a, b) => a.localeCompare(b),
    );
  }, [
    allAnnotatedClasses,
    selectedModel,
  ]);

  useEffect(() => {
    setSelectedClasses((current) =>
      current.filter((className) =>
        classes.includes(className),
      ),
    );
  }, [classes]);

  const filteredRows = useMemo<
    DisplayRow[]
  >(() => {
    const result: DisplayRow[] = [];

    for (const row of rows) {
      if (
        clientFilter &&
        row.client !== clientFilter
      ) {
        continue;
      }

      if (
        viewFilter &&
        row.view !== viewFilter
      ) {
        continue;
      }

      if (
        nameFilter &&
        !row.name
          .toLowerCase()
          .includes(
            nameFilter.toLowerCase(),
          )
      ) {
        continue;
      }

      const availableAnnotations =
        row.annotations.filter(
          (annotation) =>
            selectedModel.map.has(
              annotation.class_name,
            ),
        );

      if (
        availableAnnotations.length === 0
      ) {
        continue;
      }

      const annotations =
        selectedClasses.length === 0
          ? availableAnnotations
          : availableAnnotations.filter(
              (annotation) =>
                selectedClasses.includes(
                  annotation.class_name,
                ),
            );

      if (
        selectedClasses.length > 0 &&
        annotations.length === 0
      ) {
        continue;
      }

      const classNames = Array.from(
        new Set(
          annotations.map(
            (annotation) =>
              annotation.class_name,
          ),
        ),
      );

      const classIds = Array.from(
        new Set(
          annotations
            .map((annotation) =>
              selectedModel.map.get(
                annotation.class_name,
              ),
            )
            .filter(
              (
                value,
              ): value is number =>
                value !== undefined,
            ),
        ),
      );

      const labels = annotations
        .map((annotation) =>
          createYoloLabel(
            annotation,
            selectedModel.map,
          ),
        )
        .filter(
          (value): value is string =>
            value !== null,
        );

      if (labels.length === 0) {
        continue;
      }

      result.push({
        client: row.client,
        view: row.view,
        name: row.name,
        className:
          classNames.length > 0
            ? classNames.join(", ")
            : "—",
        classId:
          classIds.length > 0
            ? classIds.join(", ")
            : "—",
        label: labels.join("\n"),
        annotations,
      });
    }

    return result;
  }, [
    rows,
    clientFilter,
    viewFilter,
    nameFilter,
    selectedClasses,
    selectedModel,
  ]);

  const classFilterLabel =
    selectedClasses.length === 0
      ? "All classes"
      : selectedClasses.length === 1
        ? selectedClasses[0]
        : `${selectedClasses.length} classes`;

  function toggleClass(
    className: string,
  ) {
    setSelectedClasses((current) =>
      current.includes(className)
        ? current.filter(
            (value) =>
              value !== className,
          )
        : [...current, className],
    );
  }

  function clearClasses() {
    setSelectedClasses([]);
  }

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

  function downloadImages() {
    const url = createDownloadUrl(
      "/api/metadata-download/images",
      {
        client: clientFilter,
        view: viewFilter,
        name: nameFilter,
        classes: selectedClasses,
        datasetTypeId:
          selectedModelKey ===
          GLOBAL_MODEL_KEY
            ? ""
            : selectedModelKey,
      },
    );

    window.open(url, "_blank");
  }

  function downloadDataset() {
    const url = createDownloadUrl(
      "/api/metadata-download/dataset",
      {
        client: clientFilter,
        view: viewFilter,
        name: nameFilter,
        classes: selectedClasses,
        datasetTypeId:
          selectedModelKey ===
          GLOBAL_MODEL_KEY
            ? ""
            : selectedModelKey,
      },
    );

    window.open(url, "_blank");
  }

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto">
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">
              Metadata
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            

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

            <button
              type="button"
              onClick={downloadImages}
              disabled={
                loading ||
                filteredRows.length === 0
              }
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            >
              <ImageDown className="size-4" />
              Download Images
            </button>

            <button
              type="button"
              onClick={downloadDataset}
              disabled={
                loading ||
                filteredRows.length === 0
              }
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              <Download className="size-4" />
              Download Dataset
            </button>
          </div>
        </div>

        <section className="mb-5 rounded-xl border bg-card">
          <div className="grid gap-3 p-4 md:grid-cols-5">
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
                htmlFor="name"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Name
              </label>

              <input
                id="name"
                type="text"
                value={nameFilter}
                onChange={(event) =>
                  setNameFilter(
                    event.target.value,
                  )
                }
                placeholder="Search by name"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              />
            </div>

            <div
              ref={classMenuRef}
              className="relative"
            >
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Class
              </label>

              <button
                type="button"
                onClick={() =>
                  setClassMenuOpen(
                    (value) => !value,
                  )
                }
                className="flex w-full items-center justify-between rounded-lg border bg-background px-3 py-2 text-left text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <span className="truncate">
                  {classFilterLabel}
                </span>

                <span
                  className={`ml-2 text-xs transition-transform ${
                    classMenuOpen
                      ? "rotate-180"
                      : ""
                  }`}
                >
                  ▲
                </span>
              </button>

              {classMenuOpen && (
                <div className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
                  <button
                    type="button"
                    onClick={clearClasses}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
                  >
                    <span
                      className={`flex size-3.5 items-center justify-center rounded border ${
                        selectedClasses.length ===
                        0
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input"
                      }`}
                    >
                      {selectedClasses.length ===
                        0 && "✓"}
                    </span>

                    <span>
                      All classes
                    </span>
                  </button>

                  {classes.map(
                    (className) => {
                      const checked =
                        selectedClasses.includes(
                          className,
                        );

                      return (
                        <button
                          key={className}
                          type="button"
                          onClick={() =>
                            toggleClass(
                              className,
                            )
                          }
                          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
                        >
                          <span
                            className={`flex size-3.5 items-center justify-center rounded border ${
                              checked
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-input"
                            }`}
                          >
                            {checked && "✓"}
                          </span>

                          <span>
                            {className}
                          </span>
                        </button>
                      );
                    },
                  )}
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="model-type"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Model Type
              </label>

              <select
                id="model-type"
                value={selectedModelKey}
                onChange={(event) => {
                  setSelectedModelKey(
                    event.target.value,
                  );
                  setSelectedClasses([]);
                }}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {modelOptions.map(
                  (option) => (
                    <option
                      key={option.key}
                      value={option.key}
                    >
                      {option.label}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-sm font-medium">
                Classes excluded from{" "}
                {selectedModel.label}
              </p>

              <p className="mt-0.5 text-xs text-muted-foreground">
                These classes remain in the
                metadata source but are hidden
                from rows and labels when they
                are not available in the
                selected model.
              </p>
            </div>

            <span className="text-xs text-muted-foreground">
              {excludedClasses.length} excluded
            </span>
          </div>

          <div className="flex flex-wrap gap-2 px-4 py-3">
            {excludedClasses.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                None
              </span>
            ) : (
              excludedClasses.map(
                (className) => (
                  <span
                    key={className}
                    className="rounded-md border bg-muted px-2 py-1 text-xs"
                  >
                    {className}
                  </span>
                ),
              )
            )}
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
              <table className="w-full min-w-[900px] text-sm">
                <thead className="sticky top-0 z-10 border-b bg-muted text-center">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">
                      Client
                    </th>
                    <th className="min-w-[180px] px-4 py-3 text-left font-medium">
                      View
                    </th>
                    <th className="w-[38%] min-w-[220px] px-4 py-3 text-left font-medium">
                      Name
                    </th>
                    <th className="w-[1%] max-w-[10px] px-4 py-3 text-center font-medium">
                      Class Name
                    </th>
                    <th className="w-[10%] min-w-[20px] text-center px-4 py-3 text-center font-medium">
                      Class ID
                    </th>
                    <th className="w-[20%] min-w-[420px] px-4 py-3 text-left font-medium">
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

                        <td className="w-[38%] min-w-[420px] px-4 py-3">
                          <span
                            className="block break-all whitespace-normal"
                            title={row.name}
                          >
                            {row.name}
                          </span>
                        </td>

                        <td className="w-[10%] px-4 text-center py-3  break-words">
                          {row.className}
                        </td>

                        <td className="px-4 py-3 font-mono text-center text-xs">
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
