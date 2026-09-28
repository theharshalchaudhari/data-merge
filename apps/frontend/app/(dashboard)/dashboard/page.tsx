"use client";

import {
  BarChart3,
  ChevronDown,
  Database,
  FileImage,
  Layers3,
  RefreshCw,
  ScanSearch,
  Users,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  Client,
  View,
} from "@data-manage/types";

import { api } from "../../../lib/api";

type DashboardClass = {
  classId?: number;
  className: string;
  count: number;
};

type DashboardType = {
  type: string;
  count: number;
  images?: number;
};

type DatasetTypeStat = {
  datasetType: string;
  images: number;
  annotations: number;
};

type DashboardView = {
  viewId: string;
  viewName: string;
  clientName?: string;
  images: number;
  annotations: number;
  annotatedImages?: number;
  backgroundImages?: number;
};

type DashboardClient = {
  clientId: string;
  clientName: string;
  images: number;
  annotations: number;
  annotatedImages?: number;
  backgroundImages?: number;
};

type DashboardStats = {
  clients: number;
  views: number;
  users?: number;
  images: number;
  annotatedImages?: number;
  backgroundImages?: number;
  annotations: number;
  classes: number;
  averageAnnotationsPerImage: number;
  annotationCoverage?: number;
};

type DashboardData = {
  stats?: Partial<DashboardStats>;
  annotationClasses?: DashboardClass[];
  annotationTypes?: DashboardType[];
  datasetTypes?: DatasetTypeStat[];
  views?: DashboardView[];
  clients?: DashboardClient[];
};

const emptyData: DashboardData = {
  stats: {
    clients: 0,
    views: 0,
    users: 0,
    images: 0,
    annotatedImages: 0,
    backgroundImages: 0,
    annotations: 0,
    classes: 0,
    averageAnnotationsPerImage: 0,
    annotationCoverage: 0,
  },
  annotationClasses: [],
  annotationTypes: [],
  datasetTypes: [],
  views: [],
  clients: [],
};

const number = (value: number) =>
  new Intl.NumberFormat(
    "en-IN",
  ).format(value);

const compact = (value: number) => {
  if (value >= 1_000_000) {
    return `${(
      value / 1_000_000
    ).toFixed(
      value >= 10_000_000
        ? 0
        : 1,
    )}M`;
  }

  if (value >= 1_000) {
    return `${(
      value / 1_000
    ).toFixed(
      value >= 100_000
        ? 0
        : 1,
    )}K`;
  }

  return number(value);
};

const percentage = (
  value: number,
  total: number,
) =>
  total > 0
    ? (value / total) * 100
    : 0;

