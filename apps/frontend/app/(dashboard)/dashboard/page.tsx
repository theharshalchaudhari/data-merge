"use client";

import { useEffect, useMemo, useState } from "react";
import type { Client, View } from "@data-manage/types";
import { api } from "../../../lib/api";

type DashboardClass = { classId: number; className: string; count: number };
type DashboardType = { type: string; count: number };
type DashboardView = { viewId: string; viewName: string; images: number; annotations: number };
type DashboardClient = { clientId: string; clientName: string; images: number; annotations: number };
type DashboardStats = {
  clients: number;
  views: number;
  images: number;
  annotations: number;
  users: number;
  classes: number;
  averageAnnotationsPerImage: number;
};
type DashboardData = {
  stats?: Partial<DashboardStats>;
  annotationClasses?: DashboardClass[];
  annotationTypes?: DashboardType[];
  views?: DashboardView[];
  clients?: DashboardClient[];
};

const emptyData: DashboardData = {
  stats: {
    clients: 0,
    views: 0,
    images: 0,
    annotations: 0,
    users: 0,
    classes: 0,
    averageAnnotationsPerImage: 0,
  },
  annotationClasses: [],
  annotationTypes: [],
  views: [],
  clients: [],
};

const number = (value: number) => new Intl.NumberFormat("en-IN").format(value);

const compact = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  return number(value);
};

const percentage = (value: number, total: number) => total ? (value / total) * 100 : 0;

