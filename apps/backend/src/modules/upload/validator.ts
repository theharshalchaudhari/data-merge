export type Annotation = {
  classId: number;
  className: string;
  geometry: {
    format: "yolo_bbox";
    values: [
      number,
      number,
      number,
      number,
      number,
    ];
  };
};

export type AnnotationValidationResult = {
  valid: boolean;
  annotationCount: number;
  annotations: Annotation[];
  errors: string[];
};

export function validateYoloAnnotations(
  content: string,
): AnnotationValidationResult {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const errors: string[] = [];
  const annotations: Annotation[] = [];

  for (
    let index = 0;
    index < lines.length;
    index++
  ) {
    const line = lines[index];

    const parts = line.split(/\s+/);

    if (parts.length !== 5) {
      errors.push(
        `Line ${index + 1}: expected 5 values, received ${parts.length}.`,
      );

      continue;
    }

    const classId = Number(parts[0]);
    const x = Number(parts[1]);
    const y = Number(parts[2]);
    const width = Number(parts[3]);
    const height = Number(parts[4]);

    if (
      !Number.isInteger(classId) ||
      classId < 0
    ) {
      errors.push(
        `Line ${index + 1}: invalid class ID.`,
      );

      continue;
    }

    if (
      !Number.isFinite(x) ||
      x < 0 ||
      x > 1
    ) {
      errors.push(
        `Line ${index + 1}: x must be between 0 and 1.`,
      );

      continue;
    }

    if (
      !Number.isFinite(y) ||
      y < 0 ||
      y > 1
    ) {
      errors.push(
        `Line ${index + 1}: y must be between 0 and 1.`,
      );

      continue;
    }

    if (
      !Number.isFinite(width) ||
      width <= 0 ||
      width > 1
    ) {
      errors.push(
        `Line ${index + 1}: width must be greater than 0 and at most 1.`,
      );

      continue;
    }

    if (
      !Number.isFinite(height) ||
      height <= 0 ||
      height > 1
    ) {
      errors.push(
        `Line ${index + 1}: height must be greater than 0 and at most 1.`,
      );

      continue;
    }

    annotations.push({
      classId,
      className: String(classId),
      geometry: {
        format: "yolo_bbox",
        values: [
          classId,
          x,
          y,
          width,
          height,
        ],
      },
    });
  }

  return {
    valid: errors.length === 0,
    annotationCount: annotations.length,
    annotations,
    errors,
  };
}