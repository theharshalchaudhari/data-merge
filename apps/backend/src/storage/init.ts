import {
  mkdir
} from "node:fs/promises";

import {
  getMetadataRoot,
  getRawRoot
} from "./paths.js";

export async function initializeStorage(): Promise<void> {
  await mkdir(
    getRawRoot(),
    {
      recursive: true
    }
  );

  await mkdir(
    getMetadataRoot(),
    {
      recursive: true
    }
  );
}