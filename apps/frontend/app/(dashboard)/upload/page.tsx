"use client";

import {
  ChangeEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Files,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Upload,
  X,
} from "lucide-react";
import type { Client, View } from "@data-manage/types";
import { api } from "../../../lib/api";
import { useAuth } from "../../../hooks/use-auth";

type BrowserFile = File & {
  webkitRelativePath?: string;
};

type ScanError = {
  file: string;
  message: string;
};

type ScanResult = {
  rootFolder: string;
  files: number;
  images: number;
  txt: number;
  validPairs: number;
  backgroundImages: number;
  corruptedTxt: number;
  txtWithoutImage: number;
  imageWithoutTxt: number;
  canUpload: boolean;
  errors: ScanError[];
};

type UploadResult = {
  uploaded: number;
  merged: number;
  skipped: number;
  conflicts: number;
  annotationCount: number;
  images: number;
  annotationFiles: number;
};

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".bmp",
]);

function normalizeRelativePath(value: string) {
  return value
    .replaceAll("\\", "/")
    .split("/")
    .filter(Boolean)
    .join("/");
}

function getRelativePath(file: BrowserFile) {
  const relativePath = file.webkitRelativePath?.trim();

  return relativePath
    ? normalizeRelativePath(relativePath)
    : normalizeRelativePath(file.name);
}

function getRootFolder(relativePath: string) {
  const parts = normalizeRelativePath(relativePath)
    .split("/")
    .filter(Boolean);

  return parts.length > 1 ? parts[0] : "";
}

function getPairKey(relativePath: string) {
  return normalizeRelativePath(relativePath)
    .replace(/\.[^.]+$/, "")
    .toLowerCase();
}

function getExtension(file: BrowserFile) {
  const name = file.name.toLowerCase();
  const index = name.lastIndexOf(".");

  return index === -1 ? "" : name.slice(index);
}

function isImage(file: BrowserFile) {
  return IMAGE_EXTENSIONS.has(getExtension(file));
}

function isLabel(file: BrowserFile) {
  return file.name.toLowerCase().endsWith(".txt");
}

