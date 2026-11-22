import { readFile } from "node:fs/promises";
import { isBuiltin } from "node:module";
import path from "node:path";
import type {
  ConfigurationCheck, DependencyAnalysis, DependencyOverview, ImportAnalysis, ScriptAnalysis,
  ProjectInsight, TechnicalDebtFinding, TechnicalDebtSummary, TestAnalysis,
} from "./types.js";

const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"]);
const RESOLUTION_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs", ".json"];

interface ManifestData {
  status: ScriptAnalysis["status"];
  data: Record<string, unknown> | null;
}

async function readManifest(root: string): Promise<ManifestData> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { status: "invalid", data: null };
    return { status: "valid", data: parsed as Record<string, unknown> };
  } catch (error) {
    return { status: (error as NodeJS.ErrnoException).code === "ENOENT" ? "missing" : "invalid", data: null };
  }
}

export async function analyzeScripts(root: string): Promise<ScriptAnalysis> {
  const { status, data } = await readManifest(root);
  const scripts = data?.scripts;
  if (!scripts || typeof scripts !== "object" || Array.isArray(scripts)) return { status, scripts: [] };
  return {
    status,
    scripts: Object.entries(scripts).filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([name, command]) => ({ name, command })),
  };
}

function moduleSpecifiers(contents: string): { specifier: string; dynamic: boolean }[] {
  const results: { specifier: string; dynamic: boolean }[] = [];
  const staticPattern = /\b(?:import|export)\s+(?:type\s+)?(?:[^'";()]*?\s+from\s*)?["']([^"']+)["']/gs;
  for (const match of contents.matchAll(staticPattern)) results.push({ specifier: match[1], dynamic: false });
  const requirePattern = /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;
  for (const match of contents.matchAll(requirePattern)) results.push({ specifier: match[1], dynamic: false });
  const dynamicPattern = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
  for (const match of contents.matchAll(dynamicPattern)) results.push({ specifier: match[1], dynamic: true });
  return results;
}

function packageName(specifier: string): string | null {
  if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("#") || isBuiltin(specifier)) return null;
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? (parts.length > 1 ? `${parts[0]}/${parts[1]}` : specifier) : parts[0];
}

function isAlias(specifier: string): boolean {
  return specifier.startsWith("@/") || specifier.startsWith("~/") || specifier.startsWith("src/") || specifier.startsWith("#/");
}

function matchesConfiguredAlias(specifier: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const [prefix, suffix = ""] = pattern.split("*");
    return specifier.startsWith(prefix) && specifier.endsWith(suffix);
  });
}

function resolveLocal(importer: string, specifier: string, knownFiles: Set<string>): string | null {
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier));
  const candidates = [base];
  const extension = path.posix.extname(base);
  if (extension) {
    if ([".js", ".jsx", ".mjs", ".cjs"].includes(extension)) {
      const stem = base.slice(0, -extension.length);
      candidates.push(`${stem}.ts`, `${stem}.tsx`, `${stem}.mts`, `${stem}.cts`);
    }
  } else {
    candidates.push(...RESOLUTION_EXTENSIONS.map((ext) => `${base}${ext}`));
    candidates.push(...RESOLUTION_EXTENSIONS.map((ext) => `${base}/index${ext}`));
  }
  return candidates.find((candidate) => knownFiles.has(candidate)) ?? null;
}

