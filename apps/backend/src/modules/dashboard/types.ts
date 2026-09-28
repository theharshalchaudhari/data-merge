export type DashboardStats = {
  clients: number;
  views: number;
  users: number;
  images: number;
  annotatedImages: number;
  backgroundImages: number;
  annotations: number;
  classes: number;
  averageAnnotationsPerImage: number;
};

export type DashboardClass = {
  classId: number | null;
  className: string;
  count: number;
};

export type DashboardAnnotationType = {
  type: string;
  count: number;
};

export type DashboardDatasetType = {
  datasetTypeId: string;
  datasetType: string;
  images: number;
  annotations: number;
  uploads: number;
};

export type DashboardClient = {
  clientId: string;
  clientName: string;
  images: number;
  annotations: number;
  annotatedImages: number;
  backgroundImages: number;
};

export type DashboardView = {
  viewId: string;
  viewName: string;
  clientId: string;
  clientName: string;
  images: number;
  annotations: number;
  annotatedImages: number;
  backgroundImages: number;
};

export type DashboardData = {
  stats: DashboardStats;
  annotationClasses: DashboardClass[];
  annotationTypes: DashboardAnnotationType[];
  datasetTypes: DashboardDatasetType[];
  clients: DashboardClient[];
  views: DashboardView[];
};