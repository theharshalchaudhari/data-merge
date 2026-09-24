import path from "node:path";

import { env } from "../config/env.js";

const DATA_ROOT =
  path.resolve(env.DATA_ROOT);

function assertInsideDataRoot(
  targetPath: string
): string {
  const resolved =
    path.resolve(targetPath);

  const relative =
    path.relative(
      DATA_ROOT,
      resolved
    );

  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      "Resolved path is outside DATA_ROOT"
    );
  }

  return resolved;
}

function safeSegment(
  value: string
): string {
  const normalized =
    value.trim();

  if (!normalized) {
    throw new Error(
      "Path segment cannot be empty"
    );
  }

  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.includes("/") ||
    normalized.includes("\\")
  ) {
    throw new Error(
      `Invalid path segment: ${value}`
    );
  }

  return normalized;
}

export function getDataRoot(): string {
  return DATA_ROOT;
}

export function getRawRoot(): string {
  return assertInsideDataRoot(
    path.join(
      DATA_ROOT,
      "raw"
    )
  );
}

export function getMetadataRoot(): string {
  return assertInsideDataRoot(
    path.join(
      DATA_ROOT,
      "metadata"
    )
  );
}

export function getRawClientRoot(
  clientName: string
): string {
  return assertInsideDataRoot(
    path.join(
      getRawRoot(),
      safeSegment(clientName)
    )
  );
}

export function getRawSourcePath(
  clientName: string,
  rootFolder: string,
  relativePath: string
): string {
  const clientRoot =
    getRawClientRoot(
      clientName
    );

  const root =
    safeSegment(rootFolder);

  const normalizedRelative =
    relativePath
      .replaceAll("\\", "/");

  return assertInsideDataRoot(
    path.join(
      clientRoot,
      root,
      normalizedRelative
    )
  );
}

export function getMetadataClientRoot(
  clientName: string
): string {
  return assertInsideDataRoot(
    path.join(
      getMetadataRoot(),
      safeSegment(clientName)
    )
  );
}

export function getMetadataImagesRoot(
  clientName: string
): string {
  return assertInsideDataRoot(
    path.join(
      getMetadataClientRoot(
        clientName
      ),
      "images"
    )
  );
}

export function getMetadataLabelsRoot(
  clientName: string
): string {
  return assertInsideDataRoot(
    path.join(
      getMetadataClientRoot(
        clientName
      ),
      "labels"
    )
  );
}

export function getMetadataImagePath(
  clientName: string,
  imageName: string
): string {
  return assertInsideDataRoot(
    path.join(
      getMetadataImagesRoot(
        clientName
      ),
      safeSegment(imageName)
    )
  );
}

export function getMetadataLabelPath(
  clientName: string,
  imageName: string
): string {
  const extension =
    path.extname(imageName);

  const stem =
    path.basename(
      imageName,
      extension
    );

  return assertInsideDataRoot(
    path.join(
      getMetadataLabelsRoot(
        clientName
      ),
      `${stem}.txt`
    )
  );
}