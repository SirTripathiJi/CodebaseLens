import type { HealthCategory, HealthDeduction, ProjectAnalysis, ProjectHealth, ProjectSignals } from "../intelligence/types.js";
import { HEALTH_CATEGORY_WEIGHTS, HEALTH_METHODOLOGY } from "./methodology.js";

type AnalysisSignals = Pick<
  ProjectAnalysis,
  "filesByLanguage" | "totalFiles" | "dependencies" | "packageManager" | "configurationFiles" | "markers"
>;

function makeCategory(
  id: string,
  name: string,
  maxScore: number,
  deductions: HealthDeduction[] = [],
  applicable = true,
): HealthCategory {
  if (!applicable) return { id, name, score: null, maxScore, deductions: [] };
  const deductedPoints = deductions.reduce((sum, deduction) => sum + deduction.points, 0);
  return { id, name, score: Math.max(0, maxScore - deductedPoints), maxScore, deductions };
}

export function calculateProjectHealth(
  analysis: AnalysisSignals,
  signals: ProjectSignals,
): ProjectHealth {
  const weights = HEALTH_CATEGORY_WEIGHTS;
  const typescriptFiles = (analysis.filesByLanguage.TypeScript ?? 0) +
    (analysis.filesByLanguage["TypeScript (TSX)"] ?? 0);
  const declaredDependencies = analysis.dependencies.productionCount + analysis.dependencies.developmentCount;

  const categories = [
    makeCategory(
      "configuration",
      "Project configuration",
      weights.configuration,
      typescriptFiles > 0 && !analysis.configurationFiles.includes("tsconfig.json")
        ? [{ points: 8, reason: "TypeScript files were found, but tsconfig.json is missing." }]
        : [],
    ),
    makeCategory(
      "documentation",
      "Documentation",
      weights.documentation,
      signals.readmePresent ? [] : [{ points: 15, reason: "No README file was found in the project root." }],
    ),
    makeCategory(
      "dependencies",
      "Dependency setup",
      weights.dependencies,
      analysis.dependencies.packageJsonStatus === "invalid"
        ? [{ points: 15, reason: "package.json exists but is not valid JSON." }]
        : analysis.dependencies.packageJsonStatus === "missing"
          ? [{ points: 12, reason: "JavaScript or TypeScript files were found without a package.json." }]
          : declaredDependencies > 0 && analysis.packageManager === "unknown"
            ? [{ points: 5, reason: "Dependencies are declared, but no single package manager is identified by lockfiles." }]
            : [],
      signals.dependencySetupRelevant,
    ),
    makeCategory(
      "version-control",
      "Version control hygiene",
      weights.versionControl,
      signals.gitIgnorePresent ? [] : [{ points: 10, reason: ".gitignore is missing from the project root." }],
    ),
    makeCategory(
      "code-quality",
      "Code quality indicators",
      weights.codeQuality,
      [
        ...(signals.sourceFilesDetected && !signals.testsDetected
          ? [{ points: 8, reason: "No tests were detected using common test directory or filename patterns." }]
          : []),
        ...(analysis.markers.total > 30
          ? [{ points: 8, reason: `The project contains ${analysis.markers.total} code markers, above the 30-marker threshold.` }]
          : analysis.markers.total > 10
            ? [{ points: 4, reason: `The project contains ${analysis.markers.total} code markers, above the 10-marker threshold.` }]
            : []),
      ],
    ),
    makeCategory(
      "structure",
      "Project structure",
      weights.structure,
      analysis.totalFiles === 0 ? [{ points: 15, reason: "No files were found outside ignored directories." }] : [],
    ),
  ];

  const applicableCategories = categories.filter((category) => category.score !== null);
  const possiblePoints = applicableCategories.reduce((sum, category) => sum + category.maxScore, 0);
  const earnedPoints = applicableCategories.reduce((sum, category) => sum + (category.score ?? 0), 0);
  const score = possiblePoints === 0 ? 0 : Math.min(100, Math.max(0, Math.round((earnedPoints / possiblePoints) * 100)));

  return { score, categories, methodologyVersion: HEALTH_METHODOLOGY.version };
}