const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export default function DashboardPage() {
  const [clients, setClients] =
    useState<Client[]>([]);

  const [views, setViews] =
    useState<View[]>([]);

  const [clientId, setClientId] =
    useState("");

  const [viewId, setViewId] =
    useState("");

  const [classFilter, setClassFilter] =
    useState("");

  const [annotationTypeFilter, setAnnotationTypeFilter] =
    useState("");

  const [data, setData] =
    useState<DashboardData | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [loadingViews, setLoadingViews] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadClients() {
      try {
        const result =
          await api<Client[]>(
            "/api/clients",
          );

        setClients(result);
      } catch (value) {
        setError(
          value instanceof Error
            ? value.message
            : "Failed to load clients.",
        );
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
        setLoadingViews(true);

        const result =
          await api<View[]>(
            `/api/views?clientId=${encodeURIComponent(
              clientId,
            )}`,
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
      } finally {
        setLoadingViews(false);
      }
    }

    void loadViews();
  }, [clientId]);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const params =
          new URLSearchParams();

        if (clientId) {
          params.set(
            "clientId",
            clientId,
          );
        }

        if (viewId) {
          params.set(
            "viewId",
            viewId,
          );
        }

        if (classFilter) {
          params.set(
            "className",
            classFilter,
          );
        }

        if (annotationTypeFilter) {
          params.set(
            "annotationType",
            annotationTypeFilter,
          );
        }

        const query =
          params.toString();

        const result =
          await api<DashboardData>(
            query
              ? `/api/dashboard?${query}`
              : "/api/dashboard",
          );

        setData(result);
      } catch (value) {
        setError(
          value instanceof Error
            ? value.message
            : "Failed to load dashboard.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, [
    clientId,
    viewId,
    classFilter,
    annotationTypeFilter,
  ]);

  const dashboard =
    data ?? emptyData;

  const stats = {
    clients:
      dashboard.stats?.clients ??
      0,

    views:
      dashboard.stats?.views ??
      0,

    users:
      dashboard.stats?.users ??
      0,

    images:
      dashboard.stats?.images ??
      0,

    annotatedImages:
      dashboard.stats
        ?.annotatedImages ??
      0,

    backgroundImages:
      dashboard.stats
        ?.backgroundImages ??
      0,

    annotations:
      dashboard.stats
        ?.annotations ??
      0,

    classes:
      dashboard.stats?.classes ??
      0,

    averageAnnotationsPerImage:
      dashboard.stats
        ?.averageAnnotationsPerImage ??
      0,

    annotationCoverage:
      dashboard.stats
        ?.annotationCoverage ??
      0,
  };

  const annotationClasses =
    dashboard.annotationClasses ??
    [];

  const annotationTypes =
    dashboard.annotationTypes ??
    [];

  const datasetTypes =
    dashboard.datasetTypes ??
    [];

  const dashboardClients =
    dashboard.clients ?? [];

  const dashboardViews =
    dashboard.views ?? [];

  const selectedClient =
    clients.find(
      (client) =>
        client.id === clientId,
    );

  const selectedView =
    views.find(
      (view) =>
        view.id === viewId,
    );

  const selectedScope =
    selectedView?.name ??
    selectedClient?.name ??
    "Global";

  const selectedClass =
    annotationClasses.find(
      (item) =>
        item.className ===
        classFilter,
    );

  const classTotal =
    annotationClasses.reduce(
      (sum, item) =>
        sum + item.count,
      0,
    );

  const typeTotal =
    annotationTypes.reduce(
      (sum, item) =>
        sum + item.count,
      0,
    );

  const datasetTotal =
    datasetTypes.reduce(
      (sum, item) =>
        sum + item.images,
      0,
    );

  const topClasses =
    useMemo(
      () =>
        [...annotationClasses]
          .sort(
            (a, b) =>
              b.count - a.count,
          )
          .slice(0, 10),
      [annotationClasses],
    );

  const clientChartData =
    useMemo(
      () =>
        [...dashboardClients]
          .sort(
            (a, b) =>
              b.images - a.images,
          ),
      [dashboardClients],
    );

  const viewChartData =
    useMemo(
      () =>
        [...dashboardViews]
          .sort(
            (a, b) =>
              b.images - a.images,
          ),
      [dashboardViews],
    );

  const maxClass =
    Math.max(
      ...topClasses.map(
        (item) => item.count,
      ),
      0,
    );

  const maxClient =
    Math.max(
      ...clientChartData.map(
        (item) => item.images,
      ),
      0,
    );

  const maxView =
    Math.max(
      ...viewChartData.map(
        (item) => item.images,
      ),
      0,
    );

  const clearFilters = () => {
    setClientId("");
    setViewId("");
    setClassFilter("");
    setAnnotationTypeFilter("");
  };

  const hasFilters =
    Boolean(
      clientId ||
        viewId ||
        classFilter ||
        annotationTypeFilter,
    );

  const annotatedImages =
    stats.annotatedImages ||
    Math.max(
      stats.images -
        stats.backgroundImages,
      0,
    );

  const backgroundImages =
    stats.backgroundImages ||
    Math.max(
      stats.images -
        annotatedImages,
      0,
    );

  const coverage =
    stats.annotationCoverage ||
    percentage(
      annotatedImages,
      stats.images,
    );

  const imageComposition = [
    {
      label: "Annotated",
      value: annotatedImages,
    },
    {
      label: "Background",
      value: backgroundImages,
    },
  ];

  return (
    <main className="min-h-full bg-background p-5">
      <div className="mx-auto max-w-[1700px] space-y-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Dashboard
            </h1>
          </div>
        </header>

        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold">
                Filters
              </p>

              <p className="text-xs text-muted-foreground">
                All charts and metrics use
                the current dashboard scope.
              </p>
            </div>

            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FilterSelect
              label="Client"
              value={clientId}
              onChange={(value) => {
                setClientId(value);
                setViewId("");
              }}
            >
              <option value="">
                All clients
              </option>

              {clients.map(
                (client) => (
                  <option
                    key={client.id}
                    value={client.id}
                  >
                    {client.name}
                  </option>
                ),
              )}
            </FilterSelect>

            <FilterSelect
              label="View"
              value={viewId}
              disabled={
                !clientId ||
                loadingViews
              }
              onChange={setViewId}
            >
              <option value="">
                {loadingViews
                  ? "Loading views..."
                  : clientId
                    ? "All views"
                    : "Select client first"}
              </option>

              {views.map(
                (view) => (
                  <option
                    key={view.id}
                    value={view.id}
                  >
                    {view.name}
                  </option>
                ),
              )}
            </FilterSelect>

            <FilterSelect
              label="Class"
              value={classFilter}
              onChange={setClassFilter}
            >
              <option value="">
                All classes
              </option>

              {annotationClasses.map(
                (item) => (
                  <option
                    key={`${item.classId ?? "x"}-${item.className}`}
                    value={item.className}
                  >
                    {item.className}
                  </option>
                ),
              )}
            </FilterSelect>

            <FilterSelect
              label="Annotation type"
              value={annotationTypeFilter}
              onChange={
                setAnnotationTypeFilter
              }
            >
              <option value="">
                All annotation types
              </option>

              {annotationTypes.map(
                (item) => (
                  <option
                    key={item.type}
                    value={item.type}
                  >
                    {item.type}
                  </option>
                ),
              )}
            </FilterSelect>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-md bg-muted px-2.5 py-1 text-foreground">
              {selectedClient?.name ??
                "All Clients"}
            </span>

            <span>/</span>

            <span className="rounded-md bg-muted px-2.5 py-1 text-foreground">
              {selectedView?.name ??
                "All Views"}
            </span>

            {classFilter && (
              <>
                <span>/</span>

                <span className="rounded-md bg-muted px-2.5 py-1 text-foreground">
                  {classFilter}
                </span>
              </>
            )}

            {annotationTypeFilter && (
              <>
                <span>/</span>

                <span className="rounded-md bg-muted px-2.5 py-1 text-foreground">
                  {annotationTypeFilter}
                </span>
              </>
            )}

            {loading && (
              <span className="ml-1 animate-pulse">
                Updating...
              </span>
            )}
          </div>
        </section>

        {error && (
          <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm text-destructive">
              {error}
            </p>
          </section>
        )}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            icon={FileImage}
            label="Images"
            value={compact(
              stats.images,
            )}
            detail={`${number(
              stats.images,
            )} images in scope`}
          />

          <MetricCard
            icon={ScanSearch}
            label="Annotations"
            value={compact(
              stats.annotations,
            )}
            detail={`${number(
              stats.annotations,
            )} detected annotations`}
          />

          <MetricCard
            icon={Users}
            label="Clients"
            value={number(
              stats.clients,
            )}
            detail={`${number(
              stats.views,
            )} views across clients`}
          />

          <MetricCard
            icon={BarChart3}
            label="Avg / Image"
            value={stats.averageAnnotationsPerImage.toFixed(
              2,
            )}
            detail="annotations per image"
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Panel
            title="Annotation Distribution"
            subtitle="Share of all annotations by class"
            value={`${number(
              classTotal,
            )} annotations`}
          >
            <div className="grid min-h-[330px] gap-6 md:grid-cols-[260px_1fr] md:items-center">
              <DonutChart
                data={annotationClasses.map(
                  (item) => ({
                    label:
                      item.className,
                    value:
                      item.count,
                  }),
                )}
                total={classTotal}
                centerLabel="Annotations"
                onSelect={(label) =>
                  setClassFilter(
                    classFilter === label
                      ? ""
                      : label,
                  )
                }
              />

              <LegendList
                data={annotationClasses
                  .slice()
                  .sort(
                    (a, b) =>
                      b.count -
                      a.count,
                  )
                  .slice(0, 8)
                  .map(
                    (item) => ({
                      label:
                        item.className,
                      value:
                        item.count,
                    }),
                  )}
                total={classTotal}
                onSelect={(label) =>
                  setClassFilter(
                    classFilter === label
                      ? ""
                      : label,
                  )
                }
              />
            </div>
          </Panel>

          <Panel
            title="Dataset Type Distribution"
            subtitle="Images grouped by dataset/model type"
            value={
              datasetTypes.length
                ? `${number(
                    datasetTotal,
                  )} images`
                : "No dataset breakdown"
            }
          >
            {datasetTypes.length ? (
              <div className="grid min-h-[330px] gap-6 md:grid-cols-[260px_1fr] md:items-center">
                <DonutChart
                  data={datasetTypes.map(
                    (item) => ({
                      label:
                        item.datasetType,
                      value:
                        item.images,
                    }),
                  )}
                  total={datasetTotal}
                  centerLabel="Images"
                />

                <LegendList
                  data={datasetTypes.map(
                    (item) => ({
                      label:
                        item.datasetType,
                      value:
                        item.images,
                    }),
                  )}
                  total={datasetTotal}
                />
              </div>
            ) : (
              <EmptyChart
                message="Dataset type analytics will appear here."
              />
            )}
          </Panel>
        </section>

        <Panel
          title={
            clientId
              ? "Images by View"
              : "Images by Client"
          }
          subtitle={
            clientId
              ? "Image volume across views"
              : "Image volume across clients"
          }
          value={
            clientId
              ? `${viewChartData.length} views`
              : `${clientChartData.length} clients`
          }
        >
          <div className="p-5">
            {clientId ? (
              viewChartData.length ? (
                <VerticalBarChart
                  data={viewChartData.map(
                    (item) => ({
                      id: item.viewId,
                      label:
                        item.viewName,
                      primary:
                        item.images,
                      secondary:
                        item.annotations,
                    }),
                  )}
                  max={maxView}
                  primaryLabel="Images"
                  secondaryLabel="Annotations"
                  onSelect={(id) =>
                    setViewId(id)
                  }
                />
              ) : (
                <EmptyChart />
              )
            ) : clientChartData.length ? (
              <VerticalBarChart
                data={clientChartData.map(
                  (item) => ({
                    id: item.clientId,
                    label:
                      item.clientName,
                    primary:
                      item.images,
                    secondary:
                      item.annotations,
                  }),
                )}
                max={maxClient}
                primaryLabel="Images"
                secondaryLabel="Annotations"
                onSelect={(id) =>
                  setClientId(id)
                }
              />
            ) : (
              <EmptyChart />
            )}
          </div>
        </Panel>

        <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <Panel
            title="Annotation Classes"
            subtitle="Horizontal distribution by annotation count"
            value={`${number(
              classTotal,
            )} total`}
          >
            <div className="p-5">
              {topClasses.length ? (
                <div className="space-y-4">
                  {topClasses.map(
                    (
                      item,
                      index,
                    ) => {
                      const width =
                        maxClass
                          ? (item.count /
                              maxClass) *
                            100
                          : 0;

                      const share =
                        percentage(
                          item.count,
                          classTotal,
                        );

                      const active =
                        classFilter ===
                        item.className;

                      return (
                        <button
                          key={`${item.className}-${index}`}
                          type="button"
                          onClick={() =>
                            setClassFilter(
                              active
                                ? ""
                                : item.className,
                            )
                          }
                          className="group block w-full text-left"
                        >
                          <div className="mb-1.5 flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-semibold">
                                {index +
                                  1}
                              </span>

                              <span className="truncate text-xs font-medium">
                                {
                                  item.className
                                }
                              </span>
                            </div>

                            <div className="flex shrink-0 items-center gap-2 text-[11px]">
                              <span className="text-muted-foreground">
                                {share.toFixed(
                                  1,
                                )}
                                %
                              </span>

                              <span className="font-semibold tabular-nums">
                                {number(
                                  item.count,
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${width}%`,
                                background:
                                  chartColors[
                                    index %
                                      chartColors.length
                                  ],
                              }}
                            />
                          </div>
                        </button>
                      );
                    },
                  )}
                </div>
              ) : (
                <EmptyChart />
              )}
            </div>
          </Panel>

          <Panel
            title="Image Composition"
            subtitle="Annotated versus background images"
            value={`${coverage.toFixed(
              1,
            )}% covered`}
          >
            <div className="p-5">
              <div className="flex min-h-[300px] flex-col items-center justify-center gap-7">
                <DonutChart
                  data={imageComposition}
                  total={stats.images}
                  centerLabel="Images"
                />

                <div className="grid w-full grid-cols-2 gap-3">
                  <StatBox
                    label="Annotated"
                    value={annotatedImages}
                    percentage={percentage(
                      annotatedImages,
                      stats.images,
                    )}
                  />

                  <StatBox
                    label="Background"
                    value={backgroundImages}
                    percentage={percentage(
                      backgroundImages,
                      stats.images,
                    )}
                  />
                </div>
              </div>
            </div>
          </Panel>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InsightCard
            icon={Layers3}
            title="Classes tracked"
            value={number(
              stats.classes,
            )}
            description="Distinct annotation classes present in the current scope."
          />

          <InsightCard
            icon={ScanSearch}
            title="Annotation density"
            value={`${stats.averageAnnotationsPerImage.toFixed(
              2,
            )} / image`}
            description="Average number of annotations associated with each image."
          />

          <InsightCard
            icon={FileImage}
            title="Annotated images"
            value={compact(
              annotatedImages,
            )}
            description={`${coverage.toFixed(
              1,
            )}% of images contain annotations.`}
          />

          <InsightCard
            icon={Users}
            title="Users"
            value={number(
              stats.users,
            )}
            description="Registered users in the data management system."
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Panel
            title="Client / View Insights"
            subtitle="Current scope distribution"
            value={selectedScope}
          >
            <div className="divide-y">
              {(clientId
                ? viewChartData
                : clientChartData
              )
                .slice(0, 8)
                .map(
                  (item) => {
                    const images =
                      item.images;

                    const annotations =
                      item.annotations;

                    const coverageValue =
                      percentage(
                        annotations,
                        images,
                      );

                    return (
                      <div
                        key={
                          "viewId" in item
                            ? item.viewId
                            : item.clientId
                        }
                        className="flex items-center justify-between gap-4 px-5 py-4"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {"viewId" in item
                              ? item.viewName
                              : item.clientName}
                          </p>

                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {number(
                              images,
                            )}{" "}
                            images ·{" "}
                            {number(
                              annotations,
                            )}{" "}
                            annotations
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold tabular-nums">
                            {coverageValue.toFixed(
                              2,
                            )}
                          </p>

                          <p className="text-[10px] text-muted-foreground">
                            annotations/image
                          </p>
                        </div>
                      </div>
                    );
                  },
                )}

              {!(
                clientId
                  ? viewChartData
                  : clientChartData
              ).length && (
                <EmptyChart />
              )}
            </div>
          </Panel>

          <Panel
            title="Dataset Insights"
            subtitle="Current dashboard scope"
            value={selectedScope}
          >
            <div className="grid grid-cols-2 gap-px bg-border">
              <MiniStat
                icon={Database}
                label="Views"
                value={number(
                  stats.views,
                )}
              />

              <MiniStat
                icon={Users}
                label="Clients"
                value={number(
                  stats.clients,
                )}
              />

              <MiniStat
                icon={FileImage}
                label="Images"
                value={compact(
                  stats.images,
                )}
              />

              <MiniStat
                icon={ScanSearch}
                label="Annotations"
                value={compact(
                  stats.annotations,
                )}
              />

              <MiniStat
                icon={Layers3}
                label="Classes"
                value={number(
                  stats.classes,
                )}
              />

              <MiniStat
                icon={Users}
                label="Users"
                value={number(
                  stats.users,
                )}
              />
            </div>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  disabled,
  children,
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </label>

      <div className="relative">
        <select
          value={value}
          disabled={disabled}
          onChange={(event) =>
            onChange(
              event.target.value,
            )
          }
          className="h-10 w-full appearance-none rounded-lg border bg-background px-3 pr-9 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {children}
        </select>

        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ComponentType<{
    className?: string;
  }>;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="group rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">
            {label}
          </p>

          <p className="mt-1.5 text-2xl font-semibold tracking-tight">
            {value}
          </p>
        </div>

        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <Icon className="size-4" />
        </div>
      </div>

      <p className="mt-2 truncate text-[11px] text-muted-foreground">
        {detail}
      </p>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  value,
  children,
}: {
  title: string;
  subtitle: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">
            {title}
          </h2>

          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {subtitle}
          </p>
        </div>

        <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-[10px] font-medium tabular-nums text-muted-foreground">
          {value}
        </span>
      </div>

      {children}
    </section>
  );
}

function DonutChart({
  data,
  total,
  centerLabel,
  onSelect,
}: {
  data: {
    label: string;
    value: number;
  }[];
  total: number;
  centerLabel: string;
  onSelect?: (
    label: string,
  ) => void;
}) {
  if (!data.length || !total) {
    return (
      <EmptyChart />
    );
  }

  const radius = 70;
  const circumference =
    2 * Math.PI * radius;

  let offset = 0;

  const visibleData =
    data
      .filter(
        (item) =>
          item.value > 0,
      )
      .slice(0, 8);

  return (
    <div className="relative mx-auto size-56">
      <svg
        viewBox="0 0 180 180"
        className="size-full -rotate-90"
      >
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="18"
          className="text-muted"
        />

        {visibleData.map(
          (
            item,
            index,
          ) => {
            const fraction =
              item.value /
              total;

            const length =
              fraction *
              circumference;

            const currentOffset =
              offset;

            offset += length;

            return (
              <circle
                key={`${item.label}-${index}`}
                cx="90"
                cy="90"
                r={radius}
                fill="none"
                stroke={
                  chartColors[
                    index %
                      chartColors.length
                  ]
                }
                strokeWidth="18"
                strokeDasharray={`${length} ${
                  circumference -
                  length
                }`}
                strokeDashoffset={
                  -currentOffset
                }
                className="cursor-pointer transition-opacity hover:opacity-70"
                onClick={() =>
                  onSelect?.(
                    item.label,
                  )
                }
              >
                <title>
                  {item.label}:{" "}
                  {number(
                    item.value,
                  )}{" "}
                  (
                  {(
                    fraction *
                    100
                  ).toFixed(
                    1,
                  )}
                  %)
                </title>
              </circle>
            );
          },
        )}
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tracking-tight">
          {compact(total)}
        </span>

        <span className="text-[10px] text-muted-foreground">
          {centerLabel}
        </span>
      </div>
    </div>
  );
}

function LegendList({
  data,
  total,
  onSelect,
}: {
  data: {
    label: string;
    value: number;
  }[];
  total: number;
  onSelect?: (
    label: string,
  ) => void;
}) {
  return (
    <div className="space-y-3">
      {data.map(
        (
          item,
          index,
        ) => {
          const share =
            percentage(
              item.value,
              total,
            );

          return (
            <button
              key={item.label}
              type="button"
              onClick={() =>
                onSelect?.(
                  item.label,
                )
              }
              className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{
                  background:
                    chartColors[
                      index %
                        chartColors.length
                    ],
                }}
              />

              <span className="min-w-0 flex-1 truncate text-xs">
                {item.label}
              </span>

              <span className="text-[11px] text-muted-foreground">
                {share.toFixed(1)}%
              </span>

              <span className="w-12 text-right text-xs font-semibold tabular-nums">
                {compact(
                  item.value,
                )}
              </span>
            </button>
          );
        },
      )}
    </div>
  );
}

function VerticalBarChart({
  data,
  max,
  primaryLabel,
  secondaryLabel,
  onSelect,
}: {
  data: {
    id: string;
    label: string;
    primary: number;
    secondary: number;
  }[];
  max: number;
  primaryLabel: string;
  secondaryLabel: string;
  onSelect?: (
    id: string,
  ) => void;
}) {
  const visible =
    data.slice(0, 12);

  return (
    <div className="w-full">
      <div className="mb-5 flex items-center gap-5 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span
            className="size-2.5 rounded-sm"
            style={{
              background:
                chartColors[0],
            }}
          />
          {primaryLabel}
        </div>

        <div className="flex items-center gap-2">
          <span
            className="size-2.5 rounded-sm"
            style={{
              background:
                chartColors[1],
            }}
          />
          {secondaryLabel}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div
          className="flex min-w-[680px] items-end gap-5 border-b border-l px-4 pt-5"
          style={{
            height: 330,
          }}
        >
          {visible.map(
            (
              item,
              index,
            ) => {
              const primaryHeight =
                max
                  ? (item.primary /
                      max) *
                    100
                  : 0;

              const secondaryHeight =
                max
                  ? (item.secondary /
                      max) *
                    100
                  : 0;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    onSelect?.(
                      item.id,
                    )
                  }
                  className="group flex h-full min-w-12 flex-1 flex-col justify-end"
                  title={`${item.label}: ${number(
                    item.primary,
                  )} images, ${number(
                    item.secondary,
                  )} annotations`}
                >
                  <div className="mb-2 text-center text-[10px] font-medium opacity-0 transition-opacity group-hover:opacity-100">
                    {number(
                      item.primary,
                    )}
                  </div>

                  <div className="flex h-full items-end justify-center gap-1">
                    <div
                      className="w-4 rounded-t-sm transition-all duration-300 group-hover:opacity-80"
                      style={{
                        height: `${Math.max(
                          primaryHeight,
                          item.primary
                            ? 2
                            : 0,
                        )}%`,
                        background:
                          chartColors[0],
                      }}
                    />

                    <div
                      className="w-4 rounded-t-sm transition-all duration-300 group-hover:opacity-80"
                      style={{
                        height: `${Math.max(
                          secondaryHeight,
                          item.secondary
                            ? 2
                            : 0,
                        )}%`,
                        background:
                          chartColors[1],
                      }}
                    />
                  </div>

                  <span className="mt-2 truncate text-center text-[10px] text-muted-foreground">
                    {item.label}
                  </span>

                  <span className="mt-1 truncate text-center text-[9px] text-muted-foreground/70">
                    {compact(
                      item.primary,
                    )}
                  </span>
                </button>
              );
            },
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  percentage: percent,
}: {
  label: string;
  value: number;
  percentage: number;
}) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-[11px] text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 text-lg font-semibold tabular-nums">
        {number(value)}
      </p>

      <p className="mt-0.5 text-[10px] text-muted-foreground">
        {percent.toFixed(1)}%
      </p>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{
    className?: string;
  }>;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          {label}
        </p>

        <Icon className="size-3.5 text-muted-foreground" />
      </div>

      <p className="text-lg font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
}

function InsightCard({
  icon: Icon,
  title,
  value,
  description,
}: {
  icon: React.ComponentType<{
    className?: string;
  }>;
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-4" />
        </div>

        <span className="text-[10px] text-muted-foreground">
          Current scope
        </span>
      </div>

      <p className="text-xs font-medium text-muted-foreground">
        {title}
      </p>

      <p className="mt-1 text-xl font-semibold">
        {value}
      </p>

      <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function EmptyChart({
  message = "No data available",
}: {
  message?: string;
}) {
  return (
    <div className="flex min-h-52 items-center justify-center text-xs text-muted-foreground">
      {message}
    </div>
  );
}