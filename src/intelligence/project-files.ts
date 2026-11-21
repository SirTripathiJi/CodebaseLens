import { readdir } from "node:fs/promises";

/** Return regular files directly inside the project root without following links. */
export async function listRootFiles(rootPath: string): Promise<Set<string>> {
  const entries = await readdir(rootPath, { withFileTypes: true });
  return new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
}
