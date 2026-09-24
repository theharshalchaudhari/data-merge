export interface DashboardStats {
  clients: number;
  views: number;
  images: number;
  annotations: number;
  users: number;
}

export interface ClientStatistics {
  client_id: string;
  client_name: string;
  images: number;
  annotations: number;
}

export interface ViewStatistics {
  view_id: string;
  view_name: string;
  images: number;
  annotations: number;
}

export interface DashboardResponse {
  stats: DashboardStats;
  clients: ClientStatistics[];
  views: ViewStatistics[];
}
