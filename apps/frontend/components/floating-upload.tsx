"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
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
  Plus,
  Server,
  Upload,
  X,
} from "lucide-react";

import type {
  Client,
  View,
} from "@data-manage/types";

import { api } from "../lib/api";
import { useAuth } from "../hooks/use-auth";

type BrowserFile = File & {
  webkitRelativePath?: string;
};

type DatasetType = {
  id: string;
  name: string;
  description: string | null;
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
  fileCount?: number;
  datasetType?: string;
  client?: string;
  view?: string;
  rootFolder?: string;
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

  return relativePath
    ? normalizeRelativePath(
        relativePath,
      )
    : normalizeRelativePath(
        file.name,
      );
}

function getRootFolder(
  relativePath: string,
): string {
  const parts =
    normalizeRelativePath(
      relativePath,
    )
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

function getExtension(
  file: BrowserFile,
): string {
  const name =
    file.name.toLowerCase();

  const index =
    name.lastIndexOf(".");

  return index === -1
    ? ""
    : name.slice(index);
}

function isImage(
  file: BrowserFile,
): boolean {
  return IMAGE_EXTENSIONS.has(
    getExtension(file),
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
) {
  const lines = content
    .split(/\r?\n/)
    .map((line) =>
      line.trim(),
    )
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
    annotationCount:
      lines.length,
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
  tone?:
    | "default"
    | "success"
    | "warning"
    | "danger";
  icon?: ReactNode;
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

export default function FloatingUpload() {
  const { user } = useAuth();

  const folderInputRef =
    useRef<HTMLInputElement>(null);

  const [
    sourceOpen,
    setSourceOpen,
  ] = useState(false);

  const [
    modalOpen,
    setModalOpen,
  ] = useState(false);

  const [
    clients,
    setClients,
  ] = useState<Client[]>([]);

  const [
    views,
    setViews,
  ] = useState<View[]>([]);

  const [
    datasetTypes,
    setDatasetTypes,
  ] = useState<DatasetType[]>([]);

  const [
    clientId,
    setClientId,
  ] = useState("");

  const [
    viewId,
    setViewId,
  ] = useState("");

  const [
    datasetTypeId,
    setDatasetTypeId,
  ] = useState("");

  const [
    files,
    setFiles,
  ] = useState<BrowserFile[]>([]);

  const [
    folderName,
    setFolderName,
  ] = useState("");

  const [
    renameFolder,
    setRenameFolder,
  ] = useState("");

  const [
    scanResult,
    setScanResult,
  ] = useState<ScanResult | null>(
    null,
  );

  const [
    uploadResult,
    setUploadResult,
  ] = useState<UploadResult | null>(
    null,
  );

  const [
    scanning,
    setScanning,
  ] = useState(false);

  const [
    uploading,
    setUploading,
  ] = useState(false);

  const [
    loadingClients,
    setLoadingClients,
  ] = useState(true);

  const [
    loadingDatasetTypes,
    setLoadingDatasetTypes,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  const canRename =
    user?.role === "admin" ||
    user?.role === "editor";

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoadingClients(true);
        setLoadingDatasetTypes(true);
        setError("");

        const [
          clientsResult,
          datasetTypesResult,
        ] = await Promise.all([
          api<Client[]>(
            "/api/clients",
          ),
          api<DatasetType[]>(
            "/api/dataset-types",
          ),
        ]);

        setClients(
          clientsResult,
        );

        setDatasetTypes(
          datasetTypesResult,
        );
      } catch (value) {
        setError(
          value instanceof Error
            ? value.message
            : "Failed to load upload data.",
        );
      } finally {
        setLoadingClients(false);
        setLoadingDatasetTypes(false);
      }
    }

    void loadInitialData();
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

        const result =
          await api<View[]>(
            `/api/views?clientId=${encodeURIComponent(clientId)}`,
          );

        setViews(result);
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
    setClientId("");
    setViewId("");
    setDatasetTypeId("");
    setViews([]);

    if (folderInputRef.current) {
      folderInputRef.current.value =
        "";
    }
  }

  function openPcPicker() {
    setSourceOpen(false);

    folderInputRef.current?.click();
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

    event.target.value = "";

    if (!selected.length) {
      return;
    }

    const root =
      getRootFolder(
        getRelativePath(
          selected[0],
        ),
      );

    if (!root) {
      setError(
        "Unable to determine the selected dataset folder.",
      );
      return;
    }

    const invalidRootFiles =
      selected.filter(
        (file) =>
          !getRelativePath(
            file,
          ).startsWith(
            `${root}/`,
          ),
      );

    if (invalidRootFiles.length) {
      setError(
        "The selected files do not belong to one dataset folder.",
      );
      return;
    }

    setFiles(selected);
    setFolderName(root);
    setRenameFolder(root);
    setModalOpen(true);

    void scanFolder(
      selected,
      root,
    );
  }

  async function scanFolder(
    selectedFiles: BrowserFile[],
    selectedRoot: string,
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
      let txtCount = 0;

      for (const file of selectedFiles) {
        const relativePath =
          getRelativePath(file);

        if (
          !relativePath.startsWith(
            `${selectedRoot}/`,
          )
        ) {
          continue;
        }

        if (isImage(file)) {
          imageMap.set(
            getPairKey(
              relativePath,
            ),
            file,
          );

          imageCount++;
        } else if (
          isLabel(file)
        ) {
          labelMap.set(
            getPairKey(
              relativePath,
            ),
            file,
          );

          txtCount++;
        }
      }

      const errors: ScanError[] =
        [];

      let validPairs = 0;
      let backgroundImages = 0;
      let corruptedTxt = 0;
      let txtWithoutImage = 0;
      let imageWithoutTxt = 0;

      for (const [
        key,
        image,
      ] of imageMap) {
        const label =
          labelMap.get(key);

        if (!label) {
          imageWithoutTxt++;

          errors.push({
            file:
              getRelativePath(
                image,
              ),
            message:
              "Image without TXT",
          });

          continue;
        }

        const content =
          await label.text();

        const validation =
          validateYolo(
            content,
          );

        if (
          validation.background
        ) {
          backgroundImages++;
          validPairs++;
          continue;
        }

        if (!validation.valid) {
          corruptedTxt++;

          errors.push({
            file:
              getRelativePath(
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
      }

      for (const [
        key,
        label,
      ] of labelMap) {
        if (imageMap.has(key)) {
          continue;
        }

        txtWithoutImage++;

        errors.push({
          file:
            getRelativePath(
              label,
            ),
          message:
            "TXT without image",
        });
      }

      const result: ScanResult = {
        rootFolder:
          selectedRoot,
        files:
          selectedFiles.length,
        images:
          imageCount,
        txt:
          txtCount,
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

  function getSelectedRoot(
    selectedFiles: BrowserFile[],
  ) {
    const roots =
      new Set<string>();

    for (const file of selectedFiles) {
      const root =
        getRootFolder(
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

  async function uploadDataset() {
    if (
      !scanResult ||
      !scanResult.canUpload
    ) {
      return;
    }

    if (
      !clientId ||
      !viewId ||
      !datasetTypeId
    ) {
      setError(
        "Select a client, view, and dataset type before uploading.",
      );

      return;
    }

    const root =
      getSelectedRoot(files);

    if (!root) {
      setError(
        "Unable to determine the dataset folder.",
      );

      return;
    }

    const finalRoot =
      canRename &&
      renameFolder.trim()
        ? normalizeRelativePath(
            renameFolder.trim(),
          ).replace(
            /\//g,
            "_",
          )
        : root;

    if (!finalRoot) {
      setError(
        "Enter a valid folder name.",
      );

      return;
    }

    const validFiles =
      files.filter(
        (file) => {
          const relativePath =
            getRelativePath(file);

          return (
            relativePath.startsWith(
              `${root}/`,
            ) &&
            (isImage(file) ||
              isLabel(file))
          );
        },
      );

    if (!validFiles.length) {
      setError(
        "No supported dataset files were selected.",
      );

      return;
    }

    const relativePaths =
      validFiles.map(
        (file) => {
          const original =
            getRelativePath(
              file,
            );

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
      const form =
        new FormData();

      form.append(
        "clientId",
        clientId,
      );

      form.append(
        "viewId",
        viewId,
      );

      form.append(
        "datasetTypeId",
        datasetTypeId,
      );

      form.append(
        "rootFolder",
        finalRoot,
      );

      form.append(
        "relativePaths",
        JSON.stringify(
          relativePaths,
        ),
      );

      for (
        let index = 0;
        index < validFiles.length;
        index++
      ) {
        const file =
          validFiles[index];

        const relativePath =
          relativePaths[index];

        form.append(
          "files",
          file,
          relativePath,
        );
      }

      const result =
        await api<UploadResult>(
          "/api/upload",
          {
            method: "POST",
            body: form,
          },
        );

      setUploadResult(
        result,
      );

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

  const selectedDatasetType =
    datasetTypes.find(
      (item) =>
        item.id ===
        datasetTypeId,
    );

  const closeModal = () => {
    if (
      scanning ||
      uploading
    ) {
      return;
    }

    setModalOpen(false);
    resetDataset();
  };

  const canOpenUpload =
    !loadingClients &&
    !loadingDatasetTypes &&
    !scanning;

  return (
    <>
      <input
        ref={folderInputRef}
        type="file"
        multiple
        {...({
          webkitdirectory: "",
        } as Record<
          string,
          string
        >)}
        onChange={
          handleFolderSelect
        }
        className="hidden"
      />

      {sourceOpen && (
        <div
          className="fixed inset-0 z-50 bg-background/40 backdrop-blur-md"
          onClick={() =>
            setSourceOpen(false)
          }
        >
          <div
            className="fixed bottom-24 right-6 w-[460px] overflow-hidden rounded-2xl border bg-card shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <p className="text-sm font-semibold">
                  Upload Dataset
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Choose where the dataset is located
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSourceOpen(false)
                }
                className="rounded-lg p-2 hover:bg-accent"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 p-5">
              <button
                type="button"
                onClick={openPcPicker}
                disabled={!canOpenUpload}
                className="group flex min-h-36 flex-col items-center justify-center rounded-xl border bg-background/50 px-5 text-center transition hover:border-primary hover:bg-primary/5 disabled:pointer-events-none disabled:opacity-50"
              >
                <FolderOpen className="size-8 text-primary transition-transform group-hover:scale-110" />

                <span className="mt-3 text-sm font-semibold">
                  Upload from PC
                </span>

                <span className="mt-1 text-xs text-muted-foreground">
                  Select a dataset folder
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setSourceOpen(false)
                }
                className="group flex min-h-36 flex-col items-center justify-center rounded-xl border bg-background/50 px-5 text-center transition hover:border-primary hover:bg-primary/5"
              >
                <Server className="size-8 text-primary transition-transform group-hover:scale-110" />

                <span className="mt-3 text-sm font-semibold">
                  Upload from Server
                </span>

                <span className="mt-1 text-xs text-muted-foreground">
                  Select an existing server dataset
                </span>
              </button>
            </div>

            <div className="border-t px-5 py-3">
              <p className="text-xs text-muted-foreground">
                Select a source to begin dataset upload.
              </p>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/70 p-4 backdrop-blur-md">
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl border bg-card shadow-2xl">
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
                onClick={closeModal}
                disabled={
                  scanning ||
                  uploading
                }
                className="rounded-lg p-2 hover:bg-accent disabled:opacity-50"
                aria-label="Close dataset"
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
                    Checking images, TXT files and matching pairs...
                  </p>
                </div>
              ) : scanResult ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Stat
                      label="Total files"
                      value={
                        scanResult.files
                      }
                      icon={
                        <Files className="size-4 text-muted-foreground" />
                      }
                    />

                    <Stat
                      label="Total images"
                      value={
                        scanResult.images
                      }
                      icon={
                        <ImageIcon className="size-4 text-muted-foreground" />
                      }
                    />

                    <Stat
                      label="Total TXT"
                      value={
                        scanResult.txt
                      }
                      icon={
                        <FileText className="size-4 text-muted-foreground" />
                      }
                    />

                    <Stat
                      label="Valid pairs"
                      value={
                        scanResult.validPairs
                      }
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
                      value={
                        scanResult.corruptedTxt
                      }
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
                    className={`rounded-xl border p-4 ${
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
                    scanResult.errors
                      .length > 0 && (
                      <div className="rounded-xl border p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-semibold">
                            Issues found
                          </p>

                          <span className="text-xs text-muted-foreground">
                            {
                              scanResult
                                .errors
                                .length
                            }{" "}
                            files
                          </span>
                        </div>

                        <div className="max-h-36 space-y-1.5 overflow-y-auto">
                          {scanResult.errors
                            .slice(
                              0,
                              30,
                            )
                            .map(
                              (
                                item,
                                index,
                              ) => (
                                <div
                                  key={`${item.file}-${index}`}
                                  className="flex gap-2 text-xs"
                                >
                                  <span className="font-medium">
                                    {
                                      item.message
                                    }
                                  </span>

                                  <span className="truncate text-muted-foreground">
                                    {
                                      item.file
                                    }
                                  </span>
                                </div>
                              ),
                            )}
                        </div>

                        {scanResult.errors
                          .length > 30 && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Showing first 30 issues.
                          </p>
                        )}
                      </div>
                    )}

                  <div className="grid gap-4 md:grid-cols-3">
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

                        {clients.map(
                          (client) => (
                            <option
                              key={
                                client.id
                              }
                              value={
                                client.id
                              }
                            >
                              {
                                client.name
                              }
                            </option>
                          ),
                        )}
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
                        disabled={
                          !clientId
                        }
                        className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm disabled:opacity-50"
                      >
                        <option value="">
                          {clientId
                            ? "Select view"
                            : "Select client first"}
                        </option>

                        {views.map(
                          (view) => (
                            <option
                              key={
                                view.id
                              }
                              value={
                                view.id
                              }
                            >
                              {
                                view.name
                              }
                            </option>
                          ),
                        )}
                      </select>
                    </div>

                    <div className="rounded-xl border p-4">
                      <p className="text-xs text-muted-foreground">
                        Dataset type
                      </p>

                      <select
                        value={
                          datasetTypeId
                        }
                        onChange={(event) =>
                          setDatasetTypeId(
                            event.target.value,
                          )
                        }
                        disabled={
                          loadingDatasetTypes
                        }
                        className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm disabled:opacity-50"
                      >
                        <option value="">
                          {loadingDatasetTypes
                            ? "Loading dataset types..."
                            : "Select dataset type"}
                        </option>

                        {datasetTypes.map(
                          (
                            datasetType,
                          ) => (
                            <option
                              key={
                                datasetType.id
                              }
                              value={
                                datasetType.id
                              }
                            >
                              {
                                datasetType.name
                              }
                            </option>
                          ),
                        )}
                      </select>

                      {selectedDatasetType?.description && (
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          {
                            selectedDatasetType.description
                          }
                        </p>
                      )}
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
                          value={
                            renameFolder
                          }
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
                      onClick={closeModal}
                      disabled={
                        uploading
                      }
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
                          !viewId ||
                          !datasetTypeId
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

      <button
        type="button"
        onClick={() =>
          setSourceOpen(
            (value) => !value,
          )
        }
        className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition hover:scale-105 hover:bg-primary/90"
        aria-label="Upload dataset"
        aria-expanded={sourceOpen}
      >
        {sourceOpen ? (
          <X className="size-6" />
        ) : (
          <Plus className="size-6" />
        )}
      </button>
    </>
  );
}