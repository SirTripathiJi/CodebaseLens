import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { analyzeProject } from "../src/intelligence/analyze-project.js";
import { analyzeCodeStatistics, analyzeFolderTree, analyzeGit, analyzeReadme, analyzeTests, detectEmptyEntries } from "../src/intelligence/project-intelligence.js";
import { createProjectReportPayload, renderJsonReport, renderMarkdownReport } from "../src/reports/report.js";
import { renderTerminalReport } from "../src/reports/terminal.js";

const temporaryDirectories: string[] = [];
async function project(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "codebaselens-v2-"));
  temporaryDirectories.push(dir);
  return dir;
}
function git(dir: string, ...args: string[]): void {
  const result = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
}
afterEach(async () => Promise.all(temporaryDirectories.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))));

describe("Part 1 project intelligence", () => {
  it("extracts README introduction, headings, important sections and technologies with missing distinction", async () => {
    const root = await project();
    await writeFile(path.join(root, "README.md"), "# Sample App\nA React and TypeScript application.\n\n## Installation\nRun npm install.\n\n## Setup\nStart the development server.\n");
    const result = await analyzeReadme(root, new Set(["README.md"]));
    expect(result).toMatchObject({ status: "read", description: "A React and TypeScript application.", technologyMentions: expect.arrayContaining(["React", "TypeScript", "npm"]) });
    expect(result.headings.map((heading) => heading.text)).toEqual(["Sample App", "Installation", "Setup"]);
    expect(result.importantSections.installation).toContain("Run npm install.");
    expect((await analyzeReadme(root, new Set())).status).toBe("missing");
  });

  it("counts supported text lines by extension and safely skips binary files", async () => {
    const root = await project();
    const source = path.join(root, "app.ts");
    const binary = path.join(root, "data.json");
    await writeFile(source, "one\n  \nthree\n");
    await writeFile(binary, Buffer.from([0, 1, 2]));
    const stats = await analyzeCodeStatistics(root, [source, binary]);
    expect(stats).toMatchObject({ files: 1, totalLines: 3, blankLines: 1, nonEmptyLines: 2, byExtension: { ".ts": { files: 1, totalLines: 3, blankLines: 1, nonEmptyLines: 2 } } });
  });

  it("detects tests, dependency frameworks, scripts, and unrecognized test setups", async () => {
    const root = await project();
    await mkdir(path.join(root, "tests"));
    const testFile = path.join(root, "tests", "sample.test.ts");
    await writeFile(testFile, "test");
    await writeFile(path.join(root, "package.json"), JSON.stringify({ devDependencies: { vitest: "^4" }, scripts: { test: "vitest run", "test:unit": "vitest" } }));
    expect(await analyzeTests(root, [testFile])).toMatchObject({ fileCount: 1, frameworkStatus: "detected", frameworks: ["Vitest"], testScripts: [{ name: "test", command: "vitest run" }, { name: "test:unit", command: "vitest" }] });
    await writeFile(path.join(root, "package.json"), "{");
    expect((await analyzeTests(root, [testFile])).frameworkStatus).toBe("unrecognized");
  });

  it("bounds the tree, skips ignored and linked directories, and finds only real empty entries", async () => {
    const root = await project();
    await mkdir(path.join(root, "src", "nested"), { recursive: true });
    await mkdir(path.join(root, "empty"));
    await mkdir(path.join(root, "node_modules"));
    await writeFile(path.join(root, "zero.ts"), "");
    await writeFile(path.join(root, "node_modules", "ignored.ts"), "");
    const outside = await project();
    await writeFile(path.join(outside, "linked.ts"), "");
    await symlink(outside, path.join(root, "linked"), "dir");
    const tree = await analyzeFolderTree(root, 3, 2);
    expect(tree.truncated).toBe(true);
    expect(tree.lines.join("\n")).not.toContain("node_modules");
    expect(tree.lines.join("\n")).not.toContain("linked.ts");
    expect(await detectEmptyEntries(root, [path.join(root, "zero.ts")])).toEqual({ files: ["zero.ts"], directories: ["empty", "src/nested"] });
  });

  it("reports read-only Git state and gracefully handles a non-repository", async () => {
    const root = await project();
    expect(analyzeGit(root)).toMatchObject({ available: false, workingTree: "unknown" });
    git(root, "init", "-q");
    git(root, "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "--allow-empty", "-m", "initial");
    await writeFile(path.join(root, "new.txt"), "new");
    expect(analyzeGit(root)).toMatchObject({ available: true, workingTree: "dirty", untrackedFiles: 1, latestCommit: { subject: "initial" } });
  });

  it("integrates all six features into analyze and every report format without changing health methodology", async () => {
    const root = await project();
    await writeFile(path.join(root, "README.md"), "# Demo\nA TypeScript tool.\n");
    await writeFile(path.join(root, "app.ts"), "export {};\n");
    await writeFile(path.join(root, "empty.txt"), "");
    const analysis = await analyzeProject(root);
    expect(analysis.readme.status).toBe("read");
    expect(analysis.codeStatistics.nonEmptyLines).toBe(3); // README's two content lines plus app.ts.
    expect(analysis.emptyFilesAndDirectories.files).toContain("empty.txt");
    expect(analysis.folderTree.lines.length).toBeGreaterThan(1);
    const terminal = renderTerminalReport(analysis);
    const payload = createProjectReportPayload(analysis, new Date("2026-11-22T00:00:00.000Z"));
    const markdown = renderMarkdownReport(payload);
    const json = JSON.parse(renderJsonReport(payload));
    for (const section of ["README understanding", "Code statistics", "Test intelligence", "Folder structure", "Empty files", "Git information"]) {
      expect(terminal).toContain(section);
    }
    expect(markdown).toContain("## Test intelligence");
    expect(json.project.git).toEqual(analysis.git);
    expect(analysis.health.methodologyVersion).toBe("1.0");
  });
});
