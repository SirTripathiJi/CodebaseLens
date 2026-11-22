import path from "node:path";
import { scanDirectory } from "../scanner.js";
import { detectConfigurationFiles } from "./configuration.js";
import { readPackageManifest } from "./dependencies.js";
import { detectFrameworks } from "./frameworks.js";
import { analyzeMarkers } from "./markers.js";
import { detectPackageManager } from "./package-manager.js";
import { listProjectFiles, listRootFiles } from "./project-files.js";
import { calculateProjectHealth } from "../health/score.js";
import { generateProjectInsights } from "../health/insights.js";
import { detectProjectSignals } from "../health/project-signals.js";
import { analyzeCodeStatistics, analyzeFolderTree, analyzeGit, analyzeReadme, analyzeTests, detectEmptyEntries } from "./project-intelligence.js";
import { analyzeConfigurationChecks, analyzeImports, analyzeScripts, summarizeTechnicalDebt } from "./v2-analysis.js";
import type { ProjectAnalysis } from "./types.js";

export async function analyzeProject(directoryPath: string): Promise<ProjectAnalysis> {
  const scan = await scanDirectory(directoryPath);
  const rootFiles = await listRootFiles(scan.rootPath);
  const projectFiles = await listProjectFiles(scan.rootPath);
  const { analysis: dependencies, manifest } = await readPackageManifest(scan.rootPath, rootFiles);
  const projectName = manifest?.name ?? path.basename(scan.rootPath);
  const [frameworks, markers, readme, codeStatistics, tests, folderTree, emptyFilesAndDirectories, scripts] = await Promise.all([
    detectFrameworks(scan.rootPath, rootFiles, manifest),
    analyzeMarkers(scan.rootPath, projectFiles),
    analyzeReadme(scan.rootPath, rootFiles),
    analyzeCodeStatistics(scan.rootPath, projectFiles.map((file) => path.join(scan.rootPath, ...file.split("/")))),
    analyzeTests(scan.rootPath, projectFiles.map((file) => path.join(scan.rootPath, ...file.split("/")))),
    analyzeFolderTree(scan.rootPath),
    detectEmptyEntries(scan.rootPath, projectFiles.map((file) => path.join(scan.rootPath, ...file.split("/")))),
    analyzeScripts(scan.rootPath),
  ]);
  const { imports, dependencyOverview } = await analyzeImports(scan.rootPath, projectFiles, dependencies, scripts);
  const configurationChecks = analyzeConfigurationChecks(rootFiles, scan.filesByLanguage, frameworks, dependencies, scripts);

  const baseAnalysis = {
    ...scan,
    projectName,
    frameworks,
    dependencies,
    packageManager: detectPackageManager(rootFiles),
    configurationFiles: detectConfigurationFiles(rootFiles),
    markers,
    readme,
    codeStatistics,
    tests,
    folderTree,
    emptyFilesAndDirectories,
    git: analyzeGit(scan.rootPath),
    scripts,
    dependencyOverview,
    imports,
    configurationChecks,
  };
  const signals = detectProjectSignals(baseAnalysis, rootFiles, projectFiles);
  const health = calculateProjectHealth(baseAnalysis, signals);
  const insights = generateProjectInsights(baseAnalysis, signals);
  const technicalDebt = summarizeTechnicalDebt({
    markers,
    tests,
    sourceFilesDetected: signals.sourceFilesDetected,
    emptyFiles: emptyFilesAndDirectories.files,
    emptyDirectories: emptyFilesAndDirectories.directories,
    imports,
    configurations: configurationChecks,
    dependencyOverview,
    packageStatus: scripts.status,
    insights,
  });

  return {
    ...baseAnalysis,
    signals,
    health,
    insights,
    technicalDebt,
  };
}
