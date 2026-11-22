import type { ScanResult } from "../scanner.js";

export type PackageJsonStatus = "valid" | "missing" | "invalid";

export interface DependencyAnalysis {
  packageJsonStatus: PackageJsonStatus;
  productionCount: number;
  developmentCount: number;
  productionNames: string[];
  developmentNames: string[];
}

export interface DependencyOverview {
  referencedProduction: string[];
  referencedDevelopment: string[];
  unusedProductionCandidates: string[];
  unusedDevelopmentCandidates: string[];
}

export interface ScriptAnalysis {
  status: PackageJsonStatus;
  scripts: { name: string; command: string }[];
}

export interface ImportAnalysis {
  analyzedFiles: number;
  localImportCount: number;
  resolvedLocalImports: { importer: string; specifier: string; resolvedPath: string }[];
  unresolvedLocalImports: { importer: string; specifier: string }[];
  frequentlyImported: { path: string; count: number }[];
  referencedPackages: string[];
  aliasImportsDetected: number;
  dynamicImportsDetected: number;
  computedDynamicImportsDetected: number;
  limitations: string[];
}

export interface ConfigurationCheck {
  fileName: string;
  status: "present" | "missing" | "invalid" | "not-relevant";
  severity: InsightSeverity;
  reason: string;
  recommendation: string;
}

export interface TechnicalDebtFinding {
  id: string;
  category: string;
  severity: InsightSeverity;
  title: string;
  evidence: string;
  recommendation: string;
}

export interface TechnicalDebtSummary {
  findings: TechnicalDebtFinding[];
  counts: Record<InsightSeverity, number>;
  groups: { category: string; findings: TechnicalDebtFinding[] }[];
}

export type MarkerKind = `TO${"DO"}` | `FIX${"ME"}` | `HA${"CK"}`;

export interface MarkerLocation {
  filePath: string;
  line: number;
  marker: MarkerKind;
}

export interface MarkerAnalysis {
  total: number;
  counts: Record<MarkerKind, number>;
  locations: MarkerLocation[];
}

export type InsightSeverity = "info" | "warning" | "critical";

export interface ProjectInsight {
  id: string;
  title: string;
  explanation: string;
  severity: InsightSeverity;
  recommendation: string;
}

export interface ProjectSignals {
  readmePresent: boolean;
  gitIgnorePresent: boolean;
  sourceFilesDetected: boolean;
  testsDetected: boolean;
  dependencySetupRelevant: boolean;
}

export interface HealthDeduction {
  points: number;
  reason: string;
}

export interface HealthCategory {
  id: string;
  name: string;
  score: number | null;
  maxScore: number;
  deductions: HealthDeduction[];
}

export interface ProjectHealth {
  score: number;
  categories: HealthCategory[];
  methodologyVersion: string;
}

export interface ProjectAnalysis extends ScanResult {
  projectName: string;
  frameworks: string[];
  dependencies: DependencyAnalysis;
  packageManager: string;
  configurationFiles: string[];
  markers: MarkerAnalysis;
  readme: ReadmeAnalysis;
  codeStatistics: CodeStatistics;
  tests: TestAnalysis;
  folderTree: FolderTree;
  emptyFilesAndDirectories: EmptyEntries;
  git: GitAnalysis;
  scripts: ScriptAnalysis;
  dependencyOverview: DependencyOverview;
  imports: ImportAnalysis;
  configurationChecks: ConfigurationCheck[];
  technicalDebt: TechnicalDebtSummary;
  signals: ProjectSignals;
  health: ProjectHealth;
  insights: ProjectInsight[];
}

export interface ReadmeAnalysis {
  status: "read" | "missing" | "unreadable";
  description: string | null;
  introductoryText: string[];
  headings: { level: number; text: string }[];
  importantSections: { purpose: string[]; setup: string[]; installation: string[] };
  technologyMentions: string[];
}

export interface CodeStatistics {
  files: number;
  totalLines: number;
  blankLines: number;
  nonEmptyLines: number;
  byExtension: Record<string, { files: number; totalLines: number; blankLines: number; nonEmptyLines: number }>;
}

export interface TestAnalysis {
  fileCount: number;
  frameworkStatus: "detected" | "unrecognized" | "not-detected";
  frameworks: string[];
  testScripts: { name: string; command: string }[];
}

export interface FolderTree {
  lines: string[];
  truncated: boolean;
  maxDepth: number;
  maxEntries: number;
}

export interface EmptyEntries {
  files: string[];
  directories: string[];
}

export interface GitAnalysis {
  available: boolean;
  error: string | null;
  branch: string | null;
  workingTree: "clean" | "dirty" | "unknown";
  modifiedFiles: number;
  addedFiles: number;
  deletedFiles: number;
  untrackedFiles: number;
  latestCommit: { hash: string; date: string; subject: string } | null;
}
