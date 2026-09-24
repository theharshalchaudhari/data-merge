import type {
  Annotation,
  AnnotationType
} from "@data-manage/types";

function annotationKey(
  annotation: Annotation
): string {
  return JSON.stringify(
    annotation
  );
}

export function mergeAnnotations(
  existing: Annotation[],
  incoming: Annotation[]
): Annotation[] {
  const annotations =
    new Map<
      string,
      Annotation
    >();

  for (
    const annotation of existing
  ) {
    annotations.set(
      annotationKey(annotation),
      annotation
    );
  }

  for (
    const annotation of incoming
  ) {
    annotations.set(
      annotationKey(annotation),
      annotation
    );
  }

  return Array.from(
    annotations.values()
  );
}

export function inferAnnotationType(
  annotations: Annotation[]
): AnnotationType {
  if (
    annotations.length === 0
  ) {
    return "bbox";
  }

  const formats =
    new Set(
      annotations.map(
        (annotation) =>
          annotation.geometry.format
      )
    );

  if (
    formats.has("polygon")
  ) {
    return "polygon";
  }

  if (
    formats.has("segmentation")
  ) {
    return "segmentation";
  }

  return "bbox";
}