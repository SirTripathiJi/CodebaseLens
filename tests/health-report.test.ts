import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { analyzeProject } from "../src/intelligence/analyze-project.js";
import { renderJsonReport, renderMarkdownReport, resolveReportOutputPath, writeProjectReport } from "../src/reports/report.js";
import { createProjectReportPayload } from "../src/reports/report.js";

const temporaryDirectories: string[] = [];

async function createProject(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codebaselens-health-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("project health and reports", () => {
  it("keeps health scores within bounds and calculates them deterministically", async () => {
    const root = await createProject();
    await writeFile(path.join(root, "README.md"), "Project guide");
    await writeFile(path.join(root, ".gitignore"), "dist/");
    await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "healthy-app", dependencies: { express: "^5" } }));
    await writeFile(path.join(root, "package-lock.json"), "{}");
    await mkdir(path.join(root, "src"));
    await writeFile(path.join(root, "src", "example.test.js"), "test('works', () => {});");

    const first = await analyzeProject(root);
    const second = await analyzeProject(root);

    expect(first.health).toEqual(second.health);
    expect(first.health.score).toBe(100);
    expect(first.health.score).toBeGreaterThanOrEqual(0);
    expect(first.health.score).toBeLessThanOrEqual(100);

    const emptyProject = await analyzeProject(await createProject());
    expect(emptyProject.health.score).toBeGreaterThanOrEqual(0);
    expect(emptyProject.health.score).toBeLessThanOrEqual(100);
  });

  it("reports category scores and exact evidence-based deductions", async () => {
    const root = await createProject();
    await writeFile(path.join(root, "app.ts"), "export const app = true;");
    await writeFile(path.join(root, "package.json"), JSON.stringify({ dependencies: { express: "^5" } }));

    const result = await analyzeProject(root);
    const categories = Object.fromEntries(result.health.categories.map((category) => [category.id, category]));

    expect(result.health.score).toBe(54);
    expect(categories.configuration).toMatchObject({ score: 12, maxScore: 20 });
    expect(categories.configuration.deductions[0].points).toBe(8);
    expect(categories.documentation).toMatchObject({ score: 0, maxScore: 15 });
    expect(categories.dependencies).toMatchObject({ score: 10, maxScore: 15 });
    expect(categories["version-control"]).toMatchObject({ score: 5, maxScore: 15 });
    expect(categories["code-quality"]).toMatchObject({ score: 12, maxScore: 20 });
    expect(categories.structure).toMatchObject({ score: 15, maxScore: 15 });
  });

  it("creates separate README and ignore-file insights and marks missing tests as informational", async () => {
    const root = await createProject();
    await writeFile(path.join(root, "index.js"), "console.log('hello');");

    const result = await analyzeProject(root);
    const insights = Object.fromEntries(result.insights.map((insight) => [insight.id, insight]));

    expect(insights["missing-readme"]).toMatchObject({ severity: "warning", recommendation: expect.any(String) });
    expect(insights["missing-gitignore"]).toMatchObject({ severity: "warning", recommendation: expect.any(String) });
    expect(insights["tests-not-detected"]).toMatchObject({ severity: "info", recommendation: expect.any(String) });
  });

  it("does not treat fixture data as a test or penalize a documentation-only project for missing tests", async () => {
    const root = await createProject();
    await writeFile(path.join(root, "README.md"), "Documentation only");
    await mkdir(path.join(root, "tests"));
    await writeFile(path.join(root, "tests", "fixture.json"), "{}");

    const result = await analyzeProject(root);

    expect(result.signals.sourceFilesDetected).toBe(false);
    expect(result.signals.testsDetected).toBe(false);
    expect(result.insights.some((insight) => insight.id === "tests-not-detected")).toBe(false);
    expect(result.health.categories.find((category) => category.id === "code-quality")?.deductions).toEqual([]);
  });

  it("marks malformed package metadata as a critical insight", async () => {
    const root = await createProject();
    await writeFile(path.join(root, "package.json"), "{ invalid");

    const result = await analyzeProject(root);

    expect(result.insights.find((insight) => insight.id === "invalid-package-json")?.severity).toBe("critical");
  });

  it("reports large marker counts as a warning and deducts according to the documented tier", async () => {
    const root = await createProject();
    const marker = ["TO", "DO"].join("");
    await writeFile(path.join(root, "work.js"), Array.from({ length: 11 }, () => `// ${marker}`).join("\n"));

    const result = await analyzeProject(root);

    expect(result.markers.total).toBe(11);
    expect(result.health.categories.find((category) => category.id === "code-quality")?.deductions)
      .toContainEqual({ points: 4, reason: "The project contains 11 code markers, above the 10-marker threshold." });
    expect(result.insights.find((insight) => insight.id === "many-code-markers")?.severity).toBe("warning");
  });

  it("renders a Markdown report with scan date, score, insights, and scoring method", async () => {
    const root = await createProject();
    await writeFile(path.join(root, "README.md"), "Guide");
    await writeFile(path.join(root, "entry.js"), "console.log('ok');");
    const project = await analyzeProject(root);
    const report = renderMarkdownReport(createProjectReportPayload(project, new Date("2026-11-21T12:00:00.000Z")));

    expect(report).toContain("# CodebaseLens report:");
    expect(report).toContain("2026-11-21T12:00:00.000Z");
    expect(report).toContain(`## Project health: ${project.health.score}/100`);
    expect(report).toContain("## Insights and recommendations");
    expect(report).toContain("## Scoring methodology");
  });

  it("renders valid structured JSON containing analysis, health, and insights", async () => {
    const root = await createProject();
    await writeFile(path.join(root, "README.md"), "Guide");
    const project = await analyzeProject(root);
    const reportText = renderJsonReport(createProjectReportPayload(project, new Date("2026-11-21T00:00:00.000Z")));
    const parsed = JSON.parse(reportText);

    expect(parsed.reportVersion).toBe(1);
    expect(parsed.scanDate).toBe("2026-11-21T00:00:00.000Z");
    expect(parsed.project.health.score).toBe(project.health.score);
    expect(parsed.project.insights).toEqual(project.insights);
    expect(parsed.healthScoringMethodology.categories).toHaveLength(6);
  });

  it("writes to a custom output path and rejects invalid output directories", async () => {
    const root = await createProject();
    const project = await analyzeProject(root);
    const reportDirectory = path.join(root, "reports");
    await mkdir(reportDirectory);
    const outputPath = path.join(reportDirectory, "custom.json");

    const written = await writeProjectReport(project, "json", outputPath);

    expect(written.outputPath).toBe(outputPath);
    expect(JSON.parse(await readFile(outputPath, "utf8")).project.projectName).toBe(project.projectName);
    await expect(writeProjectReport(project, "markdown", path.join(root, "missing", "report.md")))
      .rejects.toThrow(/Cannot write report/);
    expect(() => resolveReportOutputPath(root, project.projectName, "json", ".env", root))
      .toThrow(/environment-file paths/);
  });

  it("writes default reports outside the analyzed project", async () => {
    const root = await createProject();
    const workingDirectory = await createProject();
    const project = await analyzeProject(root);

    const written = await writeProjectReport(project, "markdown", undefined, workingDirectory);

    expect(path.dirname(written.outputPath)).toBe(workingDirectory);
    expect(path.relative(root, written.outputPath).startsWith(`..${path.sep}`)).toBe(true);
    expect(await readFile(written.outputPath, "utf8")).toContain("## Scoring methodology");
  });

  it("chooses a default report path outside the analyzed project", async () => {
    const root = await createProject();
    const project = await analyzeProject(root);
    const outputPath = resolveReportOutputPath(root, project.projectName, "markdown", undefined, root);
    const relativePath = path.relative(root, outputPath);

    expect(relativePath === ".." || relativePath.startsWith(`..${path.sep}`)).toBe(true);
    expect(path.basename(outputPath)).toMatch(/-report\.md$/);
  });
});
