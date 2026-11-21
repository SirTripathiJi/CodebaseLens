import type { ProjectAnalysis, ProjectInsight, ProjectSignals } from "../intelligence/types.js";

type AnalysisSignals = Pick<
  ProjectAnalysis,
  "totalFiles" | "filesByLanguage" | "dependencies" | "packageManager" | "configurationFiles" | "markers"
>;

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 } as const;

export function generateProjectInsights(
  analysis: AnalysisSignals,
  signals: ProjectSignals,
): ProjectInsight[] {
  const insights: ProjectInsight[] = [];
  const typescriptFiles = (analysis.filesByLanguage.TypeScript ?? 0) +
    (analysis.filesByLanguage["TypeScript (TSX)"] ?? 0);
  const declaredDependencies = analysis.dependencies.productionCount + analysis.dependencies.developmentCount;

  if (analysis.totalFiles === 0) {
    insights.push({
      id: "empty-project",
      title: "No project files found",
      explanation: "The scan found no regular files outside ignored folders.",
      severity: "critical",
      recommendation: "Confirm the directory path or add the project files before evaluating project health.",
    });
  }

  if (!signals.readmePresent) {
    insights.push({
      id: "missing-readme",
      title: "README is missing",
      explanation: "No README file was found at the project root.",
      severity: "warning",
      recommendation: "Add a README with the project purpose, setup steps, and common commands.",
    });
  }

  if (!signals.gitIgnorePresent) {
    insights.push({
      id: "missing-gitignore",
      title: ".gitignore is missing",
      explanation: "No .gitignore file was found at the project root.",
      severity: "warning",
      recommendation: "Add ignore rules for generated output, local dependencies, and private local files.",
    });
  }

  if (analysis.dependencies.packageJsonStatus === "invalid") {
    insights.push({
      id: "invalid-package-json",
      title: "package.json could not be parsed",
      explanation: "The file exists, but it is not valid JSON, so dependency and package metadata could not be read.",
      severity: "critical",
      recommendation: "Correct the JSON syntax and rerun the analysis.",
    });
  } else if (analysis.dependencies.packageJsonStatus === "missing" && signals.dependencySetupRelevant) {
    insights.push({
      id: "missing-package-json",
      title: "package.json is missing",
      explanation: "JavaScript or TypeScript source files were found without a Node package manifest.",
      severity: "warning",
      recommendation: "Add package.json if this project uses Node tooling or declares npm dependencies.",
    });
  }

  if (typescriptFiles > 0 && !analysis.configurationFiles.includes("tsconfig.json")) {
    insights.push({
      id: "missing-tsconfig",
      title: "TypeScript configuration is missing",
      explanation: "TypeScript files were found, but no root tsconfig.json was detected.",
      severity: "warning",
      recommendation: "Add tsconfig.json if this project uses the TypeScript compiler for builds or type checks.",
    });
  }

  if (signals.sourceFilesDetected && !signals.testsDetected) {
    insights.push({
      id: "tests-not-detected",
      title: "No tests detected",
      explanation: "No files matched common test directory or filename patterns; other test layouts may not be recognized.",
      severity: "info",
      recommendation: "Add automated tests or verify that the test filenames use a recognized convention.",
    });
  }

  if (analysis.markers.total > 10) {
    insights.push({
      id: "many-code-markers",
      title: "Code marker backlog detected",
      explanation: `${analysis.markers.total} code markers were found, above the 10-marker review threshold.`,
      severity: "warning",
      recommendation: "Review the listed locations and prioritize items that block correctness or maintenance.",
    });
  }

  if (
    analysis.dependencies.packageJsonStatus === "valid" &&
    declaredDependencies > 0 &&
    analysis.packageManager === "unknown"
  ) {
    insights.push({
      id: "lockfile-not-detected",
      title: "Package manager lockfile was not identified",
      explanation: "Dependencies are declared, but no single npm, pnpm, Yarn, or Bun lockfile was found at the project root.",
      severity: "warning",
      recommendation: "Commit the lockfile for the package manager used by this project.",
    });
  }

  return insights.sort(
    (left, right) => SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity] || left.id.localeCompare(right.id),
  );
}