function validateYolo(content: string) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      valid: true,
      annotationCount: 0,
      errors: [] as string[],
      background: true,
    };
  }

  const errors: string[] = [];

  for (let index = 0; index < lines.length; index++) {
    const parts = lines[index].split(/\s+/);

    if (parts.length !== 5) {
      errors.push(
        `Line ${index + 1}: expected 5 values.`,
      );
      continue;
    }

    const [classId, x, y, width, height] =
      parts.map(Number);

    if (!Number.isInteger(classId) || classId < 0) {
      errors.push(
        `Line ${index + 1}: invalid class ID.`,
      );
      continue;
    }

    if (!Number.isFinite(x) || x < 0 || x > 1) {
      errors.push(
        `Line ${index + 1}: invalid x.`,
      );
      continue;
    }

    if (!Number.isFinite(y) || y < 0 || y > 1) {
      errors.push(
        `Line ${index + 1}: invalid y.`,
      );
      continue;
    }

    if (
      !Number.isFinite(width) ||
      width <= 0 ||
      width > 1
    ) {
      errors.push(
        `Line ${index + 1}: invalid width.`,
      );
      continue;
    }

    if (
      !Number.isFinite(height) ||
      height <= 0 ||
      height > 1
    ) {
      errors.push(
        `Line ${index + 1}: invalid height.`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    annotationCount: lines.length,
    errors,
    background: false,
  };
}

function Stat({
  label,
  value,
  tone = "default",
  icon,
}: {
  label: string;
  value: number | string;
  tone?: "default" | "success" | "warning" | "danger";
  icon?: React.ReactNode;
}) {
  const valueClass =
    tone === "success"
      ? "text-primary"
      : tone === "warning"
        ? "text-accent-foreground"
        : tone === "danger"
          ? "text-destructive"
          : "text-foreground";

  return (
    <div className="rounded-lg border bg-background px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {label}
        </p>

        {icon}
      </div>

      <p
        className={`mt-0.5 text-lg font-semibold ${valueClass}`}
      >
        {value}
      </p>
    </div>
  );
}

export default function UploadPage() {
  const { user } = useAuth();

  const folderInputRef =
    useRef<HTMLInputElement>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [views, setViews] = useState<View[]>([]);

  const [clientId, setClientId] = useState("");
  const [viewId, setViewId] = useState("");

  const [files, setFiles] = useState<BrowserFile[]>([]);
  const [folderName, setFolderName] = useState("");
  const [renameFolder, setRenameFolder] =
    useState("");

  const [scanResult, setScanResult] =
    useState<ScanResult | null>(null);

  const [uploadResult, setUploadResult] =
    useState<UploadResult | null>(null);

  const [scanning, setScanning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingClients, setLoadingClients] =
    useState(true);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const canRename =
    user?.role === "admin" ||
    user?.role === "editor";

  useEffect(() => {
    async function loadClients() {
      try {
        setLoadingClients(true);
        setError("");

        setClients(
          await api<Client[]>("/api/clients"),
        );
      } catch (value) {
        setError(
          value instanceof Error
            ? value.message
            : "Failed to load clients.",
        );
      } finally {
        setLoadingClients(false);
      }
    }

    void loadClients();
  }, []);

  useEffect(() => {
    if (!clientId) {
      setViews([]);
      setViewId("");
      return;
    }

    async function loadViews() {
      try {
        setError("");

        setViews(
          await api<View[]>(
            `/api/views?clientId=${encodeURIComponent(clientId)}`,
          ),
        );

        setViewId("");
      } catch (value) {
        setViews([]);
        setViewId("");

        setError(
          value instanceof Error
            ? value.message
            : "Failed to load views.",
        );
      }
    }

    void loadViews();
  }, [clientId]);

  function resetDataset() {
    setFiles([]);
    setFolderName("");
    setRenameFolder("");
    setScanResult(null);
    setUploadResult(null);
    setMessage("");
    setError("");
    setModalOpen(false);

    if (folderInputRef.current) {
      folderInputRef.current.value = "";
    }
  }

  function handleFolderSelect(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    setError("");
    setMessage("");
    setScanResult(null);
    setUploadResult(null);

    const selected = Array.from(
      event.target.files ?? [],
    ) as BrowserFile[];

    if (!selected.length) {
      resetDataset();
      return;
    }

    const root = getRootFolder(
      getRelativePath(selected[0]),
    );

    if (!root) {
      resetDataset();

      setError(
        "Unable to determine the selected dataset folder.",
      );

      return;
    }

    const invalidRootFiles = selected.filter(
      (file) =>
        !getRelativePath(file).startsWith(
          `${root}/`,
        ),
    );

    if (invalidRootFiles.length) {
      resetDataset();

      setError(
        "The selected files do not belong to one dataset folder.",
      );

      return;
    }

    setFiles(selected);
    setFolderName(root);
    setRenameFolder(root);

    void scanFolder(selected, root);
  }

  async function scanFolder(
    selectedFiles = files,
    selectedRoot = folderName,
  ) {
    if (
      !selectedFiles.length ||
      !selectedRoot
    ) {
      return;
    }

    setScanning(true);
    setError("");
    setMessage("");
    setScanResult(null);
    setUploadResult(null);
    setModalOpen(true);

    try {
      const imageMap = new Map<
        string,
        BrowserFile
      >();

      const labelMap = new Map<
        string,
        BrowserFile
      >();

      let imageCount = 0;
      let txtCount = 0;

      for (const file of selectedFiles) {
        const relativePath = getRelativePath(file);

        if (
          !relativePath.startsWith(
            `${selectedRoot}/`,
          )
        ) {
          continue;
        }

        if (isImage(file)) {
          imageMap.set(
            getPairKey(relativePath),
            file,
          );

          imageCount++;
        } else if (isLabel(file)) {
          labelMap.set(
            getPairKey(relativePath),
            file,
          );

          txtCount++;
        }
      }

      const errors: ScanError[] = [];

      let validPairs = 0;
      let backgroundImages = 0;
      let corruptedTxt = 0;
      let txtWithoutImage = 0;
      let imageWithoutTxt = 0;

      for (const [key, image] of imageMap) {
        const label = labelMap.get(key);

        if (!label) {
          imageWithoutTxt++;

          errors.push({
            file: getRelativePath(image),
            message: "Image without TXT",
          });

          continue;
        }

        const content = await label.text();
        const validation =
          validateYolo(content);

        if (validation.background) {
          backgroundImages++;
          validPairs++;
          continue;
        }

        if (!validation.valid) {
          corruptedTxt++;

          errors.push({
            file: getRelativePath(label),
            message: "Corrupted TXT",
          });

          continue;
        }

        validPairs++;
      }

      for (const [key, label] of labelMap) {
        if (imageMap.has(key)) {
          continue;
        }

        txtWithoutImage++;

        errors.push({
          file: getRelativePath(label),
          message: "TXT without image",
        });
      }

      const result: ScanResult = {
        rootFolder: selectedRoot,
        files: selectedFiles.length,
        images: imageCount,
        txt: txtCount,
        validPairs,
        backgroundImages,
        corruptedTxt,
        txtWithoutImage,
        imageWithoutTxt,
        canUpload:
          imageCount > 0 &&
          corruptedTxt === 0 &&
          txtWithoutImage === 0 &&
          imageWithoutTxt === 0,
        errors,
      };

      setScanResult(result);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Failed to scan dataset.",
      );
    } finally {
      setScanning(false);
    }
  }

  async function uploadDataset() {
    if (
      !scanResult ||
      !scanResult.canUpload
    ) {
      return;
    }

    if (!clientId || !viewId) {
      setError(
        "Select a client and view before uploading.",
      );

      return;
    }

    const root = getSelectedRoot(files);

    if (!root) {
      setError(
        "Unable to determine the dataset folder.",
      );

      return;
    }

    const finalRoot =
      canRename && renameFolder.trim()
        ? normalizeRelativePath(
            renameFolder.trim(),
          ).replace(/\//g, "_")
        : root;

    if (!finalRoot) {
      setError("Enter a valid folder name.");
      return;
    }

    const validFiles = files.filter((file) => {
      const relativePath = getRelativePath(file);

      return (
        relativePath.startsWith(`${root}/`) &&
        (isImage(file) || isLabel(file))
      );
    });

    if (!validFiles.length) {
      setError(
        "No supported dataset files were selected.",
      );

      return;
    }

    const relativePaths = validFiles.map(
      (file) => {
        const original = getRelativePath(file);

        return canRename &&
          finalRoot !== root
          ? `${finalRoot}/${original.slice(
              root.length + 1,
            )}`
          : original;
      },
    );

    setUploading(true);
    setError("");
    setMessage("");

    try {
      const form = new FormData();

      form.append("clientId", clientId);
      form.append("viewId", viewId);
      form.append("rootFolder", finalRoot);

      form.append(
        "relativePaths",
        JSON.stringify(relativePaths),
      );

      for (const file of validFiles) {
        form.append(
          "files",
          file,
          file.name,
        );
      }

      const result = await api<UploadResult>(
        "/api/upload",
        {
          method: "POST",
          body: form,
        },
      );

      setUploadResult(result);
      setMessage(
        "Dataset uploaded successfully.",
      );
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Dataset upload failed.",
      );
    } finally {
      setUploading(false);
    }
  }

  function getSelectedRoot(
    selectedFiles: BrowserFile[],
  ) {
    const roots = new Set<string>();

    for (const file of selectedFiles) {
      const root = getRootFolder(
        getRelativePath(file),
      );

      if (root) {
        roots.add(root);
      }
    }

    return roots.size === 1
      ? Array.from(roots)[0]
      : "";
  }

  return (
    <main className="min-h-[calc(100vh-2rem)] p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Upload Dataset
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Select a complete dataset folder to
              validate and upload.
            </p>
          </div>

          {files.length > 0 && (
            <button
              type="button"
              onClick={resetDataset}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent"
            >
              <X className="size-4" />
              Clear
            </button>
          )}
        </div>

        {error && !modalOpen && (
          <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {message && !modalOpen && (
          <div className="mb-5 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
            {message}
          </div>
        )}

        <section className="rounded-2xl border bg-card p-8">
          <div className="flex min-h-105 flex-col items-center justify-center text-center">
            <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-primary/10">
              <FolderOpen className="size-10 text-primary" />
            </div>

            <h2 className="text-lg font-semibold">
              {folderName ||
                "Choose a dataset folder"}
            </h2>

            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Select the complete folder containing
              images and their YOLO TXT files. The
              folder will be scanned automatically.
            </p>

            <input
              ref={folderInputRef}
              type="file"
              multiple
              {...({
                webkitdirectory: "",
              } as Record<string, string>)}
              onChange={handleFolderSelect}
              className="hidden"
            />

            <button
              type="button"
              onClick={() =>
                folderInputRef.current?.click()
              }
              disabled={
                loadingClients || scanning
              }
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              {scanning ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FolderOpen className="size-4" />
              )}

              {scanning
                ? "Scanning..."
                : "Choose Folder"}
            </button>

            {files.length > 0 && (
              <p className="mt-4 text-xs text-muted-foreground">
                {files.length.toLocaleString()} files
                selected
              </p>
            )}
          </div>
        </section>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-md">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-5">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Dataset
                </p>

                <h2 className="mt-1 truncate text-lg font-semibold">
                  {folderName}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setModalOpen(false)
                }
                disabled={
                  scanning || uploading
                }
                className="rounded-lg p-2 hover:bg-accent disabled:opacity-50"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="max-h-[78vh] overflow-y-auto p-6">
              {scanning ? (
                <div className="flex min-h-90 flex-col items-center justify-center text-center">
                  <Loader2 className="size-9 animate-spin text-primary" />

                  <p className="mt-5 font-medium">
                    Scanning dataset
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Checking images, TXT files and
                    matching pairs...
                  </p>
                </div>
              ) : scanResult ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Stat
                      label="Total files"
                      value={scanResult.files}
                      icon={
                        <Files className="size-4 text-muted-foreground" />
                      }
                    />

                    <Stat
                      label="Total images"
                      value={scanResult.images}
                      icon={
                        <ImageIcon className="size-4 text-muted-foreground" />
                      }
                    />

                    <Stat
                      label="Total TXT"
                      value={scanResult.txt}
                      icon={
                        <FileText className="size-4 text-muted-foreground" />
                      }
                    />

                    <Stat
                      label="Valid pairs"
                      value={scanResult.validPairs}
                      tone="success"
                      icon={
                        <CheckCircle2 className="size-4 text-primary" />
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Stat
                      label="Background images"
                      value={
                        scanResult.backgroundImages
                      }
                      tone="success"
                    />

                    <Stat
                      label="Corrupted TXT"
                      value={scanResult.corruptedTxt}
                      tone={
                        scanResult.corruptedTxt
                          ? "danger"
                          : "default"
                      }
                    />

                    <Stat
                      label="TXT without image"
                      value={
                        scanResult.txtWithoutImage
                      }
                      tone={
                        scanResult.txtWithoutImage
                          ? "danger"
                          : "default"
                      }
                    />

                    <Stat
                      label="Image without TXT"
                      value={
                        scanResult.imageWithoutTxt
                      }
                      tone={
                        scanResult.imageWithoutTxt
                          ? "danger"
                          : "default"
                      }
                    />
                  </div>

                  <div
                    className={`rounded-xl border p-1 ${
                      scanResult.canUpload
                        ? "border-primary/30 bg-primary/5"
                        : "border-destructive/30 bg-destructive/5"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {scanResult.canUpload ? (
                        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
                      ) : (
                        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
                      )}

                      <div>
                        <p className="text-sm font-semibold">
                          {scanResult.canUpload
                            ? "Dataset is ready"
                            : "Dataset needs attention"}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {scanResult.canUpload
                            ? "All images have valid TXT files. Empty TXT files are treated as background_images."
                            : "Fix the corrupted or unmatched files before uploading."}
                        </p>
                      </div>
                    </div>
                  </div>

                  {!scanResult.canUpload &&
                    scanResult.errors.length > 0 && (
                      <div className="rounded-xl border p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-semibold">
                            Issues found
                          </p>

                          <span className="text-xs text-muted-foreground">
                            {scanResult.errors.length}{" "}
                            files
                          </span>
                        </div>

                        <div className="max-h-36 space-y-1.5 overflow-y-auto">
                          {scanResult.errors
                            .slice(0, 30)
                            .map((item, index) => (
                              <div
                                key={`${item.file}-${index}`}
                                className="flex gap-2 text-xs"
                              >
                                <span className="font-medium">
                                  {item.message}
                                </span>

                                <span className="truncate text-muted-foreground">
                                  {item.file}
                                </span>
                              </div>
                            ))}
                        </div>

                        {scanResult.errors.length >
                          30 && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Showing first 30 issues.
                          </p>
                        )}
                      </div>
                    )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border p-4">
                      <p className="text-xs text-muted-foreground">
                        Client
                      </p>

                      <select
                        value={clientId}
                        onChange={(event) =>
                          setClientId(
                            event.target.value,
                          )
                        }
                        className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm"
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
                    </div>

                    <div className="rounded-xl border p-4">
                      <p className="text-xs text-muted-foreground">
                        View
                      </p>

                      <select
                        value={viewId}
                        onChange={(event) =>
                          setViewId(
                            event.target.value,
                          )
                        }
                        disabled={!clientId}
                        className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm disabled:opacity-50"
                      >
                        <option value="">
                          {clientId
                            ? "Select view"
                            : "Select client first"}
                        </option>

                        {views.map((view) => (
                          <option
                            key={view.id}
                            value={view.id}
                          >
                            {view.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {canRename && (
                    <div className="rounded-xl border p-4">
                      <div className="flex items-center gap-2">
                        <Pencil className="size-4 text-muted-foreground" />

                        <p className="text-sm font-medium">
                          Upload folder name
                        </p>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <input
                          value={renameFolder}
                          onChange={(event) =>
                            setRenameFolder(
                              event.target.value,
                            )
                          }
                          className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setRenameFolder(
                              folderName,
                            )
                          }
                          className="rounded-lg border px-3 py-2 text-xs hover:bg-accent"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  )}

                  {uploadResult && (
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                        <CheckCircle2 className="size-4" />
                        Upload complete
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
                        <Stat
                          label="Uploaded"
                          value={uploadResult.uploaded}
                        />

                        <Stat
                          label="Merged"
                          value={uploadResult.merged}
                        />

                        <Stat
                          label="Skipped"
                          value={uploadResult.skipped}
                        />

                        <Stat
                          label="Conflicts"
                          value={
                            uploadResult.conflicts
                          }
                          tone={
                            uploadResult.conflicts
                              ? "danger"
                              : "default"
                          }
                        />

                        <Stat
                          label="Annotations"
                          value={
                            uploadResult.annotationCount
                          }
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 border-t pt-5">
                    <button
                      type="button"
                      onClick={() =>
                        setModalOpen(false)
                      }
                      disabled={uploading}
                      className="rounded-xl border px-4 py-2.5 text-sm hover:bg-accent disabled:opacity-50"
                    >
                      Close
                    </button>

                    {!uploadResult && (
                      <button
                        type="button"
                        onClick={() =>
                          void uploadDataset()
                        }
                        disabled={
                          uploading ||
                          !scanResult.canUpload ||
                          !clientId ||
                          !viewId
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                      >
                        {uploading ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Upload className="size-4" />
                        )}

                        {uploading
                          ? "Uploading..."
                          : "Upload Dataset"}
                      </button>
                    )}
                  </div>

                  {error && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                      {error}
                    </div>
                  )}

                  {message && (
                    <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
                      {message}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}