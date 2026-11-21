import path from "node:path";
import { scanDirectory } from "../scanner.js";
import { detectConfigurationFiles } from "./configuration.js";
import { readPackageManifest } from "./dependencies.js";
import { detectFrameworks } from "./frameworks.js";
import { analyzeMarkers } from "./markers.js";
import { detectPackageManager } from "./package-manager.js";
import { listRootFiles } from "./project-files.js";
import type { ProjectAnalysis } from "./types.js";

export async function analyzeProject(directoryPath: string): Promise<ProjectAnalysis> {
  const scan = await scanDirectory(directoryPath);
  const rootFiles = await listRootFiles(scan.rootPath);
  const { analysis: dependencies, manifest } = await readPackageManifest(scan.rootPath, rootFiles);
  const projectName = manifest?.name ?? path.basename(scan.rootPath);
  const [frameworks, markers] = await Promise.all([
    detectFrameworks(scan.rootPath, rootFiles, manifest),
    analyzeMarkers(scan.rootPath),
  ]);

  return {
    ...scan,
    projectName,
    frameworks,
    dependencies,
    packageManager: detectPackageManager(rootFiles),
    configurationFiles: detectConfigurationFiles(rootFiles),
    markers,
  };
}
