import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const temporaryDirectories: string[] = [];
const cliPath = fileURLToPath(new URL("../src/cli.ts", import.meta.url));

async function createProject(name = "codebaselens cli "): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), name));
  temporaryDirectories.push(directory);
  await writeFile(path.join(directory, "README.md"), "Example project\n");
  await writeFile(path.join(directory, ".gitignore"), "dist/\n");
  return directory;
}

function runCli(args: string[], cwd: string = process.cwd()) {
  return spawnSync(process.execPath, ["--import", "tsx/esm", cliPath, ...args], {
    cwd,
    encoding: "utf8",
  });
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("command line interface", () => {
  it("shows help and the package version", () => {
    const help = runCli(["--help"]);
    const analyzeHelp = runCli(["analyze", "--help"]);
    const version = runCli(["--version"]);

    expect(help.status).toBe(0);
    expect(help.stdout).toContain("Analyze project structure, languages, project intelligence, and health.");
    expect(help.stdout).toContain("analyze [options] [directory]");
    expect(version.status).toBe(0);
    expect(version.stdout.trim()).toBe("2.0.0");
    expect(analyzeHelp.stdout).toContain("html");
  });

  it("analyzes a relative path containing spaces", async () => {
    const root = await createProject("sample project ");
    const relativePath = path.relative(process.cwd(), root);
    const result = runCli(["analyze", relativePath]);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(`Project: ${path.basename(root)}`);
    expect(result.stdout).toContain("Project health:");
  });

  it("writes Markdown, parseable JSON, and standalone HTML reports through the analyze command", async () => {
    const root = await createProject("report project ");
    const outputDirectory = await createProject("report output ");
    const terminal = runCli(["analyze", root, "--format", "terminal"]);
    expect(terminal.status, terminal.stderr).toBe(0);
    expect(terminal.stdout).toContain("Project scripts:");
    for (const format of ["markdown", "json", "html"] as const) {
      const output = path.join(outputDirectory, `report.${format === "markdown" ? "md" : format}`);
      const result = runCli(["analyze", root, "--format", format, "--output", output]);
      expect(result.status, result.stderr).toBe(0);
      const contents = await readFile(output, "utf8");
      if (format === "json") expect(JSON.parse(contents).reportVersion).toBe(2);
      if (format === "markdown") expect(contents).toContain("## Technical debt summary");
      if (format === "html") {
        expect(contents).toContain("<!doctype html>");
        expect(contents).toContain("<style>");
        expect(contents).not.toContain("<script>");
      }
    }
  });

  it("reports unsupported output formats with a nonzero exit status", async () => {
    const root = await createProject();
    const result = runCli(["analyze", root, "--format", "xml"]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Allowed choices are terminal, markdown, json, html.");
  });

  it("reports invalid project paths without an unhandled crash", () => {
    const result = runCli(["analyze", path.join(os.tmpdir(), "codebaselens-path-does-not-exist")]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error: Cannot scan");
  });
});
