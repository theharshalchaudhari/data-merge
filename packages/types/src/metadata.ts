import type {
  Annotation,
  AnnotationType
} from "./annotation.js";

export interface MetadataRecord {
  id: string;

  client_id: string;

  client_name: string;

  view_id: string;

  view_name: string;

  name: string;

  annotation_type:
    AnnotationType;

  annotations:
    Annotation[];

  image_hash: string;

  root_folders:
    string[];

  original_root_folders:
    string[];

  source_locations:
    string[];

  description:
    string | null;

  created_at: string;

  updated_at: string;
}

export interface MetadataListResponse {
  items:
    MetadataRecord[];

  page: number;

  limit: number;

  total: number;

  totalPages: number;
}
