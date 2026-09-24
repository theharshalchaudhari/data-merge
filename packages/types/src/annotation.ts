export type AnnotationType =
  | "bbox"
  | "polygon"
  | "segmentation";

export interface BoundingBoxGeometry {
  format: "yolo_bbox";

  values: [
    number,
    number,
    number,
    number,
    number
  ];
}

export interface PolygonGeometry {
  format: "polygon";

  points:
    Array<
      [number, number]
    >;
}

export interface SegmentationGeometry {
  format: "segmentation";

  points:
    Array<
      [number, number]
    >;
}

export type AnnotationGeometry =
  | BoundingBoxGeometry
  | PolygonGeometry
  | SegmentationGeometry;

export interface Annotation {
  classId: number;

  className: string;

  geometry:
    AnnotationGeometry;
}
