export { scanDirectory } from "./scanner.js";
export type { ScanResult } from "./scanner.js";
export { analyzeProject } from "./intelligence/analyze-project.js";
export { analyzeReadme, analyzeCodeStatistics, analyzeTests, analyzeFolderTree, detectEmptyEntries, analyzeGit } from "./intelligence/project-intelligence.js";
export { analyzeScripts, analyzeImports, analyzeConfigurationChecks, summarizeTechnicalDebt } from "./intelligence/v2-analysis.js";
export { calculateProjectHealth } from "./health/score.js";
export { generateProjectInsights } from "./health/insights.js";
export { HEALTH_METHODOLOGY } from "./health/methodology.js";
export { createProjectReportPayload, renderJsonReport, renderMarkdownReport, resolveReportOutputPath, writeProjectReport } from "./reports/report.js";
export { renderTerminalReport } from "./reports/terminal.js";
export { renderHtmlReport } from "./reports/html.js";
export type {
  DependencyAnalysis,
  HealthCategory,
  HealthDeduction,
  InsightSeverity,
  MarkerAnalysis,
  MarkerKind,
  MarkerLocation,
  PackageJsonStatus,
  ProjectAnalysis,
  ProjectHealth,
  ProjectInsight,
  ProjectSignals,
  ReadmeAnalysis,
  CodeStatistics,
  TestAnalysis,
  FolderTree,
  EmptyEntries,
  GitAnalysis,
  DependencyOverview,
  ScriptAnalysis,
  ImportAnalysis,
  ConfigurationCheck,
  TechnicalDebtFinding,
  TechnicalDebtSummary,
} from "./intelligence/types.js";
export type { ExportFormat, ProjectReportPayload, WrittenReport } from "./reports/report.js";
