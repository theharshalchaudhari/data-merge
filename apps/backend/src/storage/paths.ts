import path from "node:path";

import { env } from "../config/env.js";

export const DATA_ROOT = path.resolve(env.DATA_ROOT);

export function getRawRoot(): string {
  return path.join(DATA_ROOT, "raw");
}

export function getMetadataRoot(): string {
  return path.join(DATA_ROOT, "metadata");
}

export function getRawClientPath(
  clientName: string,
): string {
  return path.join(
    getRawRoot(),
    clientName,
  );
}

export function getMetadataClientPath(
  clientName: string,
): string {
  return path.join(
    getMetadataRoot(),
    clientName,
  );
}

export function getMetadataImagePath(
  clientName: string,
  imageName: string,
): string {
  return path.join(
    getMetadataClientPath(clientName),
    "images",
    imageName,
  );
}

export function getMetadataLabelPath(
  clientName: string,
  imageName: string,
): string {
  const stem = path.parse(imageName).name;

  return path.join(
    getMetadataClientPath(clientName),
    "labels",
    `${stem}.txt`,
  );
}