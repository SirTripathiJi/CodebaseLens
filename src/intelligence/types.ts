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

export interface ProjectAnalysis extends ScanResult {
  projectName: string;
  frameworks: string[];
  dependencies: DependencyAnalysis;
  packageManager: string;
  configurationFiles: string[];
  markers: MarkerAnalysis;
}
