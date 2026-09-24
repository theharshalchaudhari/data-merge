export interface DashboardStats {
  clients: number;
  images: number;
  labels: number;
  annotations: number;
}

export interface ClientStatistics {
  clientId: string;
  clientName: string;
  images: number;
  annotations: number;
}

export interface ViewStatistics {
  viewId: string;
  viewName: string;
  images: number;
  annotations: number;
}

export interface ClassStatistics {
  classId: number;
  className: string;
  count: number;
}

export interface DashboardResponse {
  stats: DashboardStats;

  byClient: ClientStatistics[];
  byView: ViewStatistics[];
  byClass: ClassStatistics[];
}