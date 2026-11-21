import type { ProjectAnalysis, ProjectSignals } from "../intelligence/types.js";

const JAVASCRIPT_LANGUAGES = ["JavaScript", "JavaScript (JSX)", "TypeScript", "TypeScript (TSX)"];
const NON_SOURCE_LANGUAGES = new Set(["JSON", "Markdown", "XML", "YAML", "Other"]);
const SOURCE_FILE_EXTENSION = /\.(?:[cm]?[jt]sx?|py|php|java|cs|go|rb|rs|c|cc|cpp|h|hpp|css|html|sh|swift|kt|scala|vue)$/i;

function isTestFile(filePath: string): boolean {
  const segments = filePath.split("/");
  const fileName = segments.at(-1) ?? "";
  const inTestDirectory = segments.slice(0, -1).some((segment) => /^(test|tests|__tests__)$/i.test(segment));
  if (!SOURCE_FILE_EXTENSION.test(fileName)) return false;
  const commonTestName = /(?:\.test|\.spec)\.(?:[cm]?[jt]sx?|py|php|java|cs)$/i.test(fileName);
  const pythonTestName = /^test_.+\.py$/i.test(fileName) || /_test\.py$/i.test(fileName);
  const goTestName = /_test\.go$/i.test(fileName);
  const classTestName = /(?:Test|Tests)\.(?:java|cs)$/i.test(fileName);

  return inTestDirectory || commonTestName || pythonTestName || goTestName || classTestName;
}

export function detectProjectSignals(
  analysis: Pick<ProjectAnalysis, "filesByLanguage" | "dependencies">,
  rootFiles: Set<string>,
  files: string[],
): ProjectSignals {
  const hasJavaScriptOrTypeScript = JAVASCRIPT_LANGUAGES.some(
    (language) => (analysis.filesByLanguage[language] ?? 0) > 0,
  );
  const sourceFilesDetected = Object.entries(analysis.filesByLanguage).some(
    ([language, count]) => count > 0 && !NON_SOURCE_LANGUAGES.has(language),
  );

  return {
    readmePresent: [...rootFiles].some((fileName) => /^readme(?:\..+)?$/i.test(fileName)),
    gitIgnorePresent: rootFiles.has(".gitignore"),
    sourceFilesDetected,
    testsDetected: files.some(isTestFile),
    dependencySetupRelevant: hasJavaScriptOrTypeScript || analysis.dependencies.packageJsonStatus !== "missing",
  };
}
