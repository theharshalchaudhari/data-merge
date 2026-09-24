import type {
  Annotation,
  AnnotationType
} from "./annotation";

export interface MetadataRecord {
  id: string;

  clientId: string;
  clientName: string;

  viewId: string;
  viewName: string;

  name: string;

  annotationType: AnnotationType;

  annotations: Annotation[];

  imageHash: string;

  rootFolders: string[];
  originalRootFolders: string[];

  sourceLocations: string[];

  description: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface MetadataListQuery {
  page?: number;
  limit?: number;

  search?: string;

  clientId?: string;
  viewId?: string;

  annotationType?: AnnotationType;

  rootFolder?: string;
}

export interface MetadataListResponse {
  items: MetadataRecord[];

  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}