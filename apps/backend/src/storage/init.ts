import {
  mkdir
} from "node:fs/promises";

import {
  getRawRoot,
  getMetadataRoot
} from "./paths.js";

export async function initializeStorage(): Promise<void> {
  await mkdir(
    getRawRoot(),
    { recursive: true }
  );

  await mkdir(
    getMetadataRoot(),
    { recursive: true }
  );
}
