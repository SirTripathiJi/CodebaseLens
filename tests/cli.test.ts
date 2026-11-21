import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
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
    const version = runCli(["--version"]);

    expect(help.status).toBe(0);
    expect(help.stdout).toContain("Analyze project structure, languages, frameworks, dependencies, and health.");
    expect(help.stdout).toContain("analyze [options] [directory]");
    expect(version.status).toBe(0);
    expect(version.stdout.trim()).toBe("1.0.1");
  });

  it("analyzes a relative path containing spaces", async () => {
    const root = await createProject("sample project ");
    const relativePath = path.relative(process.cwd(), root);
    const result = runCli(["analyze", relativePath]);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(`Project: ${path.basename(root)}`);
    expect(result.stdout).toContain("Project health:");
  });

  it("reports unsupported output formats with a nonzero exit status", async () => {
    const root = await createProject();
    const result = runCli(["analyze", root, "--format", "xml"]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Allowed choices are terminal, markdown, json.");
  });

  it("reports invalid project paths without an unhandled crash", () => {
    const result = runCli(["analyze", path.join(os.tmpdir(), "codebaselens-path-does-not-exist")]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error: Cannot scan");
  });
});
