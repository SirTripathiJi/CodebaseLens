import { lstat, readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { IGNORED_DIRECTORY_NAMES } from "../scanner.js";
import type { CodeStatistics, EmptyEntries, FolderTree, GitAnalysis, ReadmeAnalysis, TestAnalysis } from "./types.js";

const ignoredDirectories = new Set<string>(IGNORED_DIRECTORY_NAMES);
const textExtensions = new Set([
  ".c", ".cc", ".cpp", ".cs", ".css", ".go", ".h", ".hpp", ".html", ".java", ".js", ".jsx",
  ".json", ".kt", ".md", ".php", ".py", ".rb", ".rs", ".scala", ".sh", ".sql", ".swift", ".ts",
  ".tsx", ".vue", ".xml", ".yaml", ".yml",
]);
const technologyNames = [
  "TypeScript", "JavaScript", "Python", "Java", "Go", "Rust", "C++", "C#", "Ruby", "PHP", "Swift",
  "React", "Next.js", "Vue", "Nuxt", "Angular", "Svelte", "Express", "NestJS", "Django", "Flask", "FastAPI",
  "Node.js", "npm", "pnpm", "Yarn", "Bun", "Vite", "Vitest", "Jest", "Playwright", "Cypress", "Docker",
];
const testFrameworkPackages: Record<string, string> = {
  vitest: "Vitest", jest: "Jest", "@jest/globals": "Jest", mocha: "Mocha", jasmine: "Jasmine",
  "@playwright/test": "Playwright", playwright: "Playwright", cypress: "Cypress", ava: "AVA", tap: "Tap",
  pytest: "pytest",
};

function relative(root: string, absolute: string): string {
  return path.relative(root, absolute).split(path.sep).join("/");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function analyzeReadme(root: string, rootFiles: Set<string>): Promise<ReadmeAnalysis> {
  const name = [...rootFiles].find((file) => /^readme(?:\..+)?$/i.test(file));
  const empty: ReadmeAnalysis = {
    status: name ? "unreadable" : "missing", description: null, introductoryText: [], headings: [],
    importantSections: { purpose: [], setup: [], installation: [] }, technologyMentions: [],
  };
  if (!name) return empty;
  let text: string;
  try { text = await readFile(path.join(root, name), "utf8"); } catch { return empty; }
  const headingMatches = [...text.matchAll(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/gm)];
  const headings = headingMatches
    .map((match) => ({ level: match[1].length, text: match[2].trim() }));
  const firstHeading = headingMatches[0];
  const introParts = firstHeading
    ? [text.slice(0, firstHeading.index ?? 0), text.slice((firstHeading.index ?? 0) + firstHeading[0].length, headingMatches[1]?.index ?? text.length)]
    : [text];
  const intro = introParts.join("\n").split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    .filter((line) => !/^[-*+]\s+\[/.test(line) && !/^\|/.test(line));
  const sections: Record<"purpose" | "setup" | "installation", string[]> = { purpose: [], setup: [], installation: [] };
  const sectionLines: string[][] = [];
  for (let i = 0; i < headingMatches.length; i++) {
    const headingMatch = headingMatches[i];
    const start = headingMatch?.index ?? 0;
    const end = headingMatches[i + 1]?.index ?? text.length;
    sectionLines.push(text.slice(start, end).split(/\r?\n/).slice(1).map((line) => line.trim()).filter(Boolean).slice(0, 12));
  }
  headings.forEach((heading, index) => {
    const normalized = heading.text.toLowerCase();
    if (/purpose|overview|about|description|introduction/.test(normalized)) sections.purpose.push(...sectionLines[index]);
    if (/setup|getting started|development/.test(normalized)) sections.setup.push(...sectionLines[index]);
    if (/install|installation/.test(normalized)) sections.installation.push(...sectionLines[index]);
  });
  const technologyMentions = technologyNames.filter((technology) =>
    new RegExp(`(^|[^\\w])${escapeRegExp(technology)}([^\\w]|$)`, "i").test(text));
  return {
    status: "read", description: intro[0] ?? null, introductoryText: intro.slice(0, 8), headings,
    importantSections: sections, technologyMentions,
  };
}

export async function analyzeCodeStatistics(root: string, files: string[]): Promise<CodeStatistics> {
  const result: CodeStatistics = { files: 0, totalLines: 0, blankLines: 0, nonEmptyLines: 0, byExtension: {} };
  for (const file of files) {
    const ext = path.extname(file).toLowerCase() || "(no extension)";
    if (!textExtensions.has(ext)) continue;
    let text: string;
    try {
      const buffer = await readFile(file);
      if (buffer.includes(0)) continue;
      text = buffer.toString("utf8");
    } catch { continue; }
    const lines = text.length === 0 ? [] : text.split(/\r\n|\n|\r/);
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    const blanks = lines.filter((line) => line.trim().length === 0).length;
    const row = result.byExtension[ext] ??= { files: 0, totalLines: 0, blankLines: 0, nonEmptyLines: 0 };
    result.files++;
    row.files++;
    result.totalLines += lines.length;
    result.blankLines += blanks;
    result.nonEmptyLines += lines.length - blanks;
    row.totalLines += lines.length;
    row.blankLines += blanks;
    row.nonEmptyLines += lines.length - blanks;
  }
  return result;
}

function isTestFile(file: string): boolean {
  const segments = file.split("/");
  const name = segments.at(-1) ?? "";
  const source = /\.(?:[cm]?[jt]sx?|py|php|java|cs|go|rb|rs)$/i.test(name);
  return source && (
    segments.slice(0, -1).some((part) => /^(?:test|tests|__tests__|spec|specs)$/i.test(part)) ||
    /(?:\.test|\.spec)\.(?:[cm]?[jt]sx?|py|php|java|cs)$/i.test(name) ||
    /^test_.+\.py$/i.test(name) || /_test\.(?:py|go)$/i.test(name) || /(?:Test|Tests)\.(?:java|cs)$/i.test(name)
  );
}

export async function analyzeTests(root: string, files: string[]): Promise<TestAnalysis> {
  const filePaths = files.map((file) => relative(root, file));
  const testFiles = filePaths.filter(isTestFile);
  const frameworks = new Set<string>();
  const scripts: { name: string; command: string }[] = [];
  try {
    const parsed: unknown = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      const manifest = parsed as Record<string, unknown>;
      for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
        const deps = manifest[field];
        if (typeof deps === "object" && deps !== null && !Array.isArray(deps)) {
          for (const name of Object.keys(deps)) if (testFrameworkPackages[name]) frameworks.add(testFrameworkPackages[name]);
        }
      }
      const packageScripts = manifest.scripts;
      if (typeof packageScripts === "object" && packageScripts !== null && !Array.isArray(packageScripts)) {
        for (const [name, command] of Object.entries(packageScripts)) {
          if (/(^|[-:]|\b)test(\b|[-:]|$)/i.test(name) && typeof command === "string") scripts.push({ name, command });
        }
      }
    }
  } catch { /* A missing or malformed manifest does not prevent test-file detection. */ }
  const detected = [...frameworks].sort((a, b) => a.localeCompare(b));
  return { fileCount: testFiles.length, frameworks: detected, testScripts: scripts,
    frameworkStatus: detected.length > 0 ? "detected" : testFiles.length > 0 || scripts.length > 0 ? "unrecognized" : "not-detected" };
}

export async function analyzeFolderTree(root: string, maxDepth = 4, maxEntries = 200): Promise<FolderTree> {
  const lines = [path.basename(root) || root];
  let emitted = 0;
  let truncated = false;
  async function visit(dir: string, prefix: string, depth: number): Promise<void> {
    if (depth >= maxDepth) {
      try {
        const visible = (await readdir(dir, { withFileTypes: true })).some((entry) =>
          !entry.isSymbolicLink() && !(entry.isDirectory() && ignoredDirectories.has(entry.name)));
        if (visible) { lines.push(`${prefix}└── … (depth limit)`); truncated = true; }
      } catch { /* unreadable directories are omitted */ }
      return;
    }
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    const visible = entries.filter((entry) => !entry.isSymbolicLink() && !(entry.isDirectory() && ignoredDirectories.has(entry.name)))
      .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
    for (let i = 0; i < visible.length; i++) {
      if (emitted >= maxEntries) {
        lines.push(`${prefix}└── … (entry limit reached)`);
        truncated = true;
        return;
      }
      const entry = visible[i];
      emitted++;
      const last = i === visible.length - 1;
      lines.push(`${prefix}${last ? "└── " : "├── "}${entry.name}${entry.isDirectory() ? "/" : ""}`);
      if (entry.isDirectory()) await visit(path.join(dir, entry.name), `${prefix}${last ? "    " : "│   "}`, depth + 1);
    }
  }
  await visit(root, "", 0);
  return { lines, truncated, maxDepth, maxEntries };
}

export async function detectEmptyEntries(root: string, files: string[]): Promise<EmptyEntries> {
  const emptyFiles: string[] = [];
  for (const file of files) {
    try { if ((await lstat(file)).size === 0) emptyFiles.push(relative(root, file)); } catch { /* vanished or unreadable */ }
  }
  const emptyDirectories: string[] = [];
  async function visit(dir: string): Promise<void> {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    if (entries.length === 0 && dir !== root) emptyDirectories.push(relative(root, dir));
    for (const entry of entries) {
      if (!entry.isSymbolicLink() && entry.isDirectory() && !ignoredDirectories.has(entry.name)) await visit(path.join(dir, entry.name));
    }
  }
  await visit(root);
  return { files: emptyFiles.sort(), directories: emptyDirectories.sort() };
}

export function analyzeGit(root: string): GitAnalysis {
  const unavailable = (error: string): GitAnalysis => ({ available: false, error, branch: null, workingTree: "unknown",
    modifiedFiles: 0, addedFiles: 0, deletedFiles: 0, untrackedFiles: 0, latestCommit: null });
  const run = (args: string[]) => spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  const repo = run(["rev-parse", "--is-inside-work-tree"]);
  if (repo.error) return unavailable(repo.error.message.includes("ENOENT") ? "Git is not installed or unavailable." : repo.error.message);
  if (repo.status !== 0 || repo.stdout.trim() !== "true") return unavailable("This directory is not inside a Git working tree.");
  const branch = run(["branch", "--show-current"]);
  const status = run(["status", "--porcelain"]);
  const commit = run(["show", "-s", "--format=%h%x1f%cI%x1f%s", "HEAD"]);
  if (status.status !== 0 || commit.status !== 0) return unavailable((status.stderr || commit.stderr || "Git information is unavailable.").trim());
  let modifiedFiles = 0, addedFiles = 0, deletedFiles = 0, untrackedFiles = 0;
  for (const line of status.stdout.split(/\r?\n/).filter(Boolean)) {
    const code = line.slice(0, 2);
    if (code === "??") { untrackedFiles++; continue; }
    if (code.includes("A") || code.includes("R") || code.includes("C")) addedFiles++;
    else if (code.includes("D")) deletedFiles++;
    else if (code.includes("M") || code.includes("U")) modifiedFiles++;
  }
  const [hash, date, ...subject] = commit.stdout.trim().split("\x1f");
  return { available: true, error: null, branch: branch.status === 0 ? branch.stdout.trim() || null : null,
    workingTree: status.stdout.trim() ? "dirty" : "clean", modifiedFiles, addedFiles, deletedFiles, untrackedFiles,
    latestCommit: hash ? { hash, date, subject: subject.join("\x1f") } : null };
}
