"use client";

import {
  ChangeEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  Client,
  View,
} from "@data-manage/types";

import { api } from "../../../lib/api";

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
  annotations: number;
  annotationRows: number;
  validPairs: number;
  missingAnnotations: number;
  orphanAnnotations: number;
  invalidAnnotations: number;
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

function normalizeRelativePath(
  value: string,
): string {
  return value
    .replaceAll("\\", "/")
    .split("/")
    .filter(Boolean)
    .join("/");
}

function getRelativePath(
  file: BrowserFile,
): string {
  const relativePath =
    file.webkitRelativePath?.trim();

  if (relativePath) {
    return normalizeRelativePath(
      relativePath,
    );
  }

  return normalizeRelativePath(
    file.name,
  );
}

function getRootFolder(
  relativePath: string,
): string {
  const normalized =
    normalizeRelativePath(relativePath);

  const parts = normalized
    .split("/")
    .filter(Boolean);

  return parts.length > 1
    ? parts[0]
    : "";
}

function getPairKey(
  relativePath: string,
): string {
  return normalizeRelativePath(
    relativePath,
  )
    .replace(/\.[^.]+$/, "")
    .toLowerCase();
}

function isImage(
  file: BrowserFile,
): boolean {
  const extension =
    `.${file.name
      .split(".")
      .pop()
      ?.toLowerCase() ?? ""}`;

  return IMAGE_EXTENSIONS.has(
    extension,
  );
}

function isLabel(
  file: BrowserFile,
): boolean {
  return file.name
    .toLowerCase()
    .endsWith(".txt");
}

