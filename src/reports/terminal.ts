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
  );
  return lines.join("\n");
}
