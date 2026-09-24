import type {
  Annotation,
  AnnotationType
} from "@data-manage/types";

export function dedupeAnnotations(
  annotations: Annotation[]
): Annotation[] {
  const seen =
    new Set<string>();

  const result: Annotation[] = [];

  for (const annotation of annotations) {
    const key =
      JSON.stringify(annotation);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(annotation);
  }

  return result;
}

export function inferAnnotationType(
  annotations: Annotation[]
): AnnotationType {
  if (!annotations.length) {
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
    formats.has("segmentation")
  ) {
    return "segmentation";
  }

  if (
    formats.has("polygon")
  ) {
    return "polygon";
  }

  return "bbox";
}