function validateYolo(
  content: string,
): {
  valid: boolean;
  annotationCount: number;
  errors: string[];
} {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const errors: string[] = [];

  for (
    let index = 0;
    index < lines.length;
    index++
  ) {
    const parts =
      lines[index].split(/\s+/);

    if (parts.length !== 5) {
      errors.push(
        `Line ${index + 1}: expected 5 values.`,
      );
      continue;
    }

    const [
      classId,
      x,
      y,
      width,
      height,
    ] = parts.map(Number);

    if (
      !Number.isInteger(classId) ||
      classId < 0
    ) {
      errors.push(
        `Line ${index + 1}: invalid class ID.`,
      );
      continue;
    }

    if (
      !Number.isFinite(x) ||
      x < 0 ||
      x > 1
    ) {
      errors.push(
        `Line ${index + 1}: invalid x.`,
      );
      continue;
    }

    if (
      !Number.isFinite(y) ||
      y < 0 ||
      y > 1
    ) {
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
  };
}

function getSelectedRoot(
  files: BrowserFile[],
): string {
  const roots = new Set<string>();

  for (const file of files) {
    const relativePath =
      getRelativePath(file);

    const root =
      getRootFolder(relativePath);

    if (root) {
      roots.add(root);
    }
  }

  if (roots.size !== 1) {
    return "";
  }

  return Array.from(roots)[0];
}

export default function UploadPage() {
  const folderInputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const [clients, setClients] =
    useState<Client[]>([]);

  const [views, setViews] =
    useState<View[]>([]);

  const [clientId, setClientId] =
    useState("");

  const [viewId, setViewId] =
    useState("");

  const [files, setFiles] =
    useState<BrowserFile[]>([]);

  const [folderName, setFolderName] =
    useState("");

  const [scanResult, setScanResult] =
    useState<ScanResult | null>(null);

  const [uploadResult, setUploadResult] =
    useState<UploadResult | null>(null);

  const [scanning, setScanning] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  useEffect(() => {
    Promise.all([
      api<Client[]>("/api/clients"),
      api<View[]>("/api/views"),
    ])
      .then(
        ([clientsData, viewsData]) => {
          setClients(clientsData);
          setViews(viewsData);
        },
      )
      .catch((value) => {
        setError(
          value instanceof Error
            ? value.message
            : "Failed to load clients and views.",
        );
      });
  }, []);

  function resetDataset() {
    setFiles([]);
    setFolderName("");
    setScanResult(null);
    setUploadResult(null);
    setMessage("");
    setError("");

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

    const selected =
      Array.from(
        event.target.files ?? [],
      ) as BrowserFile[];

    if (selected.length === 0) {
      resetDataset();
      return;
    }

    const root = getSelectedRoot(
      selected,
    );

    if (!root) {
      setFiles([]);
      setFolderName("");
      setError(
        "Unable to determine the selected dataset folder. Select the complete folder using Choose Folder.",
      );

      if (folderInputRef.current) {
        folderInputRef.current.value =
          "";
      }

      return;
    }

    const invalidRootFiles =
      selected.filter((file) => {
        const relativePath =
          getRelativePath(file);

        return (
          !relativePath.startsWith(
            `${root}/`,
          )
        );
      });

    if (invalidRootFiles.length > 0) {
      setFiles([]);
      setFolderName("");
      setError(
        "The selected files do not belong to one dataset folder. Select the complete dataset folder again.",
      );

      if (folderInputRef.current) {
        folderInputRef.current.value =
          "";
      }

      return;
    }

    setFiles(selected);
    setFolderName(root);
  }

  async function scanSelectedFolder() {
    setError("");
    setMessage("");
    setScanResult(null);
    setUploadResult(null);

    if (!clientId) {
      setError("Select a client.");
      return;
    }

    if (!viewId) {
      setError("Select a view.");
      return;
    }

    if (files.length === 0) {
      setError(
        "Select a dataset folder first.",
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

    setFolderName(root);
    setScanning(true);

    try {
      const imageMap =
        new Map<
          string,
          BrowserFile
        >();

      const labelMap =
        new Map<
          string,
          BrowserFile
        >();

      let imageCount = 0;
      let annotationFileCount = 0;

      for (const file of files) {
        const relativePath =
          getRelativePath(file);

        if (
          !relativePath.startsWith(
            `${root}/`,
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

          annotationFileCount++;
        }
      }

      const errors: ScanError[] = [];

      let validPairs = 0;
      let annotationRows = 0;

      for (const [
        key,
        image,
      ] of imageMap) {
        const label =
          labelMap.get(key);

        if (!label) {
          errors.push({
            file: getRelativePath(
              image,
            ),
            message:
              "Missing YOLO annotation.",
          });

          continue;
        }

        const content =
          await label.text();

        const validation =
          validateYolo(content);

        if (!validation.valid) {
          errors.push({
            file: getRelativePath(
              label,
            ),
            message:
              validation.errors.join(
                "; ",
              ),
          });

          continue;
        }

        validPairs++;

        annotationRows +=
          validation.annotationCount;
      }

      let orphanAnnotations = 0;

      for (const [
        key,
        label,
      ] of labelMap) {
        if (!imageMap.has(key)) {
          orphanAnnotations++;

          errors.push({
            file: getRelativePath(
              label,
            ),
            message:
              "Annotation has no matching image.",
          });
        }
      }

      const missingAnnotations =
        Array.from(
          imageMap.keys(),
        ).filter(
          (key) =>
            !labelMap.has(key),
        ).length;

      const invalidAnnotations =
        errors.filter(
          (item) =>
            item.message !==
              "Missing YOLO annotation." &&
            item.message !==
              "Annotation has no matching image.",
        ).length;

      const result: ScanResult = {
        rootFolder: root,
        files: files.length,
        images: imageCount,
        annotations:
          annotationFileCount,
        annotationRows,
        validPairs,
        missingAnnotations,
        orphanAnnotations,
        invalidAnnotations,
        canUpload:
          imageCount > 0 &&
          errors.length === 0,
        errors,
      };

      setScanResult(result);

      if (!result.canUpload) {
        setError(
          "Dataset contains validation errors. Fix them before uploading.",
        );
      }
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
  setError("");
  setMessage("");
  setUploadResult(null);

  if (!scanResult) {
    setError("Scan the dataset first.");
    return;
  }

  if (!scanResult.canUpload) {
    setError(
      "The dataset contains errors and cannot be uploaded.",
    );
    return;
  }

  if (!clientId || !viewId) {
    setError("Client and view are required.");
    return;
  }

  if (files.length === 0) {
    setError("No dataset files are selected.");
    return;
  }

  const root = getSelectedRoot(files);

  if (!root) {
    setError("Unable to determine the dataset folder.");
    return;
  }

  const validFiles = files.filter((file) => {
    const relativePath = getRelativePath(file);

    return (
      relativePath.startsWith(`${root}/`) &&
      (isImage(file) || isLabel(file))
    );
  });

  if (validFiles.length === 0) {
    setError(
      "No supported dataset files were selected.",
    );
    return;
  }

  const relativePaths = validFiles.map((file) =>
    getRelativePath(file),
  );

  setUploading(true);

  try {
    const form = new FormData();

    form.append("clientId", clientId);
    form.append("viewId", viewId);
    form.append("rootFolder", root);
    form.append(
      "relativePaths",
      JSON.stringify(relativePaths),
    );

    for (const file of validFiles) {
      form.append("files", file, file.name);
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
      `Dataset uploaded successfully. ${result.uploaded} new images, ${result.merged} merged, ${result.skipped} skipped.`,
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

  return (
    <main className="max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Upload Dataset
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Select a complete dataset folder
          containing images and matching YOLO
          annotation files.
        </p>
      </div>

      <section className="space-y-5 rounded-xl border bg-card p-6">
        <div className="space-y-2">
          <label
            htmlFor="client"
            className="text-sm font-medium"
          >
            Client
          </label>

          <select
            id="client"
            className="w-full rounded-lg border bg-background px-3 py-2"
            value={clientId}
            onChange={(event) => {
              setClientId(
                event.target.value,
              );
              setScanResult(null);
              setUploadResult(null);
            }}
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

        <div className="space-y-2">
          <label
            htmlFor="view"
            className="text-sm font-medium"
          >
            View
          </label>

          <select
            id="view"
            className="w-full rounded-lg border bg-background px-3 py-2"
            value={viewId}
            onChange={(event) => {
              setViewId(
                event.target.value,
              );
              setScanResult(null);
              setUploadResult(null);
            }}
          >
            <option value="">
              Select view
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

        <div className="space-y-3">
          <label className="text-sm font-medium">
            Dataset Folder
          </label>

          <input
            ref={folderInputRef}
            type="file"
            multiple
            {...({ webkitdirectory: "" } as Record<string, string>)}
            onChange={handleFolderSelect}
            className="hidden"
          />

          <div className="flex flex-col gap-3 rounded-lg border border-dashed p-5">
            <div>
              <p className="font-medium">
                {folderName ||
                  "No folder selected"}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Select the complete dataset
                folder from the Windows laptop.
              </p>
            </div>

            <div>
              <button
                type="button"
                onClick={() =>
                  folderInputRef.current?.click()
                }
                className="rounded-lg border px-5 py-2"
              >
                Choose Folder
              </button>
            </div>
          </div>

          {files.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {files.length} files selected.
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={
              scanSelectedFolder
            }
            disabled={
              scanning ||
              files.length === 0 ||
              !clientId ||
              !viewId
            }
            className="rounded-lg bg-primary px-5 py-2 text-primary-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            {scanning
              ? "Scanning..."
              : "Open"}
          </button>
        </div>
      </section>

      {scanResult && (
        <section className="space-y-5 rounded-xl border bg-card p-6">
          <div>
            <h2 className="text-lg font-semibold">
              Dataset Preview
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Folder:{" "}
              <span className="font-medium">
                {scanResult.rootFolder}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat
              label="Files"
              value={
                scanResult.files
              }
            />

            <Stat
              label="Images"
              value={
                scanResult.images
              }
            />

            <Stat
              label="YOLO Files"
              value={
                scanResult.annotations
              }
            />

            <Stat
              label="Valid Pairs"
              value={
                scanResult.validPairs
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat
              label="Annotation Rows"
              value={
                scanResult.annotationRows
              }
            />

            <Stat
              label="Missing TXT"
              value={
                scanResult.missingAnnotations
              }
              danger={
                scanResult.missingAnnotations >
                0
              }
            />

            <Stat
              label="Orphan TXT"
              value={
                scanResult.orphanAnnotations
              }
              danger={
                scanResult.orphanAnnotations >
                0
              }
            />

            <Stat
              label="Invalid TXT"
              value={
                scanResult.invalidAnnotations
              }
              danger={
                scanResult.invalidAnnotations >
                0
              }
            />
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">
              Status
            </p>

            <p
              className={
                scanResult.canUpload
                  ? "mt-1 font-semibold"
                  : "mt-1 font-semibold text-destructive"
              }
            >
              {scanResult.canUpload
                ? "Ready to upload"
                : "Dataset has errors"}
            </p>
          </div>

          {scanResult.errors.length >
            0 && (
            <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <h3 className="text-sm font-semibold text-destructive">
                Validation Errors
              </h3>

              <div className="max-h-64 space-y-2 overflow-auto">
                {scanResult.errors
                  .slice(0, 100)
                  .map(
                    (
                      item,
                      index,
                    ) => (
                      <div
                        key={`${item.file}-${index}`}
                        className="text-xs"
                      >
                        <span className="font-mono font-medium">
                          {item.file}
                        </span>

                        <span className="text-muted-foreground">
                          {" — "}
                          {
                            item.message
                          }
                        </span>
                      </div>
                    ),
                  )}
              </div>

              {scanResult.errors
                .length > 100 && (
                <p className="text-xs text-muted-foreground">
                  Showing the first 100
                  errors out of{" "}
                  {
                    scanResult
                      .errors.length
                  }
                  .
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={
                uploadDataset
              }
              disabled={
                uploading ||
                !scanResult.canUpload
              }
              className="rounded-lg bg-primary px-5 py-2 text-primary-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              {uploading
                ? "Uploading..."
                : "Upload Dataset"}
            </button>
          </div>
        </section>
      )}

      {uploadResult && (
        <section className="space-y-5 rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold">
            Upload Complete
          </h2>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <Stat
              label="Uploaded"
              value={
                uploadResult.uploaded
              }
            />

            <Stat
              label="Merged"
              value={
                uploadResult.merged
              }
            />

            <Stat
              label="Skipped"
              value={
                uploadResult.skipped
              }
            />

            <Stat
              label="Conflicts"
              value={
                uploadResult.conflicts
              }
              danger={
                uploadResult.conflicts >
                0
              }
            />

            <Stat
              label="Annotations"
              value={
                uploadResult.annotationCount
              }
            />
          </div>
        </section>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">
            {error}
          </p>
        </div>
      )}

      {message && (
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm">
            {message}
          </p>
        </div>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number | string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-xs text-muted-foreground">
        {label}
      </p>

      <p
        className={
          danger
            ? "mt-1 text-xl font-semibold text-destructive"
            : "mt-1 text-xl font-semibold"
        }
      >
        {value}
      </p>
    </div>
  );
}