export default function DashboardPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [views, setViews] = useState<View[]>([]);
  const [clientId, setClientId] = useState("");
  const [viewId, setViewId] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingViews, setLoadingViews] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadClients() {
      try {
        setError("");
        setClients(await api<Client[]>("/api/clients"));
      } catch (value) {
        setError(value instanceof Error ? value.message : "Failed to load clients.");
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
        setError("");
        setViews(await api<View[]>(`/api/views?clientId=${encodeURIComponent(clientId)}`));
        setViewId("");
      } catch (value) {
        setViews([]);
        setViewId("");
        setError(value instanceof Error ? value.message : "Failed to load views.");
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

        const params = new URLSearchParams();
        if (clientId) params.set("clientId", clientId);
        if (viewId) params.set("viewId", viewId);

        const query = params.toString();
        const result = await api<DashboardData>(
          query ? `/api/dashboard?${query}` : "/api/dashboard",
        );

        setData(result);
      } catch (value) {
        setError(value instanceof Error ? value.message : "Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, [clientId, viewId]);

  const dashboard = data ?? emptyData;
  const stats = {
    clients: dashboard.stats?.clients ?? 0,
    views: dashboard.stats?.views ?? 0,
    images: dashboard.stats?.images ?? 0,
    annotations: dashboard.stats?.annotations ?? 0,
    classes: dashboard.stats?.classes ?? 0,
    averageAnnotationsPerImage: dashboard.stats?.averageAnnotationsPerImage ?? 0,
  };

  const annotationClasses = dashboard.annotationClasses ?? [];
  const annotationTypes = dashboard.annotationTypes ?? [];
  const dashboardViews = dashboard.views ?? [];
  const dashboardClients = dashboard.clients ?? [];

  const selectedClient = clients.find((client) => client.id === clientId);
  const selectedView = views.find((view) => view.id === viewId);

  const topClasses = useMemo(
    () => [...annotationClasses].sort((a, b) => b.count - a.count).slice(0, 7),
    [annotationClasses],
  );

  const classTotal = useMemo(
    () => annotationClasses.reduce((sum, item) => sum + item.count, 0),
    [annotationClasses],
  );

  const typeTotal = useMemo(
    () => annotationTypes.reduce((sum, item) => sum + item.count, 0),
    [annotationTypes],
  );

  const maxClass = Math.max(...topClasses.map((item) => item.count), 0);
  const maxView = Math.max(...dashboardViews.map((item) => item.annotations), 0);
  const maxClient = Math.max(...dashboardClients.map((item) => item.annotations), 0);

  if (error) {
    return (
      <main className="p-5">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full space-y-4 p-5">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-xs text-muted-foreground">Dataset analytics and annotation overview</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setViewId("");
            }}
            className="h-9 min-w-40 rounded-lg border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>

          <select
            value={viewId}
            disabled={!clientId || loadingViews}
            onChange={(e) => setViewId(e.target.value)}
            className="h-9 min-w-40 rounded-lg border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            <option value="">
              {loadingViews ? "Loading views..." : clientId ? "All Views" : "Select client"}
            </option>
            {views.map((view) => (
              <option key={view.id} value={view.id}>{view.name}</option>
            ))}
          </select>
        </div>
      </header>

      <div className="flex min-h-6 items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-md bg-muted px-2 py-1 text-foreground">
          {selectedClient?.name ?? "All Clients"}
        </span>
        <span>/</span>
        <span className="rounded-md bg-muted px-2 py-1 text-foreground">
          {selectedView?.name ?? "All Views"}
        </span>
        {loading && <span className="ml-1 animate-pulse">Updating...</span>}
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Images" value={compact(stats.images)} detail={number(stats.images)} />
        <MetricCard label="Annotations" value={compact(stats.annotations)} detail={number(stats.annotations)} />
        <MetricCard label="Classes" value={number(stats.classes)} detail="detected classes" />
        <MetricCard label="Avg / Image" value={stats.averageAnnotationsPerImage.toFixed(2)} detail="annotations per image" />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-xl border bg-card">
          <PanelHeader
            title="Annotation Classes"
            subtitle="Distribution by class"
            value={`${number(classTotal)} total`}
          />

          <div className="space-y-3 px-5 pb-5 pt-4">
            {topClasses.length === 0 ? (
              <EmptyChart />
            ) : (
              topClasses.map((item, index) => {
                const percent = percentage(item.count, classTotal);
                const width = maxClass ? (item.count / maxClass) * 100 : 0;

                return (
                  <div
                    key={`${item.classId}-${item.className}-${index}`}
                    className="group relative"
                    title={`${item.className}: ${number(item.count)} annotations (${percent.toFixed(1)}%)`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="truncate text-xs font-medium">{item.className}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {compact(item.count)}
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${width}%` }}
                      />
                    </div>

                    <div className="pointer-events-none absolute right-0 top-0 z-10 hidden rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md group-hover:block">
                      <div className="font-medium">{item.className}</div>
                      <div className="text-muted-foreground">
                        {number(item.count)} annotations · {percent.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card">
          <PanelHeader
            title="Annotation Types"
            subtitle="Geometry distribution"
            value={`${number(typeTotal)} total`}
          />

          <div className="flex min-h-57.5 items-center justify-center px-5 pb-5">
            <DonutChart data={annotationTypes} total={typeTotal} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card">
          <PanelHeader
            title={clientId ? "Views" : "Clients"}
            subtitle={clientId ? "Annotations by view" : "Annotations by client"}
            value={clientId ? `${dashboardViews.length} views` : `${dashboardClients.length} clients`}
          />

          <div className="space-y-3 px-5 pb-5 pt-4">
            {clientId ? (
              dashboardViews.length ? (
                dashboardViews
                  .slice()
                  .sort((a, b) => b.annotations - a.annotations)
                  .slice(0, 6)
                  .map((item, index) => (
                    <DistributionBar
                      key={`${item.viewId}-${item.viewName}-${index}`}
                      label={item.viewName}
                      count={item.annotations}
                      secondary={`${compact(item.images)} images`}
                      max={maxView}
                    />
                  ))
              ) : (
                <EmptyChart />
              )
            ) : dashboardClients.length ? (
              dashboardClients
                .slice()
                .sort((a, b) => b.annotations - a.annotations)
                .slice(0, 6)
                .map((item, index) => (
                  <DistributionBar
                    key={`${item.clientId}-${item.clientName}-${index}`}
                    label={item.clientName}
                    count={item.annotations}
                    secondary={`${compact(item.images)} images`}
                    max={maxClient}
                  />
                ))
            ) : (
              <EmptyChart />
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card">
          <PanelHeader
            title="Dataset Overview"
            subtitle="Current scope"
            value={selectedView?.name ?? selectedClient?.name ?? "Global"}
          />

          <div className="grid grid-cols-2 gap-px overflow-hidden bg-border">
            <MiniStat label="Clients" value={number(stats.clients)} />
            <MiniStat label="Views" value={number(stats.views)} />
            <MiniStat label="Images" value={compact(stats.images)} />
            <MiniStat label="Annotations" value={compact(stats.annotations)} />
          </div>

          <div className="border-t p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Annotation density</span>
              <span className="text-xs font-medium">
                {stats.averageAnnotationsPerImage.toFixed(2)} / image
              </span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${Math.min(stats.averageAnnotationsPerImage * 10, 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
      </div>
      <p className="mt-1 truncate text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function PanelHeader({
  title,
  subtitle,
  value,
}: {
  title: string;
  subtitle: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b px-5 py-3.5">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{value}</span>
    </div>
  );
}

function DistributionBar({
  label,
  count,
  secondary,
  max,
}: {
  label: string;
  count: number;
  secondary: string;
  max: number;
}) {
  const width = max ? (count / max) * 100 : 0;

  return (
    <div
      className="group relative"
      title={`${label}: ${number(count)} annotations`}
    >
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="truncate text-xs font-medium">{label}</span>
        <div className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
          <span>{secondary}</span>
          <span className="font-medium tabular-nums text-foreground">{compact(count)}</span>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${width}%` }}
        />
      </div>

      <div className="pointer-events-none absolute right-0 top-0 z-10 hidden rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md group-hover:block">
        <div className="font-medium">{label}</div>
        <div className="text-muted-foreground">{number(count)} annotations</div>
      </div>
    </div>
  );
}

function DonutChart({
  data,
  total,
}: {
  data: DashboardType[];
  total: number;
}) {
  if (!data.length) return <EmptyChart />;

  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex w-full items-center justify-center gap-6">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
          <circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="18"
            className="text-muted"
          />

          {data.map((item, index) => {
            const percent = total ? item.count / total : 0;
            const length = percent * circumference;
            const currentOffset = offset;
            offset += length;

            return (
              <circle
                key={`${item.type}-${index}`}
                cx="90"
                cy="90"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="18"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-currentOffset}
                strokeLinecap="butt"
                className={
                  index === 0
                    ? "text-primary"
                    : index === 1
                      ? "text-primary/60"
                      : index === 2
                        ? "text-primary/40"
                        : "text-primary/25"
                }
              >
                <title>
                  {item.type}: {number(item.count)} ({(percent * 100).toFixed(1)}%)
                </title>
              </circle>
            );
          })}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold">{compact(total)}</span>
          <span className="text-[10px] text-muted-foreground">annotations</span>
        </div>
      </div>

      <div className="min-w-0 space-y-2">
        {data.slice(0, 5).map((item, index) => {
          const percent = percentage(item.count, total);

          return (
            <div
              key={`${item.type}-${index}`}
              className="flex items-center gap-2"
              title={`${item.type}: ${number(item.count)} (${percent.toFixed(1)}%)`}
            >
              <span
                className={
                  index === 0
                    ? "h-2 w-2 shrink-0 rounded-full bg-primary"
                    : index === 1
                      ? "h-2 w-2 shrink-0 rounded-full bg-primary/60"
                      : index === 2
                        ? "h-2 w-2 shrink-0 rounded-full bg-primary/40"
                        : "h-2 w-2 shrink-0 rounded-full bg-primary/25"
                }
              />
              <span className="truncate text-xs">{item.type}</span>
              <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                {compact(item.count)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="bg-card p-4">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-36 items-center justify-center text-xs text-muted-foreground">
      No data available
    </div>
  );
}