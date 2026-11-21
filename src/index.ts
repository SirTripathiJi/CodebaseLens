export { scanDirectory } from "./scanner.js";
export type { ScanResult } from "./scanner.js";
export { analyzeProject } from "./intelligence/analyze-project.js";
export type {
  DependencyAnalysis,
  MarkerAnalysis,
  MarkerKind,
  MarkerLocation,
  PackageJsonStatus,
  ProjectAnalysis,
} from "./intelligence/types.js";
