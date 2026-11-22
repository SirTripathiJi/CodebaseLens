import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ProjectAnalysis } from "../intelligence/types.js";
import { HEALTH_METHODOLOGY } from "../health/methodology.js";

export type ExportFormat = "markdown" | "json";

export interface ProjectReportPayload {
  reportVersion: 1;
  scanDate: string;
  project: ProjectAnalysis;
  healthScoringMethodology: typeof HEALTH_METHODOLOGY;
}

export interface WrittenReport {
  outputPath: string;
  contents: string;
}

export function createProjectReportPayload(
  project: ProjectAnalysis,
  scanDate: Date = new Date(),
): ProjectReportPayload {
  return {
    reportVersion: 1,
    scanDate: scanDate.toISOString(),
    project,
    healthScoringMethodology: HEALTH_METHODOLOGY,
  };
}

export function renderJsonReport(payload: ProjectReportPayload): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function markdownText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("|", "\\|").replaceAll("`", "\\`");
}

function inlineCode(value: string): string {
  return `\`${value.replaceAll("`", "\\`")}\``;
}

export function renderMarkdownReport(payload: ProjectReportPayload): string {
  const { project } = payload;
  const lines = [
    `# CodebaseLens report: ${markdownText(project.projectName)}`,
    "",
    `- Scan date: ${payload.scanDate}`,
    `- Project path: ${inlineCode(project.rootPath)}`,
    "",
    `## Project health: ${project.health.score}/100`,
    "",
    "| Category | Score | Deductions |",
    "| --- | ---: | --- |",
  ];

  for (const category of project.health.categories) {
    const score = category.score === null ? "Not applicable" : `${category.score}/${category.maxScore}`;
    const deductions = category.deductions.length > 0
      ? category.deductions.map((deduction) => `${deduction.reason} (-${deduction.points})`).join("; ")
      : "None";
    lines.push(`| ${markdownText(category.name)} | ${score} | ${markdownText(deductions)} |`);
  }

  lines.push(
    "",
    "## Analysis summary",
    "",
    `- Files: ${project.totalFiles}`,
    `- Directories: ${project.totalDirectories}`,
    `- Package manager: ${markdownText(project.packageManager)}`,
    `- Dependency manifest status: ${project.dependencies.packageJsonStatus}`,
    `- Tests detected: ${project.signals.testsDetected ? "yes" : "no"}`,
    "",
    "### Languages",
    "",
  );

  const languages = Object.entries(project.filesByLanguage).sort(([left], [right]) => left.localeCompare(right));
  if (languages.length === 0) lines.push("No files were found.");
  else for (const [language, count] of languages) lines.push(`- ${markdownText(language)}: ${count}`);

  lines.push("", "### Frameworks", "");
  if (project.frameworks.length === 0) lines.push("None detected.");
  else for (const framework of project.frameworks) lines.push(`- ${markdownText(framework)}`);

  lines.push(
    "",
    "### Dependencies",
    "",
    `- Production (${project.dependencies.productionCount}): ${project.dependencies.productionNames.map(markdownText).join(", ") || "none"}`,
    `- Development (${project.dependencies.developmentCount}): ${project.dependencies.developmentNames.map(markdownText).join(", ") || "none"}`,
    "",
    "### Configuration files",
    "",
  );
  if (project.configurationFiles.length === 0) lines.push("None detected.");
  else for (const fileName of project.configurationFiles) lines.push(`- ${inlineCode(fileName)}`);

  lines.push(
    "",
    "### Code markers",
    "",
    `- Total: ${project.markers.total}`,
    ...Object.entries(project.markers.counts).map(([marker, count]) => `- ${marker}: ${count}`),
    "",
  );
  if (project.markers.locations.length === 0) {
    lines.push("No code marker locations were found.");
  } else {
    for (const location of project.markers.locations) {
      lines.push(`- ${inlineCode(`${location.filePath}:${location.line}`)} — ${location.marker}`);
    }
  }

  lines.push("", "### Top-level folders", "");
  if (project.topLevelFolders.length === 0) lines.push("None.");
  else for (const folder of project.topLevelFolders) lines.push(`- ${inlineCode(folder)}`);

  lines.push("", "## README understanding (rule-based)", "");
  lines.push(`- Status: ${project.readme.status}`);
  if (project.readme.status === "read") {
    lines.push(`- Description: ${project.readme.description ? markdownText(project.readme.description) : "Not identified."}`);
    lines.push(`- Introductory text: ${project.readme.introductoryText.map(markdownText).join(" ") || "None identified."}`);
    lines.push(`- Technologies mentioned: ${project.readme.technologyMentions.map(markdownText).join(", ") || "None identified."}`);
    lines.push("", "### README headings", "");
    if (project.readme.headings.length === 0) lines.push("None found.");
    else for (const heading of project.readme.headings) lines.push(`${"#".repeat(heading.level)} ${markdownText(heading.text)}`);
    for (const [label, sections] of Object.entries(project.readme.importantSections)) {
      lines.push("", `### ${label[0].toUpperCase()}${label.slice(1)} information`, "");
      lines.push(sections.length ? sections.map((section) => `- ${markdownText(section)}`).join("\n") : "No matching section identified.");
    }
  }

  lines.push("", "## Code statistics", "",
    `- Supported text/source files: ${project.codeStatistics.files}`,
    `- Total lines: ${project.codeStatistics.totalLines}`,
    `- Blank lines: ${project.codeStatistics.blankLines}`,
    `- Non-empty lines: ${project.codeStatistics.nonEmptyLines} (not necessarily executable code)`,
    "", "| Extension | Files | Lines | Blank | Non-empty |", "| --- | ---: | ---: | ---: | ---: |");
  const codeRows = Object.entries(project.codeStatistics.byExtension).sort(([a], [b]) => a.localeCompare(b));
  if (codeRows.length === 0) lines.push("| None | 0 | 0 | 0 | 0 |");
  else for (const [extension, counts] of codeRows) lines.push(`| ${markdownText(extension)} | ${counts.files} | ${counts.totalLines} | ${counts.blankLines} | ${counts.nonEmptyLines} |`);

  lines.push("", "## Test intelligence", "",
    `- Test files detected: ${project.tests.fileCount}`,
    `- Framework status: ${project.tests.frameworkStatus}`,
    `- Frameworks from package dependencies: ${project.tests.frameworks.map(markdownText).join(", ") || "None detected."}`,
    `- Test scripts: ${project.tests.testScripts.map(({ name, command }) => `${inlineCode(name)}: ${markdownText(command)}`).join("; ") || "None detected."}`,
    "", "## Folder structure", "", "```text", ...project.folderTree.lines, "```");
  if (project.folderTree.truncated) lines.push("", `Tree truncated at depth ${project.folderTree.maxDepth} or ${project.folderTree.maxEntries} entries.`);

  lines.push("", "## Empty files and directories", "",
    `- Zero-byte files (${project.emptyFilesAndDirectories.files.length}): ${project.emptyFilesAndDirectories.files.map(inlineCode).join(", ") || "None."}`,
    `- Empty directories (${project.emptyFilesAndDirectories.directories.length}): ${project.emptyFilesAndDirectories.directories.map(inlineCode).join(", ") || "None."}`,
    "", "## Git information", "");
  if (!project.git.available) lines.push(`Git information unavailable: ${markdownText(project.git.error ?? "unknown reason")}`);
  else {
    lines.push(`- Branch: ${project.git.branch ? inlineCode(project.git.branch) : "detached HEAD"}`,
      `- Working tree: ${project.git.workingTree}`,
      `- Changes: ${project.git.modifiedFiles} modified, ${project.git.addedFiles} added, ${project.git.deletedFiles} deleted, ${project.git.untrackedFiles} untracked`);
    if (project.git.latestCommit) lines.push(`- Latest commit: ${inlineCode(project.git.latestCommit.hash)} · ${project.git.latestCommit.date} · ${markdownText(project.git.latestCommit.subject)}`);
  }

  lines.push("", "## Insights and recommendations", "");
  if (project.insights.length === 0) {
    lines.push("No notable insights were detected.");
  } else {
    for (const insight of project.insights) {
      lines.push(
        `### ${insight.severity.toUpperCase()}: ${markdownText(insight.title)}`,
        "",
        insight.explanation,
        "",
        `**Recommended action:** ${insight.recommendation}`,
        "",
      );
    }
  }

  lines.push(
    "## Scoring methodology",
    "",
    `Methodology version ${HEALTH_METHODOLOGY.version}. The overall score is the earned points divided by the applicable category points, rounded to the nearest integer. The scale is ${HEALTH_METHODOLOGY.scale.minimum}–${HEALTH_METHODOLOGY.scale.maximum}.`,
    "",
    ...HEALTH_METHODOLOGY.categories.map((category) => `- ${category.name}: ${category.maximum} points maximum`),
    "",
    ...HEALTH_METHODOLOGY.notes.map((note) => `- ${note}`),
    "",
  );

  return `${lines.join("\n")}\n`;
}

