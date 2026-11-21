import { readdir } from "node:fs/promises";
import path from "node:path";
import { IGNORED_DIRECTORY_NAMES } from "../scanner.js";

const IGNORED_DIRECTORIES = new Set<string>(IGNORED_DIRECTORY_NAMES);

/** Return regular files directly inside the project root without following links. */
export async function listRootFiles(rootPath: string): Promise<Set<string>> {
  const entries = await readdir(rootPath, { withFileTypes: true });
  return new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
}

/** List project-relative regular file paths without following symlinks. */
export async function listProjectFiles(rootPath: string): Promise<string[]> {
  async function visit(directoryPath: string): Promise<string[]> {
    let entries;
    try {
      entries = await readdir(directoryPath, { withFileTypes: true });
    } catch {
      return [];
    }

    const files: string[] = [];
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) files.push(...await visit(entryPath));
      } else if (entry.isFile()) {
        files.push(path.relative(rootPath, entryPath).split(path.sep).join("/"));
      }
    }
    return files;
  }

  return visit(rootPath);
}
