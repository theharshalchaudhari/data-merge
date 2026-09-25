"use client";

import {
  ArrowLeft,
  ChevronRight,
  Download,
  Eye,
  File,
  FileImage,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "../../../lib/api";
import { useAuth } from "../../../hooks/use-auth";
import Folder from "../../../components/Folder";

type Scope = "metadata" | "raw";

type Client = {
  id: string;
  name: string;
  metadata_count: number;
  has_metadata: boolean;
  has_raw: boolean;
};

type TreeItem = {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  extension?: string;
};

type SelectedFile = {
  clientId: string;
  scope: Scope;
  path: string;
  name: string;
};

type Annotation = {
  classId?: number;
  className?: string;
  geometry?: {
    format?: string;
    values?: number[];
  };
};

type AnnotationResult = {
  id: string;
  name: string;
  annotationType: string;
  annotations: Annotation[];
  imageHash: string | null;
  rootFolders: string[];
  originalRootFolders: string[];
  sourceLocations: string[];
  view: {
    id: string;
    name: string;
  };
};

type NavigationEntry = {
  title: string;
  scope?: Scope;
  path?: string;
};

function extension(name: string) {
  const index = name.lastIndexOf(".");

  return index === -1
    ? ""
    : name.slice(index + 1).toLowerCase();
}

function isImage(name: string) {
  return [
    "jpg",
    "jpeg",
    "png",
    "webp",
    "gif",
    "bmp",
    "tif",
    "tiff",
  ].includes(extension(name));
}

function isText(name: string) {
  return [
    "txt",
    "json",
    "csv",
    "xml",
  ].includes(extension(name));
}

function formatBytes(value?: number) {
  if (!value) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  let size = value;
  let index = 0;

  while (
    size >= 1024 &&
    index < units.length - 1
  ) {
    size /= 1024;
    index++;
  }

  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function getFilePreviewUrl(
  file: SelectedFile,
) {
  return (
    `/api/file-preview` +
    `?clientId=${encodeURIComponent(file.clientId)}` +
    `&scope=${encodeURIComponent(file.scope)}` +
    `&path=${encodeURIComponent(file.path)}`
  );
}

function AnnotationImage({
  imageUrl,
  annotations,
}: {
  imageUrl: string;
  annotations: AnnotationResult[];
}) {
  const boxes = annotations.flatMap(
    (record) =>
      record.annotations
        .filter(
          (annotation) =>
            annotation.geometry?.format ===
            "yolo_bbox",
        )
        .map((annotation, index) => {
          const values =
            annotation.geometry?.values;

          if (!values || values.length < 5) {
            return null;
          }

          const [
            classId,
            centerX,
            centerY,
            width,
            height,
          ] = values;

          return {
            id: `${record.id}-${index}`,
            className:
              annotation.className ??
              String(classId),
            centerX,
            centerY,
            width,
            height,
          };
        })
        .filter(
          (
            value,
          ): value is NonNullable<typeof value> =>
            value !== null,
        ),
  );

  return (
    <div className="flex items-center justify-center rounded-xl border bg-muted/20 p-4">
      <div className="relative inline-block max-w-full">
        <img
          src={imageUrl}
          alt="Annotated image"
          className="block max-h-[65vh] max-w-full object-contain"
        />

        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
        >
          {boxes.map((box) => {
            const x =
              box.centerX -
              box.width / 2;

            const y =
              box.centerY -
              box.height / 2;

            return (
              <g key={box.id}>
                <rect
                  x={x}
                  y={y}
                  width={box.width}
                  height={box.height}
                  fill="none"
                  stroke="red"
                  strokeWidth="0.003"
                />

                <text
                  x={Math.max(0, x)}
                  y={Math.max(0.02, y)}
                  fill="white"
                  stroke="black"
                  strokeWidth="0.0015"
                  fontSize="0.018"
                  paintOrder="stroke"
                >
                  {box.className}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function PreviewPanel({
  file,
  onClose,
}: {
  file: SelectedFile;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] =
    useState(true);
  const [error, setError] = useState("");
  const [annotations, setAnnotations] =
    useState<AnnotationResult[]>([]);
  const [
    annotationLoading,
    setAnnotationLoading,
  ] = useState(false);
  const [
    showAnnotation,
    setShowAnnotation,
  ] = useState(false);

  const image = isImage(file.name);
  const textFile = isText(file.name);

  const fileUrl =
    getFilePreviewUrl(file);

  useEffect(() => {
    if (!textFile) {
      setLoading(false);
      return;
    }

    let active = true;

    async function loadText() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          fileUrl,
          {
            credentials: "include",
            cache: "no-store",
          },
        );

        if (!response.ok) {
          const body =
            await response
              .json()
              .catch(() => null);

          throw new Error(
            body?.message ??
              "Unable to load file.",
          );
        }

        const value =
          await response.text();

        if (active) {
          setText(value);
        }
      } catch (value) {
        if (active) {
          setError(
            value instanceof Error
              ? value.message
              : "Unable to load file.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadText();

    return () => {
      active = false;
    };
  }, [fileUrl, textFile]);

  useEffect(() => {
    if (image) {
      setLoading(false);
    }
  }, [image]);

  async function loadAnnotation() {
    try {
      setAnnotationLoading(true);
      setError("");

      const result =
        await api<AnnotationResult[]>(
          `/api/download/${file.clientId}/annotation?name=${encodeURIComponent(file.name)}`,
        );

      if (!result.length) {
        throw new Error(
          "No annotation found.",
        );
      }

      setAnnotations(result);
      setShowAnnotation(true);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "No annotation found.",
      );
    } finally {
      setAnnotationLoading(false);
    }
  }

  async function downloadFile() {
    try {
      const response = await fetch(
        `/api/file-download?clientId=${encodeURIComponent(
          file.clientId,
        )}&scope=${encodeURIComponent(
          file.scope,
        )}&path=${encodeURIComponent(
          file.path,
        )}`,
        {
          credentials: "include",
          cache: "no-store",
        },
      );

      if (!response.ok) {
        const body =
          await response
            .json()
            .catch(() => null);

        throw new Error(
          body?.message ??
            "Download failed.",
        );
      }

      const blob =
        await response.blob();

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;
      link.download = file.name;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Download failed.",
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-black/50">
      <div className="ml-auto flex h-full w-full max-w-5xl flex-col bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="min-w-0">
            <p className="truncate font-semibold">
              {file.name}
            </p>

            <p className="truncate text-xs text-muted-foreground">
              {file.scope}/{file.path}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {image && (
              <button
                type="button"
                onClick={() =>
                  void loadAnnotation()
                }
                disabled={annotationLoading}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
              >
                {annotationLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Eye className="size-4" />
                )}
                View Annotation
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                void downloadFile()
              }
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent"
            >
              <Download className="size-4" />
              Download
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 hover:bg-accent"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading && (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && !loading && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {!loading &&
            !error &&
            image && (
              <div className="flex min-h-full items-center justify-center rounded-xl border bg-muted/20 p-4">
                <img
                  src={fileUrl}
                  alt={file.name}
                  className="max-h-[75vh] max-w-full object-contain"
                />
              </div>
            )}

          {!loading &&
            !error &&
            textFile && (
              <pre className="min-h-full whitespace-pre-wrap wrap-break-words rounded-xl border bg-muted/20 p-5 font-mono text-xs">
                {text}
              </pre>
            )}

          {!loading &&
            !error &&
            !image &&
            !textFile && (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Preview is not available for this file type.
              </div>
            )}
        </div>

        {showAnnotation && (
          <div className="max-h-[55vh] overflow-auto border-t bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">
                  Annotation Preview
                </h3>

                <p className="text-xs text-muted-foreground">
                  Bounding boxes are rendered over the original image.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowAnnotation(false)
                }
                className="rounded-lg p-2 hover:bg-accent"
              >
                <X className="size-4" />
              </button>
            </div>

            <AnnotationImage
              imageUrl={fileUrl}
              annotations={annotations}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function FileCard({
  item,
  onOpen,
  onDownload,
}: {
  item: TreeItem;
  onOpen: () => void;
  onDownload: () => void;
}) {
  const image = isImage(item.name);

  return (
    <div className="group rounded-xl border bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-sm">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full flex-col items-center"
      >
        {image ? (
          <FileImage className="size-12 text-muted-foreground" />
        ) : (
          <File className="size-12 text-muted-foreground" />
        )}

        <span className="mt-3 w-full truncate text-center text-sm font-medium">
          {item.name}
        </span>

        {item.size !== undefined && (
          <span className="mt-1 text-xs text-muted-foreground">
            {formatBytes(item.size)}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={onDownload}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border px-2 py-1.5 text-xs opacity-0 transition group-hover:opacity-100 hover:bg-accent"
      >
        <Download className="size-3.5" />
        Download
      </button>
    </div>
  );
}

function FolderGrid({
  items,
  onFolder,
  onFile,
  onDownload,
}: {
  items: TreeItem[];
  onFolder: (
    item: TreeItem,
  ) => void;
  onFile: (
    item: TreeItem,
  ) => void;
  onDownload: (
    item: TreeItem,
  ) => void;
}) {
  const folders = items.filter(
    (item) =>
      item.type === "directory",
  );

  const files = items.filter(
    (item) =>
      item.type === "file",
  );

  return (
    <div className="p-6">
      {folders.length > 0 && (
        <div className="mb-8">
          <h3 className="mb-4 text-sm font-semibold">
            Folders
          </h3>

          <div className="flex flex-wrap gap-3">
            {folders.map((item) => (
              <Folder
                key={item.path}
                size={1}
                color="#70A1FF"
                label={item.name}
                onClick={() =>
                  onFolder(item)
                }
              />
            ))}
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div>
          <h3 className="mb-4 text-sm font-semibold">
            Files
          </h3>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {files.map((item) => (
              <FileCard
                key={item.path}
                item={item}
                onOpen={() =>
                  onFile(item)
                }
                onDownload={() =>
                  onDownload(item)
                }
              />
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          This folder is empty.
        </div>
      )}
    </div>
  );
}

export default function DownloadPage() {
  const {
    user,
    loading: authLoading,
  } = useAuth();

  const [clients, setClients] =
    useState<Client[]>([]);

  const [
    selectedClient,
    setSelectedClient,
  ] = useState<Client | null>(null);

  const [scope, setScope] =
    useState<Scope | null>(null);

  const [
    currentPath,
    setCurrentPath,
  ] = useState("");

  const [items, setItems] =
    useState<TreeItem[]>([]);

  const [
    navigation,
    setNavigation,
  ] = useState<NavigationEntry[]>(
    [],
  );

  const [
    selectedFile,
    setSelectedFile,
  ] = useState<SelectedFile | null>(
    null,
  );

  const [loading, setLoading] =
    useState(true);

  const [
    folderLoading,
    setFolderLoading,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const canSeeRaw =
    user?.role === "admin" ||
    user?.role === "editor";

  async function loadClients() {
    try {
      setLoading(true);
      setError("");

      const result =
        await api<Client[]>(
          "/api/download/clients",
        );

      const visibleClients =
        result.filter(
          (client) =>
            client.has_metadata ||
            (canSeeRaw &&
              client.has_raw),
        );

      setClients(visibleClients);
      setSelectedClient(null);
      setScope(null);
      setCurrentPath("");
      setItems([]);
      setNavigation([]);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Failed to load clients.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading) {
      void loadClients();
    }
  }, [authLoading, canSeeRaw]);

  async function loadFolder(
    clientId: string,
    nextScope: Scope,
    path: string,
  ) {
    try {
      setFolderLoading(true);
      setError("");

      const result =
        await api<TreeItem[]>(
          `/api/download/${clientId}/tree?scope=${nextScope}&path=${encodeURIComponent(path)}`,
        );

      setItems(result);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Unable to load folder.",
      );
    } finally {
      setFolderLoading(false);
    }
  }

  function openClient(client: Client) {
    setSelectedClient(client);
    setScope(null);
    setCurrentPath("");
    setItems([]);

    setNavigation([
      {
        title: client.name,
      },
    ]);
  }

  async function openScope(
    nextScope: Scope,
  ) {
    if (!selectedClient) {
      return;
    }

    if (
      nextScope === "raw" &&
      !canSeeRaw
    ) {
      return;
    }

    setScope(nextScope);
    setCurrentPath("");

    setNavigation([
      {
        title: selectedClient.name,
      },
      {
        title: nextScope,
        scope: nextScope,
        path: "",
      },
    ]);

    await loadFolder(
      selectedClient.id,
      nextScope,
      "",
    );
  }

  async function openFolder(
    item: TreeItem,
  ) {
    if (
      !selectedClient ||
      !scope
    ) {
      return;
    }

    setCurrentPath(item.path);

    setNavigation((previous) => [
      ...previous,
      {
        title: item.name,
        scope,
        path: item.path,
      },
    ]);

    await loadFolder(
      selectedClient.id,
      scope,
      item.path,
    );
  }

  function openFile(item: TreeItem) {
    if (
      !selectedClient ||
      !scope
    ) {
      return;
    }

    setSelectedFile({
      clientId: selectedClient.id,
      scope,
      path: item.path,
      name: item.name,
    });
  }

  async function goBack() {
    if (!selectedClient) {
      return;
    }

    if (navigation.length <= 1) {
      setSelectedClient(null);
      setScope(null);
      setCurrentPath("");
      setItems([]);
      setNavigation([]);
      return;
    }

    const nextNavigation =
      navigation.slice(0, -1);

    setNavigation(nextNavigation);

    const previous =
      nextNavigation[
        nextNavigation.length - 1
      ];

    if (!previous.scope) {
      setScope(null);
      setCurrentPath("");
      setItems([]);
      return;
    }

    const nextScope =
      previous.scope;

    const nextPath =
      previous.path ?? "";

    setScope(nextScope);
    setCurrentPath(nextPath);

    await loadFolder(
      selectedClient.id,
      nextScope,
      nextPath,
    );
  }

  async function downloadFile(
    item: TreeItem,
  ) {
    if (
      !selectedClient ||
      !scope
    ) {
      return;
    }

    try {
      const response =
        await fetch(
          `/api/file-download?clientId=${encodeURIComponent(
            selectedClient.id,
          )}&scope=${encodeURIComponent(
            scope,
          )}&path=${encodeURIComponent(
            item.path,
          )}`,
          {
            credentials: "include",
            cache: "no-store",
          },
        );

      if (!response.ok) {
        const body =
          await response
            .json()
            .catch(() => null);

        throw new Error(
          body?.message ??
            "Download failed.",
        );
      }

      const blob =
        await response.blob();

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;
      link.download = item.name;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Download failed.",
      );
    }
  }

  async function downloadDataset(
    type:
      | "images"
      | "labels"
      | "both",
  ) {
    if (!selectedClient) {
      return;
    }

    try {
      const response =
        await fetch(
          `/api/dataset-download?clientId=${encodeURIComponent(
            selectedClient.id,
          )}&type=${type}`,
          {
            credentials: "include",
            cache: "no-store",
          },
        );

      if (!response.ok) {
        const body =
          await response
            .json()
            .catch(() => null);

        throw new Error(
          body?.message ??
            "Dataset download failed.",
        );
      }

      const blob =
        await response.blob();

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;

      link.download =
        type === "both"
          ? `${selectedClient.name}-dataset.zip`
          : `${selectedClient.name}-${type}.zip`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Dataset download failed.",
      );
    }
  }

  const breadcrumbs =
    useMemo(
      () =>
        navigation.map(
          (entry) => entry.title,
        ),
      [navigation],
    );

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">
              Data Explorer
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Browse and download dataset files.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadClients()
            }
            disabled={
              loading || authLoading
            }
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
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
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {!selectedClient ? (
          <section className="rounded-xl border bg-card p-6">
            <div className="mb-6">
              <h2 className="text-sm font-semibold">
                Clients
              </h2>

              <p className="mt-1 text-xs text-muted-foreground">
                Select a client to browse its data.
              </p>
            </div>

            {loading ? (
              <div className="flex min-h-72 items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : clients.length === 0 ? (
              <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground">
                No clients with data found.
              </div>
            ) : (
              <div className="flex flex-wrap gap-4">
                {clients.map((client) => (
                  <Folder
                    key={client.id}
                    size={1.2}
                    color="#70A1FF"
                    label={client.name}
                    description={`${client.metadata_count} metadata files`}
                    onClick={() =>
                      openClient(client)
                    }
                  />
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="rounded-xl border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b p-4">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    void goBack()
                  }
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent"
                >
                  <ArrowLeft className="size-4" />
                  Back
                </button>

                <div className="flex min-w-0 items-center gap-1 overflow-hidden">
                  {breadcrumbs.map(
                    (
                      breadcrumb,
                      index,
                    ) => (
                      <div
                        key={`${breadcrumb}-${index}`}
                        className="flex shrink-0 items-center gap-1"
                      >
                        {index > 0 && (
                          <ChevronRight className="size-4 text-muted-foreground" />
                        )}

                        <span
                          className={
                            index ===
                            breadcrumbs.length -
                              1
                              ? "font-medium"
                              : "text-muted-foreground"
                          }
                        >
                          {breadcrumb}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>

              {scope && (
                <div className="flex flex-wrap gap-2">
                  {canSeeRaw && (
                    <button
                      type="button"
                      onClick={() =>
                        void openScope(
                          "raw",
                        )
                      }
                      className={`rounded-lg border px-3 py-2 text-sm hover:bg-accent ${
                        scope === "raw"
                          ? "bg-accent"
                          : ""
                      }`}
                    >
                      Raw Data
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      void openScope(
                        "metadata",
                      )
                    }
                    className={`rounded-lg border px-3 py-2 text-sm hover:bg-accent ${
                      scope ===
                      "metadata"
                        ? "bg-accent"
                        : ""
                    }`}
                  >
                    Metadata
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void downloadDataset(
                        "images",
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent"
                  >
                    <Download className="size-4" />
                    Images
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void downloadDataset(
                        "labels",
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent"
                  >
                    <Download className="size-4" />
                    Labels
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void downloadDataset(
                        "both",
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent"
                  >
                    <Download className="size-4" />
                    Dataset
                  </button>
                </div>
              )}
            </div>

            {!scope ? (
              <div className="p-8">
                <h2 className="mb-6 text-sm font-semibold">
                  {selectedClient.name}
                </h2>

                <div className="flex flex-wrap gap-4">
                  {selectedClient.has_metadata && (
                    <Folder
                      size={1.2}
                      color="#70A1FF"
                      label="metadata"
                      description="Canonical metadata"
                      onClick={() =>
                        void openScope(
                          "metadata",
                        )
                      }
                    />
                  )}

                  {canSeeRaw &&
                    selectedClient.has_raw && (
                      <Folder
                        size={1.2}
                        color="#70A1FF"
                        label="raw"
                        description="Original uploaded data"
                        onClick={() =>
                          void openScope(
                            "raw",
                          )
                        }
                      />
                    )}
                </div>
              </div>
            ) : folderLoading ? (
              <div className="flex min-h-72 items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <FolderGrid
                items={items}
                onFolder={openFolder}
                onFile={openFile}
                onDownload={
                  downloadFile
                }
              />
            )}
          </section>
        )}
      </div>

      {selectedFile && (
        <PreviewPanel
          file={selectedFile}
          onClose={() =>
            setSelectedFile(null)
          }
        />
      )}
    </main>
  );
}