import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { scanDirectory } from "../src/scanner.js";

const temporaryDirectories: string[] = [];

async function createProject(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codebaselens-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("scanDirectory", () => {
  it("counts files and directories and lists immediate project folders", async () => {
    const root = await createProject();
    await mkdir(path.join(root, "src", "nested"), { recursive: true });
    await mkdir(path.join(root, "docs"));
    await writeFile(path.join(root, "README.md"), "# project");
    await writeFile(path.join(root, "src", "index.ts"), "export {};");
    await writeFile(path.join(root, "src", "nested", "helper.ts"), "export {};");

    const result = await scanDirectory(root);

    expect(result.totalFiles).toBe(3);
    expect(result.totalDirectories).toBe(3);
    expect(result.topLevelFolders).toEqual(["docs", "src"]);
  });

  it("groups recognized extensions into language counts", async () => {
    const root = await createProject();
    await writeFile(path.join(root, "app.ts"), "");
    await writeFile(path.join(root, "view.TSX"), "");
    await writeFile(path.join(root, "main.py"), "");
    await writeFile(path.join(root, "notes.unknown"), "");

    const result = await scanDirectory(root);

    expect(result.filesByLanguage).toEqual({
      "TypeScript": 1,
      "TypeScript (TSX)": 1,
      Python: 1,
      Other: 1,
    });
  });

  it("skips every configured generated or dependency directory", async () => {
    const root = await createProject();
    const ignoredNames = ["node_modules", ".git", "dist", "build", "coverage", ".next", ".nuxt", ".cache", "vendor"];
    for (const name of ignoredNames) {
      const ignoredPath = path.join(root, name);
      await mkdir(ignoredPath);
      await writeFile(path.join(ignoredPath, "ignored.ts"), "");
    }
    await writeFile(path.join(root, "kept.ts"), "");

    const result = await scanDirectory(root);

    expect(result.totalFiles).toBe(1);
    expect(result.totalDirectories).toBe(0);
    expect(result.topLevelFolders).toEqual([]);
  });

  it("does not follow symlinks outside the requested project", async () => {
    const root = await createProject();
    const outside = await createProject();
    await writeFile(path.join(outside, "outside.ts"), "");
    await symlink(outside, path.join(root, "external"), "dir");

    const result = await scanDirectory(root);

    expect(result.totalFiles).toBe(0);
    expect(result.totalDirectories).toBe(0);
  });

  it("reports missing paths and files as invalid directories", async () => {
    const root = await createProject();
    const file = path.join(root, "file.txt");
    await writeFile(file, "");

    await expect(scanDirectory(path.join(root, "missing"))).rejects.toThrow(/Cannot scan/);
    await expect(scanDirectory(file)).rejects.toThrow(/not a directory/i);
  });

  it("returns zero counts for an empty directory", async () => {
    const root = await createProject();

    await expect(scanDirectory(root)).resolves.toMatchObject({
      totalFiles: 0,
      totalDirectories: 0,
      filesByLanguage: {},
      topLevelFolders: [],
    });
  });
});
