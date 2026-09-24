import {
  access,
  copyFile,
  mkdir,
  writeFile
} from "node:fs/promises";

import path from "node:path";

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
    { recursive: true }
  );
}

export async function copyFileSafe(
  source: string,
  destination: string
): Promise<void> {
  await ensureParentDirectory(
    destination
  );

  await copyFile(
    source,
    destination
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
