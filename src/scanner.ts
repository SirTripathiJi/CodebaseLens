import { lstat, readdir, realpath } from "node:fs/promises";
import path from "node:path";

export const IGNORED_DIRECTORY_NAMES = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".cache",
  "vendor",
] as const;

const IGNORED_DIRECTORIES = new Set<string>(IGNORED_DIRECTORY_NAMES);

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ".c": "C",
  ".cc": "C++",
  ".cpp": "C++",
  ".cs": "C#",
  ".css": "CSS",
  ".go": "Go",
  ".h": "C/C++ Header",
  ".hpp": "C++",
  ".html": "HTML",
  ".java": "Java",
  ".js": "JavaScript",
  ".jsx": "JavaScript (JSX)",
  ".json": "JSON",
  ".kt": "Kotlin",
  ".md": "Markdown",
  ".php": "PHP",
  ".py": "Python",
  ".rb": "Ruby",
  ".rs": "Rust",
  ".scala": "Scala",
  ".sh": "Shell",
  ".sql": "SQL",
  ".swift": "Swift",
  ".ts": "TypeScript",
  ".tsx": "TypeScript (TSX)",
  ".vue": "Vue",
  ".xml": "XML",
  ".yaml": "YAML",
  ".yml": "YAML",
};

export interface ScanResult {
  rootPath: string;
  totalFiles: number;
  totalDirectories: number;
  filesByLanguage: Record<string, number>;
  topLevelFolders: string[];
}

/** Scan a project tree without following symlinks or entering ignored folders. */
export async function scanDirectory(directoryPath: string): Promise<ScanResult> {
  const requestedPath = path.resolve(directoryPath);
  let rootPath: string;

  try {
    const rootInfo = await lstat(requestedPath);
    if (!rootInfo.isDirectory() && !rootInfo.isSymbolicLink()) {
      throw new Error("Path is not a directory");
    }
    rootPath = await realpath(requestedPath);
    const resolvedInfo = await lstat(rootPath);
    if (!resolvedInfo.isDirectory()) {
      throw new Error("Path is not a directory");
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot scan "${directoryPath}": ${detail}`, { cause: error });
  }

  const result: ScanResult = {
    rootPath,
    totalFiles: 0,
    totalDirectories: 0,
    filesByLanguage: {},
    topLevelFolders: [],
  };

  async function visit(currentPath: string, isRoot = false): Promise<void> {
    let entries;
    try {
      entries = await readdir(currentPath, { withFileTypes: true });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Cannot read directory "${currentPath}": ${detail}`, { cause: error });
    }

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const entryPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) continue;
        result.totalDirectories += 1;
        if (isRoot) result.topLevelFolders.push(entry.name);
        await visit(entryPath);
      } else if (entry.isFile()) {
        result.totalFiles += 1;
        const extension = path.extname(entry.name).toLowerCase();
        const language = LANGUAGE_BY_EXTENSION[extension] ?? "Other";
        result.filesByLanguage[language] = (result.filesByLanguage[language] ?? 0) + 1;
      }
    }
  }

  await visit(rootPath, true);
  result.topLevelFolders.sort((left, right) => left.localeCompare(right));
  return result;
}
