import {
  access,
  copyFile,
  mkdir,
  readFile,
  writeFile
} from "node:fs/promises";

import path from "node:path";

import {
  getMetadataImagePath,
  getMetadataLabelPath
} from "./paths.js";

export async function fileExists(
  filePath: string
): Promise<boolean> {
  try {
    await access(filePath);

    return true;
  } catch {
    return false;
  }
}

export async function ensureParentDirectory(
  filePath: string
): Promise<void> {
  await mkdir(
    path.dirname(filePath),
    {
      recursive: true
    }
  );
}

export async function copyFileSafe(
  sourcePath: string,
  destinationPath: string
): Promise<void> {
  await ensureParentDirectory(
    destinationPath
  );

  await copyFile(
    sourcePath,
    destinationPath
  );
}

export async function readTextFile(
  filePath: string
): Promise<string> {
  return readFile(
    filePath,
    "utf8"
  );
}

export async function writeTextFile(
  filePath: string,
  content: string
): Promise<void> {
  await ensureParentDirectory(
    filePath
  );

  await writeFile(
    filePath,
    content,
    "utf8"
  );
}

export async function readMetadataLabel(
  clientName: string,
  imageName: string
): Promise<string | null> {
  const labelPath =
    getMetadataLabelPath(
      clientName,
      imageName
    );

  if (
    !(await fileExists(labelPath))
  ) {
    return null;
  }

  return readTextFile(
    labelPath
  );
}

export async function writeMetadataLabel(
  clientName: string,
  imageName: string,
  content: string
): Promise<void> {
  const labelPath =
    getMetadataLabelPath(
      clientName,
      imageName
    );

  await writeTextFile(
    labelPath,
    content
  );
}

export function getCanonicalImagePath(
  clientName: string,
  imageName: string
): string {
  return getMetadataImagePath(
    clientName,
    imageName
  );
}