export async function analyzeImports(
  root: string,
  projectFiles: string[],
  dependencies: DependencyAnalysis,
  scripts: ScriptAnalysis,
): Promise<{ imports: ImportAnalysis; dependencyOverview: DependencyOverview }> {
  const sourceFiles = projectFiles.filter((file) => SOURCE_EXTENSIONS.has(path.posix.extname(file).toLowerCase()));
  const knownFiles = new Set(projectFiles);
  const pathAliasPatterns: string[] = [];
  for (const configPath of projectFiles.filter((file) => /(?:^|\/)(?:tsconfig(?:\.[^/]+)?|jsconfig)\.json$/i.test(file))) {
    try {
      const configText = await readFile(path.join(root, ...configPath.split("/")), "utf8");
      for (const match of configText.matchAll(/["']paths["']\s*:\s*\{([\s\S]*?)\}/g)) {
        for (const alias of match[1].matchAll(/["']([^"']+)["']\s*:/g)) pathAliasPatterns.push(alias[1]);
      }
    } catch { /* Configuration file access is optional for the source scan. */ }
  }
  const resolvedLocalImports: ImportAnalysis["resolvedLocalImports"] = [];
  const unresolvedLocalImports: ImportAnalysis["unresolvedLocalImports"] = [];
  const importedCounts = new Map<string, number>();
  const referencedPackages = new Set<string>();
  let aliasImportsDetected = 0;
  let dynamicImportsDetected = 0;
  let computedDynamicImportsDetected = 0;
  let unreadableSources = 0;

  for (const importer of sourceFiles) {
    let contents: string;
    try { contents = await readFile(path.join(root, ...importer.split("/")), "utf8"); }
    catch { unreadableSources++; continue; }
    const specifiers = moduleSpecifiers(contents);
    const literalDynamicCount = specifiers.filter(({ dynamic }) => dynamic).length;
    dynamicImportsDetected += literalDynamicCount;
    const dynamicCallCount = [...contents.matchAll(/\bimport\s*\(/g)].length;
    computedDynamicImportsDetected += Math.max(0, dynamicCallCount - literalDynamicCount);
    for (const { specifier } of specifiers) {
      if (specifier.startsWith(".")) {
        const resolvedPath = resolveLocal(importer, specifier, knownFiles);
        if (resolvedPath) {
          resolvedLocalImports.push({ importer, specifier, resolvedPath });
          importedCounts.set(resolvedPath, (importedCounts.get(resolvedPath) ?? 0) + 1);
        } else unresolvedLocalImports.push({ importer, specifier });
      } else if (isAlias(specifier) || matchesConfiguredAlias(specifier, pathAliasPatterns)) aliasImportsDetected++;
      else {
        const name = packageName(specifier);
        if (name) referencedPackages.add(name);
      }
    }
  }

  const frequent = [...importedCounts.entries()].sort(([leftPath, leftCount], [rightPath, rightCount]) =>
    rightCount - leftCount || leftPath.localeCompare(rightPath));
  const declaredProd = dependencies.productionNames;
  const declaredDev = dependencies.developmentNames;
  const scriptText = scripts.scripts.map((script) => script.command).join(" ");
  const inScript = (name: string) => new RegExp(`(^|[^\\w@/-])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\w@/-])`).test(scriptText);
  const referencedProduction = declaredProd.filter((name) => referencedPackages.has(name));
  const referencedDevelopment = declaredDev.filter((name) => referencedPackages.has(name));
  const candidatesAllowed = aliasImportsDetected === 0 && unreadableSources === 0 && computedDynamicImportsDetected === 0;
  const dependencyOverview: DependencyOverview = {
    referencedProduction,
    referencedDevelopment,
    unusedProductionCandidates: candidatesAllowed ? declaredProd.filter((name) => !referencedPackages.has(name) && !inScript(name)) : [],
    unusedDevelopmentCandidates: candidatesAllowed ? declaredDev.filter((name) => !referencedPackages.has(name) && !inScript(name)) : [],
  };
  const limitations = [
    "Static import matching does not resolve tsconfig/jsconfig path aliases; alias imports are counted and suppress unused-dependency candidates.",
    "Computed dynamic imports and runtime-generated module paths cannot be resolved statically.",
    "The source scan recognizes import/export declarations, literal require() calls, and literal dynamic imports; it does not evaluate project code.",
  ];
  if (unreadableSources > 0) limitations.push(`${unreadableSources} source file(s) could not be read; unused-dependency candidates are suppressed.`);
  if (computedDynamicImportsDetected > 0) limitations.push(`${computedDynamicImportsDetected} computed dynamic import(s) were detected; unused-dependency candidates are suppressed.`);
  const imports: ImportAnalysis = {
    analyzedFiles: sourceFiles.length - unreadableSources,
    localImportCount: resolvedLocalImports.length + unresolvedLocalImports.length,
    resolvedLocalImports,
    unresolvedLocalImports,
    frequentlyImported: frequent.slice(0, 20).map(([importPath, count]) => ({ path: importPath, count })),
    referencedPackages: [...referencedPackages].sort((a, b) => a.localeCompare(b)),
    aliasImportsDetected,
    dynamicImportsDetected,
    computedDynamicImportsDetected,
    limitations,
  };
  return { imports, dependencyOverview };
}

function hasAny(rootFiles: Set<string>, patterns: RegExp[]): boolean {
  return [...rootFiles].some((name) => patterns.some((pattern) => pattern.test(name)));
}

export function analyzeConfigurationChecks(
  rootFiles: Set<string>,
  languages: Record<string, number>,
  frameworks: string[],
  dependencies: DependencyAnalysis,
  scripts: ScriptAnalysis,
): ConfigurationCheck[] {
  const javascript = ["JavaScript", "JavaScript (JSX)", "TypeScript", "TypeScript (TSX)"]
    .some((language) => (languages[language] ?? 0) > 0);
  const typescript = (languages.TypeScript ?? 0) + (languages["TypeScript (TSX)"] ?? 0) > 0;
  const names = new Set([...dependencies.productionNames, ...dependencies.developmentNames]);
  const scriptCommands = scripts.scripts.map(({ command }) => command).join(" ");
  const lintSetup = names.has("eslint") || /\beslint\b/.test(scriptCommands);
  const formatSetup = names.has("prettier") || /\bprettier\b/.test(scriptCommands);
  const result: ConfigurationCheck[] = [];
  const add = (fileName: string, present: boolean, relevant: boolean, severity: ConfigurationCheck["severity"], reason: string, recommendation: string) => {
    result.push({ fileName, status: !relevant ? "not-relevant" : present ? "present" : "missing", severity, reason, recommendation });
  };
  add(".gitignore", rootFiles.has(".gitignore"), true, "warning", "Ignore rules keep generated files, dependencies, and local data out of version control.", "Add a project-appropriate .gitignore.");
  add("package.json", dependencies.packageJsonStatus === "valid", javascript, "warning", "A package manifest records dependencies and common project scripts for JavaScript or TypeScript projects.", "Add or repair package.json if this project uses Node tooling.");
  if (javascript && dependencies.packageJsonStatus === "invalid") {
    const packageCheck = result.find((item) => item.fileName === "package.json");
    if (packageCheck) {
      packageCheck.status = "invalid";
      packageCheck.reason = "The root package manifest exists but could not be parsed as valid JSON.";
    }
  } else if (!javascript) {
    const packageCheck = result.find((item) => item.fileName === "package.json");
    if (packageCheck) packageCheck.reason = "No JavaScript or TypeScript source was detected, so a root Node package manifest is not required by this check.";
  }
  add("tsconfig.json", rootFiles.has("tsconfig.json") || hasAny(rootFiles, [/^tsconfig\..+\.json$/]), typescript, "warning", "TypeScript source is present and compiler settings are not detected.", "Add a tsconfig.json if TypeScript is compiled or type checked.");
  if (!typescript) {
    const check = result.find((item) => item.fileName === "tsconfig.json");
    if (check) check.reason = "No TypeScript source was detected; a TypeScript compiler configuration is not needed for the detected languages.";
  }
  add(".editorconfig", rootFiles.has(".editorconfig"), true, "info", "EditorConfig can keep basic whitespace and newline behavior consistent across editors.", "Consider adding a small .editorconfig for shared editor defaults.");
  add("ESLint configuration", hasAny(rootFiles, [/^\.eslintrc(?:\..+)?$/i, /^eslint\.config\./i]), lintSetup, "info", "ESLint tooling is declared, but no recognized root configuration was found.", "Add a configuration if the project expects ESLint rules to run.");
  if (!lintSetup) {
    const check = result.find((item) => item.fileName === "ESLint configuration");
    if (check) check.reason = "No ESLint dependency or script was detected; this configuration is optional here.";
  }
  add("Prettier configuration", hasAny(rootFiles, [/^\.prettierrc(?:\..+)?$/i, /^prettier\.config\./i]), formatSetup, "info", "Prettier tooling is declared, but no recognized root configuration was found.", "Add a configuration if the project relies on customized formatting rules.");
  if (!formatSetup) {
    const check = result.find((item) => item.fileName === "Prettier configuration");
    if (check) check.reason = "No Prettier dependency or script was detected; this configuration is optional here.";
  }
  const knownFrameworks = new Set(frameworks);
  if (knownFrameworks.has("Vite") || names.has("vite")) add("vite.config.*", hasAny(rootFiles, [/^vite\.config\./i]), true, "info", "Vite is declared and an explicit config may hold project-specific build settings.", "Add vite.config.* only if default Vite settings do not meet project needs.");
  return result;
}

export function summarizeTechnicalDebt(input: {
  markers: { total: number; counts: Record<string, number> };
  tests: TestAnalysis;
  sourceFilesDetected: boolean;
  emptyFiles: string[];
  emptyDirectories: string[];
  imports: ImportAnalysis;
  configurations: ConfigurationCheck[];
  dependencyOverview: DependencyOverview;
  packageStatus: ScriptAnalysis["status"];
  insights: ProjectInsight[];
}): TechnicalDebtSummary {
  const findings: TechnicalDebtFinding[] = [];
  if (input.markers.total > 0) findings.push({
    id: "code-markers", category: "Code maintenance", severity: input.markers.total > 10 ? "warning" : "info",
    title: "Code markers need review", evidence: `${input.markers.total} TODO, FIXME, and HACK markers (${Object.entries(input.markers.counts).map(([name, count]) => `${name}: ${count}`).join(", ")}).`,
    recommendation: "Review marker locations and prioritize items that affect correctness or maintenance.",
  });
  if (input.sourceFilesDetected && input.tests.fileCount === 0) findings.push({
    id: "missing-tests", category: "Testing", severity: "warning", title: "No recognized test files detected",
    evidence: "Source files were found, but no files matched the supported common test conventions.",
    recommendation: "Add automated tests or use a recognized test filename or directory convention.",
  });
  if (input.emptyFiles.length > 0) findings.push({
    id: "empty-files", category: "Project hygiene", severity: "info", title: "Zero-byte files found",
    evidence: `${input.emptyFiles.length} empty file(s): ${input.emptyFiles.slice(0, 10).join(", ")}${input.emptyFiles.length > 10 ? ", …" : ""}.`,
    recommendation: "Confirm the files are intentional placeholders; remove or populate them when appropriate.",
  });
  if (input.emptyDirectories.length > 0) findings.push({
    id: "empty-directories", category: "Project hygiene", severity: "info", title: "Empty directories found",
    evidence: `${input.emptyDirectories.length} empty director(y/ies): ${input.emptyDirectories.slice(0, 10).join(", ")}${input.emptyDirectories.length > 10 ? ", …" : ""}.`,
    recommendation: "Confirm these directories are intentional; add content or remove them during normal project maintenance.",
  });
  if (input.imports.unresolvedLocalImports.length > 0) findings.push({
    id: "unresolved-local-imports", category: "Imports", severity: "warning", title: "Relative imports could not be resolved",
    evidence: `${input.imports.unresolvedLocalImports.length} unresolved import(s): ${input.imports.unresolvedLocalImports.slice(0, 5).map((item) => `${item.importer} → ${item.specifier}`).join(", ")}.`,
    recommendation: "Check the path and filename casing; alias and computed imports are outside this check's resolution model.",
  });
  const missingConfigs = input.configurations.filter((item) => item.status === "missing" && item.severity !== "info");
  if (missingConfigs.length > 0) findings.push({
    id: "missing-configuration", category: "Configuration", severity: "warning", title: "Relevant configuration is missing",
    evidence: missingConfigs.map((item) => item.fileName).join(", "),
    recommendation: [...new Set(missingConfigs.map((item) => item.recommendation))].join(" "),
  });
  if (input.packageStatus === "invalid") findings.push({
    id: "invalid-package-manifest", category: "Configuration", severity: "critical", title: "package.json is malformed",
    evidence: "The root manifest could not be parsed as a JSON object.", recommendation: "Correct the manifest JSON before relying on its scripts and dependency metadata.",
  });
  const additionalDebtSignals: Record<string, Omit<TechnicalDebtFinding, "id">> = {
    "missing-readme": { category: "Documentation", severity: "warning", title: "README is missing", evidence: "No README file was found at the project root.", recommendation: "Add a README with the project purpose, setup steps, and common commands." },
    "lockfile-not-detected": { category: "Dependency setup", severity: "warning", title: "Package manager lockfile was not identified", evidence: "Dependencies are declared, but no single supported package-manager lockfile was detected.", recommendation: "Commit a lockfile for the package manager used by this project." },
    "empty-project": { category: "Project structure", severity: "critical", title: "No project files found", evidence: "No regular files were found outside ignored directories.", recommendation: "Confirm the project path or add the files needed for analysis." },
  };
  for (const insight of input.insights) {
    const finding = additionalDebtSignals[insight.id];
    if (finding) findings.push({ id: insight.id, ...finding });
  }
  const candidates = [...input.dependencyOverview.unusedProductionCandidates, ...input.dependencyOverview.unusedDevelopmentCandidates];
  if (candidates.length > 0) findings.push({
    id: "possible-unused-dependencies", category: "Dependencies", severity: "info", title: "Possible unused dependencies",
    evidence: `Static source checks did not find imports for ${candidates.join(", ")}. These are candidates, not confirmed unused packages.`,
    recommendation: "Review package usage in scripts, configuration, generated code, and runtime loading before changing dependencies.",
  });
  const counts = { critical: 0, warning: 0, info: 0 };
  for (const finding of findings) counts[finding.severity]++;
  const severityOrder = { critical: 0, warning: 1, info: 2 } as const;
  const groups = [...new Set(findings.map((finding) => finding.category))].sort((a, b) => a.localeCompare(b))
    .map((category) => ({
      category,
      findings: findings.filter((finding) => finding.category === category)
        .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.title.localeCompare(b.title)),
    }));
  return { findings, counts, groups };
}
