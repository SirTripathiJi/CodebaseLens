import type { ProjectAnalysis } from "../intelligence/types.js";

function wrapNames(names: string[], width = 76): string[] {
  if (names.length === 0) return ["    (none)"];

  const rows: string[] = [];
  let row = "    ";
  for (const name of names) {
    const addition = row.trim().length === 0 || row === "    " ? name : `, ${name}`;
    if (row.length + addition.length > width && row !== "    ") {
      rows.push(row);
      row = `      ${name}`;
    } else {
      row += addition;
    }
  }
  rows.push(row);
  return rows;
}

export function renderTerminalReport(project: ProjectAnalysis): string {
  const lines = [
    `Project: ${project.projectName}`,
    `Path: ${project.rootPath}`,
    `Project health: ${project.health.score}/100`,
    `${project.totalFiles} files · ${project.totalDirectories} directories`,
    "",
    "Health categories:",
  ];

  for (const category of project.health.categories) {
    lines.push(
      `  ${category.name}: ${category.score === null ? "not applicable" : `${category.score}/${category.maxScore}`}`,
    );
    for (const deduction of category.deductions) {
      lines.push(`    -${deduction.points}: ${deduction.reason}`);
    }
  }

  lines.push("", "Languages:");
  const languages = Object.entries(project.filesByLanguage).sort(([left], [right]) => left.localeCompare(right));
  if (languages.length === 0) lines.push("  (no files found)");
  else for (const [language, count] of languages) lines.push(`  ${language}: ${count}`);

  lines.push("", "Frameworks:", project.frameworks.length > 0 ? `  ${project.frameworks.join(", ")}` : "  (none detected)");
  lines.push("", "Dependencies:");
  if (project.dependencies.packageJsonStatus !== "valid") {
    lines.push(`  Unavailable: package.json ${project.dependencies.packageJsonStatus}`);
  } else {
    lines.push(`  Production (${project.dependencies.productionCount}):`);
    lines.push(...wrapNames(project.dependencies.productionNames));
    lines.push(`  Development (${project.dependencies.developmentCount}):`);
    lines.push(...wrapNames(project.dependencies.developmentNames));
  }

  lines.push(
    "",
    `Configuration: ${project.configurationFiles.length > 0 ? project.configurationFiles.join(", ") : "none detected"}`,
    `Package manager: ${project.packageManager}`,
    `Code markers: ${project.markers.total} (${Object.entries(project.markers.counts).map(([name, count]) => `${name} ${count}`).join(", ")})`,
  );
  if (project.markers.locations.length > 0) {
    lines.push("Marker locations:");
    for (const location of project.markers.locations.slice(0, 10)) {
      lines.push(`  ${location.filePath}:${location.line} (${location.marker})`);
    }
    if (project.markers.locations.length > 10) {
      lines.push(`  … and ${project.markers.locations.length - 10} more; export a report for the full list.`);
    }
  }

  lines.push("", "Important insights:");
  if (project.insights.length === 0) {
    lines.push("  No notable insights.");
  } else {
    for (const insight of project.insights) {
      lines.push(`  [${insight.severity}] ${insight.title}: ${insight.explanation}`);
      lines.push(`    Recommendation: ${insight.recommendation}`);
    }
  }

  lines.push(
    "",
    `Top-level folders: ${project.topLevelFolders.length > 0 ? project.topLevelFolders.join(", ") : "none"}`,
    "",
    "README understanding (rule-based):",
  );
  if (project.readme.status !== "read") lines.push(`  README: ${project.readme.status === "missing" ? "not found" : "unreadable"}`);
  else {
    lines.push(`  Description: ${project.readme.description ?? "not identified"}`);
    lines.push(`  Headings: ${project.readme.headings.map((heading) => heading.text).join(" · ") || "none found"}`);
    lines.push(`  Technologies mentioned: ${project.readme.technologyMentions.join(", ") || "none identified"}`);
  }
  lines.push("", "Code statistics:", `  ${project.codeStatistics.files} text/source files · ${project.codeStatistics.totalLines} total lines · ${project.codeStatistics.blankLines} blank · ${project.codeStatistics.nonEmptyLines} non-empty (not necessarily executable)`);
  for (const [extension, counts] of Object.entries(project.codeStatistics.byExtension).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`  ${extension}: ${counts.files} files, ${counts.totalLines} lines (${counts.blankLines} blank, ${counts.nonEmptyLines} non-empty)`);
  }
  lines.push("", "Test intelligence:", `  Test files: ${project.tests.fileCount}`,
    `  Frameworks: ${project.tests.frameworks.join(", ") || (project.tests.frameworkStatus === "unrecognized" ? "unrecognized setup" : "none detected")}`,
    `  Test scripts: ${project.tests.testScripts.map(({ name }) => name).join(", ") || "none detected"}`,
    "", "Folder structure:", ...project.folderTree.lines.map((line) => `  ${line}`));
  if (project.folderTree.truncated) lines.push("  … output truncated at the configured depth or entry limit.");
  lines.push("", "Empty files and directories:",
    `  Zero-byte files: ${project.emptyFilesAndDirectories.files.length ? project.emptyFilesAndDirectories.files.slice(0, 20).join(", ") : "none"}`,
    `  Empty directories: ${project.emptyFilesAndDirectories.directories.length ? project.emptyFilesAndDirectories.directories.slice(0, 20).join(", ") : "none"}`);
  if (project.emptyFilesAndDirectories.files.length > 20 || project.emptyFilesAndDirectories.directories.length > 20) lines.push("  … lists limited to 20 paths per category.");
  lines.push("", "Git information:");
  if (!project.git.available) lines.push(`  Unavailable: ${project.git.error ?? "unknown reason"}`);
  else {
    lines.push(`  Branch: ${project.git.branch ?? "detached HEAD"}`, `  Working tree: ${project.git.workingTree}`,
      `  Changes: ${project.git.modifiedFiles} modified, ${project.git.addedFiles} added, ${project.git.deletedFiles} deleted, ${project.git.untrackedFiles} untracked`);
    if (project.git.latestCommit) lines.push(`  Latest commit: ${project.git.latestCommit.hash} · ${project.git.latestCommit.date} · ${project.git.latestCommit.subject}`);
  }
  lines.push("", "Project scripts:");
  if (project.scripts.status !== "valid") lines.push(`  Unavailable: package.json ${project.scripts.status}`);
  else if (project.scripts.scripts.length === 0) lines.push("  (none configured)");
  else for (const script of project.scripts.scripts) lines.push(`  ${script.name}: ${script.command}`);
  lines.push("", "Dependency overview:",
    `  Source referenced (production): ${project.dependencyOverview.referencedProduction.join(", ") || "none detected"}`,
    `  Source referenced (development): ${project.dependencyOverview.referencedDevelopment.join(", ") || "none detected"}`,
    `  Possible unused production candidates: ${project.dependencyOverview.unusedProductionCandidates.join(", ") || "none detected"}`,
    `  Possible unused development candidates: ${project.dependencyOverview.unusedDevelopmentCandidates.join(", ") || "none detected"}`,
    "  Candidates are heuristic findings, not confirmed unused packages.");
  lines.push("", "Import analysis:",
    `  Analyzed ${project.imports.analyzedFiles} JS/TS files · ${project.imports.localImportCount} relative imports · ${project.imports.unresolvedLocalImports.length} unresolved`,
    `  Alias imports: ${project.imports.aliasImportsDetected} · literal dynamic imports: ${project.imports.dynamicImportsDetected} · computed dynamic imports: ${project.imports.computedDynamicImportsDetected}`);
  for (const item of project.imports.unresolvedLocalImports.slice(0, 20)) lines.push(`  Unresolved: ${item.importer} → ${item.specifier}`);
  if (project.imports.unresolvedLocalImports.length > 20) lines.push(`  … and ${project.imports.unresolvedLocalImports.length - 20} more unresolved imports.`);
  if (project.imports.frequentlyImported.length) {
    lines.push("  Frequently imported local modules:");
    for (const item of project.imports.frequentlyImported.slice(0, 10)) lines.push(`    ${item.path}: ${item.count}`);
  }
  lines.push("", "Configuration checks:");
  for (const check of project.configurationChecks) {
    lines.push(`  [${check.status}${check.status === "missing" ? `, ${check.severity}` : ""}] ${check.fileName}: ${check.reason}`);
    if (check.status === "missing" || check.status === "invalid") lines.push(`    Recommendation: ${check.recommendation}`);
  }
  lines.push("", "Technical debt:");
  if (project.technicalDebt.findings.length === 0) lines.push("  No supported debt findings detected.");
  else for (const group of project.technicalDebt.groups) {
    lines.push(`  ${group.category}:`);
    for (const finding of group.findings) {
      lines.push(`    [${finding.severity}] ${finding.title}: ${finding.evidence}`);
      lines.push(`      Recommendation: ${finding.recommendation}`);
    }
  }
  return lines.join("\n");
}
