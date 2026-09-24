import fs from "node:fs/promises";
import path from "node:path";

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".bmp",
]);

export type DatasetFile = {
  imagePath: string;
  labelPath: string | null;
  relativePath: string;
};

export type DatasetScanResult = {
  sourcePath: string;
  images: DatasetFile[];
  orphanLabels: string[];
};

async function walkDirectory(
  directory: string,
  files: string[],
): Promise<void> {
  const entries = await fs.readdir(
    directory,
    {
      withFileTypes: true,
    },
  );

  for (const entry of entries) {
    const fullPath = path.join(
      directory,
      entry.name,
    );

    if (entry.isDirectory()) {
      await walkDirectory(
        fullPath,
        files,
      );

      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }
}

function normalizeRelativePath(
  value: string,
): string {
  return value
    .replaceAll("\\", "/")
    .replace(/^\/+/, "");
}

function getPairKey(
  relativePath: string,
): string {
  return normalizeRelativePath(
    relativePath,
  )
    .replace(/\.[^.]+$/, "")
    .toLowerCase();
}

export async function scanDatasetFolder(
  directoryPath: string,
): Promise<DatasetScanResult> {
  const sourcePath = path.resolve(
    directoryPath,
  );

  const stat = await fs.stat(
    sourcePath,
  );

  if (!stat.isDirectory()) {
    throw new Error(
      "Upload staging path is not a directory.",
    );
  }

  const allFiles: string[] = [];

  await walkDirectory(
    sourcePath,
    allFiles,
  );

  const imageFiles =
    allFiles.filter((file) =>
      IMAGE_EXTENSIONS.has(
        path.extname(file).toLowerCase(),
      ),
    );

  const labelFiles =
    allFiles.filter(
      (file) =>
        path.extname(file).toLowerCase() ===
        ".txt",
    );

  const labelMap =
    new Map<string, string>();

  for (const labelPath of labelFiles) {
    const relativePath =
      normalizeRelativePath(
        path.relative(
          sourcePath,
          labelPath,
        ),
      );

    labelMap.set(
      getPairKey(relativePath),
      labelPath,
    );
  }

  const usedLabels =
    new Set<string>();

  const images: DatasetFile[] =
    imageFiles.map(
      (imagePath) => {
        const relativePath =
          normalizeRelativePath(
            path.relative(
              sourcePath,
              imagePath,
            ),
          );

        const key =
          getPairKey(relativePath);

        const labelPath =
          labelMap.get(key) ?? null;

        if (labelPath) {
          usedLabels.add(key);
        }

        return {
          imagePath,
          labelPath,
          relativePath,
        };
      },
    );

  const orphanLabels =
    labelFiles
      .filter((labelPath) => {
        const relativePath =
          normalizeRelativePath(
            path.relative(
              sourcePath,
              labelPath,
            ),
          );

        return !usedLabels.has(
          getPairKey(relativePath),
        );
      })
      .map((labelPath) =>
        normalizeRelativePath(
          path.relative(
            sourcePath,
            labelPath,
          ),
        ),
      );

  return {
    sourcePath,
    images,
    orphanLabels,
  };
}