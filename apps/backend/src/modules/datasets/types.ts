export type DatasetClass = {
  id: string;
  dataset_type_id: string;
  class_id: number;
  class_name: string;
};

export type DatasetType = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  classes: DatasetClass[];
};

export type DatasetUpload = {
  id: string;
  client_id: string;
  client_name: string;
  view_id: string;
  view_name: string;
  uploaded_by: string;
  uploader_name: string;
  username: string;
  dataset_type_id: string;
  dataset_type: string;
  folder_name: string;
  raw_folder_path: string;
  file_count: number;
  image_count: number;
  annotation_file_count: number;
  annotation_count: number;
  status: "completed" | "failed";
  created_at: string;
};

export type CreateDatasetTypeInput = {
  name: string;
  description?: string | null;
  classes: {
    class_id: number;
    class_name: string;
  }[];
};

export type UpdateDatasetTypeInput = {
  name?: string;
  description?: string | null;
};