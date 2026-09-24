export type AnnotationType =
  | "bbox"
  | "polygon"
  | "segmentation";

export interface BoundingBoxGeometry {
  format: "yolo_bbox";
  values: [
    classId: number,
    xCenter: number,
    yCenter: number,
    width: number,
    height: number
  ];
}

export interface PolygonGeometry {
  format: "polygon";
  points: Array<[number, number]>;
}

export interface SegmentationGeometry {
  format: "segmentation";
  points: Array<[number, number]>;
}

export type AnnotationGeometry =
  | BoundingBoxGeometry
  | PolygonGeometry
  | SegmentationGeometry;

export interface Annotation {
  classId: number;
  className: string;
  geometry: AnnotationGeometry;
}