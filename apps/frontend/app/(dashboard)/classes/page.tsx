"use client";

import {
  ChevronDown,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "../../../hooks/use-auth";
import { api } from "../../../lib/api";

type GlobalClass = {
  class_id: number;
  class_name: string;
};

type DatasetClass = {
  class_id: number;
  class_name: string;
  global_class_id?: number | null;
};

type DatasetType = {
  id: string;
  name: string;
  description?: string | null;
  classes?: DatasetClass[];
};

type ClassesResponse =
  | GlobalClass[]
  | {
      items?: GlobalClass[];
    };

function getClasses(
  response: ClassesResponse,
): GlobalClass[] {
  if (Array.isArray(response)) {
    return response;
  }

  return response.items ?? [];
}

export default function ClassesPage() {
  const {
    user,
    loading: authLoading,
  } = useAuth();

  const [globalClasses, setGlobalClasses] =
    useState<GlobalClass[]>([]);

  const [datasetTypes, setDatasetTypes] =
    useState<DatasetType[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [activeType, setActiveType] =
    useState("global");

  const [openTypes, setOpenTypes] =
    useState<Record<string, boolean>>(
      {},
    );

  const [dialogOpen, setDialogOpen] =
    useState(false);

  const [editingClass, setEditingClass] =
    useState<GlobalClass | null>(null);

  const [classId, setClassId] =
    useState("");

  const [className, setClassName] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState<number | null>(null);

  const canManage =
    user?.role === "admin" ||
    user?.role === "editor";

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [
        classesResult,
        datasetTypesResult,
      ] = await Promise.all([
        api<ClassesResponse>(
          "/api/classes",
        ),
        api<DatasetType[]>(
          "/api/dataset-types",
        ),
      ]);

      setGlobalClasses(
        getClasses(
          classesResult,
        ).sort(
          (a, b) =>
            a.class_id -
            b.class_id,
        ),
      );

      setDatasetTypes(
        datasetTypesResult,
      );
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Failed to load classes.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading && user) {
      void loadData();
    }
  }, [authLoading, user]);

  const filteredGlobalClasses =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      if (!query) {
        return globalClasses;
      }

      return globalClasses.filter(
        (item) =>
          item.class_name
            .toLowerCase()
            .includes(query) ||
          String(item.class_id).includes(
            query,
          ),
      );
    }, [
      globalClasses,
      search,
    ]);

  const filteredDatasetTypes =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      if (!query) {
        return datasetTypes;
      }

      return datasetTypes.filter(
        (type) =>
          type.name
            .toLowerCase()
            .includes(query) ||
          type.classes?.some(
            (item) =>
              item.class_name
                .toLowerCase()
                .includes(query) ||
              String(
                item.class_id,
              ).includes(query),
          ),
      );
    }, [
      datasetTypes,
      search,
    ]);

  function openCreateDialog() {
    setEditingClass(null);
    setClassId("");
    setClassName("");
    setError("");
    setDialogOpen(true);
  }

  function openEditDialog(
    item: GlobalClass,
  ) {
    setEditingClass(item);
    setClassId(
      String(item.class_id),
    );
    setClassName(item.class_name);
    setError("");
    setDialogOpen(true);
  }

  function closeDialog() {
    if (saving) {
      return;
    }

    setDialogOpen(false);
    setEditingClass(null);
    setClassId("");
    setClassName("");
  }

  async function saveClass() {
    const parsedId =
      Number(classId.trim());

    const normalizedName =
      className.trim();

    if (
      !Number.isInteger(parsedId) ||
      parsedId < 0
    ) {
      setError(
        "Class ID must be a non-negative integer.",
      );
      return;
    }

    if (!normalizedName) {
      setError(
        "Class name is required.",
      );
      return;
    }

    const duplicateId =
      globalClasses.some(
        (item) =>
          item.class_id ===
            parsedId &&
          item.class_id !==
            editingClass?.class_id,
      );

    if (duplicateId) {
      setError(
        `Global class ID ${parsedId} is already in use.`,
      );
      return;
    }

    const duplicateName =
      globalClasses.some(
        (item) =>
          item.class_name.toLowerCase() ===
            normalizedName.toLowerCase() &&
          item.class_id !==
            editingClass?.class_id,
      );

    if (duplicateName) {
      setError(
        `Global class name "${normalizedName}" is already in use.`,
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      if (editingClass) {
        const updated =
          await api<GlobalClass>(
            `/api/classes/${editingClass.class_id}`,
            {
              method: "PATCH",
              body: JSON.stringify({
                classId: parsedId,
                className:
                  normalizedName,
              }),
            },
          );

        setGlobalClasses(
          (current) =>
            current
              .map((item) =>
                item.class_id ===
                editingClass.class_id
                  ? updated
                  : item,
              )
              .sort(
                (a, b) =>
                  a.class_id -
                  b.class_id,
              ),
        );

        setMessage(
          "Global class updated successfully.",
        );
      } else {
        const created =
          await api<GlobalClass>(
            "/api/classes",
            {
              method: "POST",
              body: JSON.stringify({
                classId: parsedId,
                className:
                  normalizedName,
              }),
            },
          );

        setGlobalClasses(
          (current) =>
            [
              ...current,
              created,
            ].sort(
              (a, b) =>
                a.class_id -
                b.class_id,
            ),
        );

        setMessage(
          "Global class created successfully.",
        );
      }

      closeDialog();
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Failed to save global class.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteClass(
    item: GlobalClass,
  ) {
    const confirmed =
      window.confirm(
        `Delete global class "${item.class_name}" (ID ${item.class_id})?`,
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(item.class_id);
      setError("");
      setMessage("");

      await api(
        `/api/classes/${item.class_id}`,
        {
          method: "DELETE",
        },
      );

      setGlobalClasses(
        (current) =>
          current.filter(
            (value) =>
              value.class_id !==
              item.class_id,
          ),
      );

      setMessage(
        "Global class deleted successfully.",
      );
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Failed to delete global class.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  function toggleType(
    typeId: string,
  ) {
    setOpenTypes((current) => ({
      ...current,
      [typeId]:
        !current[typeId],
    }));
  }

  if (authLoading) {
    return (
      <main className="flex min-h-full items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-full space-y-5 p-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Classes
          </h1>

          <p className="mt-1 text-xs text-muted-foreground">
            Global classes and dataset-specific
            class definitions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search classes..."
              className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <button
            type="button"
            onClick={() =>
              void loadData()
            }
            disabled={loading}
            className="inline-flex size-9 items-center justify-center rounded-lg border transition hover:bg-accent disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw
              className={
                loading
                  ? "size-4 animate-spin"
                  : "size-4"
              }
            />
          </button>

          {canManage && (
            <button
              type="button"
              onClick={openCreateDialog}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Plus className="size-4" />
              Add Global Class
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
          {message}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <button
          type="button"
          onClick={() =>
            setActiveType("global")
          }
          className={`rounded-xl border p-4 text-left transition ${
            activeType === "global"
              ? "border-primary bg-primary/5"
              : "bg-card hover:bg-accent/40"
          }`}
        >
          <p className="text-xs text-muted-foreground">
            Global
          </p>

          <p className="mt-1 text-2xl font-semibold">
            {globalClasses.length}
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            Global classes
          </p>
        </button>

        {datasetTypes.map(
          (type) => (
            <button
              key={type.id}
              type="button"
              onClick={() =>
                setActiveType(
                  type.id,
                )
              }
              className={`rounded-xl border p-4 text-left transition ${
                activeType === type.id
                  ? "border-primary bg-primary/5"
                  : "bg-card hover:bg-accent/40"
              }`}
            >
              <p className="truncate text-xs text-muted-foreground">
                Dataset Type
              </p>

              <p className="mt-1 truncate text-base font-semibold">
                {type.name}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                {type.classes?.length ??
                  0}{" "}
                classes
              </p>
            </button>
          ),
        )}
      </section>

      {loading ? (
        <section className="flex min-h-64 items-center justify-center rounded-xl border bg-card">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </section>
      ) : activeType ===
        "global" ? (
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <p className="text-sm font-medium">
              Global Classes
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Canonical global vocabulary. This
              is independent from dataset types such
              as 8_class, 16_class, 19_class, or
              weapon.
            </p>
          </div>

          {filteredGlobalClasses.length ===
          0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No global classes found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-150 text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="w-28 px-5 py-3 font-medium">
                      Global ID
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Global Class Name
                    </th>

                    {canManage && (
                      <th className="w-32 px-5 py-3 text-right font-medium">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody>
                  {filteredGlobalClasses.map(
                    (item) => (
                      <tr
                        key={
                          item.class_id
                        }
                        className="border-b last:border-0 hover:bg-muted/40"
                      >
                        <td className="px-5 py-3 font-mono text-xs">
                          {item.class_id}
                        </td>

                        <td className="px-5 py-3 font-medium">
                          {item.class_name}
                        </td>

                        {canManage && (
                          <td className="px-5 py-3">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  openEditDialog(
                                    item,
                                  )
                                }
                                className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-accent"
                              >
                                <Edit3 className="size-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void deleteClass(
                                    item,
                                  )
                                }
                                disabled={
                                  deletingId ===
                                  item.class_id
                                }
                                className="inline-flex size-8 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-50"
                              >
                                {deletingId ===
                                item.class_id ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Trash2 className="size-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-3">
          {filteredDatasetTypes.map(
            (type) => {
              const classes =
                type.classes ?? [];

              const visibleClasses =
                classes.filter(
                  (item) => {
                    const query =
                      search
                        .trim()
                        .toLowerCase();

                    if (!query) {
                      return true;
                    }

                    return (
                      item.class_name
                        .toLowerCase()
                        .includes(query) ||
                      String(
                        item.class_id,
                      ).includes(query)
                    );
                  },
                );

              const isOpen =
                openTypes[type.id] ??
                activeType ===
                  type.id;

              return (
                <div
                  key={type.id}
                  className="overflow-hidden rounded-xl border bg-card"
                >
                  <button
                    type="button"
                    onClick={() =>
                      toggleType(
                        type.id,
                      )
                    }
                    className="flex w-full items-center justify-between border-b px-5 py-4 text-left hover:bg-accent/40"
                  >
                    <div>
                      <p className="text-sm font-semibold">
                        {type.name}
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {classes.length}{" "}
                        dataset-specific
                        classes
                      </p>
                    </div>

                    <ChevronDown
                      className={`size-4 transition-transform ${
                        isOpen
                          ? "rotate-180"
                          : ""
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="overflow-x-auto">
                      {visibleClasses.length ===
                      0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                          No classes found.
                        </div>
                      ) : (
                        <table className="w-full min-w-175 text-sm">
                          <thead>
                            <tr className="border-b text-left text-xs text-muted-foreground">
                              <th className="w-28 px-5 py-3 font-medium">
                                Dataset ID
                              </th>

                              <th className="px-5 py-3 font-medium">
                                Class Name
                              </th>

                              <th className="w-40 px-5 py-3 font-medium">
                                Global ID
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {visibleClasses.map(
                              (item) => (
                                <tr
                                  key={`${type.id}-${item.class_id}`}
                                  className="border-b last:border-0 hover:bg-muted/40"
                                >
                                  <td className="px-5 py-3 font-mono text-xs">
                                    {
                                      item.class_id
                                    }
                                  </td>

                                  <td className="px-5 py-3 font-medium">
                                    {
                                      item.class_name
                                    }
                                  </td>

                                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                                    {item.global_class_id ??
                                      "—"}
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            },
          )}
        </section>
      )}

      {dialogOpen &&
        canManage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border bg-card shadow-xl">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold">
                    {editingClass
                      ? "Edit Global Class"
                      : "Add Global Class"}
                  </h2>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Global classes are separate from
                    dataset types.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={saving}
                  className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-accent disabled:opacity-50"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="space-y-4 p-5">
                {error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-medium">
                    Global Class ID
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={classId}
                    onChange={(event) =>
                      setClassId(
                        event.target.value,
                      )
                    }
                    disabled={saving}
                    className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium">
                    Global Class Name
                  </label>

                  <input
                    type="text"
                    value={className}
                    onChange={(event) =>
                      setClassName(
                        event.target.value,
                      )
                    }
                    disabled={saving}
                    placeholder="Person"
                    className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t px-5 py-4">
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={saving}
                  className="rounded-lg border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void saveClass()
                  }
                  disabled={saving}
                  className="inline-flex min-w-24 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {saving && (
                    <Loader2 className="size-4 animate-spin" />
                  )}

                  {editingClass
                    ? "Update"
                    : "Create"}
                </button>
              </div>
            </div>
          </div>
        )}
    </main>
  );
}