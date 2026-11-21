import type { ScanResult } from "../scanner.js";

export type PackageJsonStatus = "valid" | "missing" | "invalid";

export interface DependencyAnalysis {
  packageJsonStatus: PackageJsonStatus;
  productionCount: number;
  developmentCount: number;
  productionNames: string[];
  developmentNames: string[];
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
  signals: ProjectSignals;
  health: ProjectHealth;
  insights: ProjectInsight[];
}