function isWithinDirectory(parentPath: string, candidatePath: string): boolean {
  const relative = path.relative(parentPath, candidatePath);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

function safeFilePart(projectName: string): string {
  return projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
}

export function resolveReportOutputPath(
  projectPath: string,
  projectName: string,
  format: ExportFormat,
  customPath?: string,
  workingDirectory: string = process.cwd(),
): string {
  if (customPath !== undefined) {
    if (!customPath.trim()) throw new Error("The report output path cannot be empty.");
    const resolvedPath = path.resolve(workingDirectory, customPath);
    if (path.basename(resolvedPath).toLowerCase().startsWith(".env")) {
      throw new Error("Reports cannot be written to environment-file paths.");
    }
    return resolvedPath;
  }

  const rootPath = path.resolve(projectPath);
  const currentDirectory = path.resolve(workingDirectory);
  let outputDirectory = currentDirectory;
  if (isWithinDirectory(rootPath, currentDirectory)) {
    outputDirectory = path.dirname(rootPath);
    if (isWithinDirectory(rootPath, outputDirectory)) outputDirectory = os.tmpdir();
  }
  if (isWithinDirectory(rootPath, outputDirectory)) outputDirectory = os.tmpdir();

  const extension = format === "markdown" ? "md" : "json";
  return path.join(outputDirectory, `${safeFilePart(projectName)}-report.${extension}`);
}

export async function writeProjectReport(
  project: ProjectAnalysis,
  format: ExportFormat,
  customPath?: string,
  workingDirectory: string = process.cwd(),
  scanDate: Date = new Date(),
): Promise<WrittenReport> {
  const payload = createProjectReportPayload(project, scanDate);
  const contents = format === "json" ? renderJsonReport(payload) : renderMarkdownReport(payload);
  const outputPath = resolveReportOutputPath(project.rootPath, project.projectName, format, customPath, workingDirectory);

  try {
    await writeFile(outputPath, contents, "utf8");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot write report to "${outputPath}": ${detail}`, { cause: error });
  }

  return { outputPath, contents };
}
