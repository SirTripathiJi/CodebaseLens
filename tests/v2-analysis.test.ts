import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { analyzeProject } from "../src/intelligence/analyze-project.js";
import { analyzeImports, analyzeScripts } from "../src/intelligence/v2-analysis.js";
import { renderHtmlReport } from "../src/reports/html.js";
import { createProjectReportPayload, renderJsonReport, renderMarkdownReport, writeProjectReport } from "../src/reports/report.js";
import { renderTerminalReport } from "../src/reports/terminal.js";

const temporaryDirectories: string[] = [];
async function createProject(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codebaselens-v2-report-"));
  temporaryDirectories.push(directory);
  return directory;
}
afterEach(async () => Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

describe("remaining V2 analysis", () => {
  it("lists package scripts without executing them and handles missing or malformed manifests", async () => {
    const root = await createProject();
    await writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { dev: "vite", start: "node app.js", build: "tsc", test: "vitest run", lint: "eslint .", format: "prettier --write ." } }));
    const scripts = await analyzeScripts(root);
    expect(scripts.status).toBe("valid");
    expect(scripts.scripts).toEqual([
      { name: "dev", command: "vite" }, { name: "start", command: "node app.js" }, { name: "build", command: "tsc" },
      { name: "test", command: "vitest run" }, { name: "lint", command: "eslint ." }, { name: "format", command: "prettier --write ." },
    ]);
    await writeFile(path.join(root, "package.json"), "{");
    expect(await analyzeScripts(root)).toEqual({ status: "invalid", scripts: [] });
    await rm(path.join(root, "package.json"));
    expect(await analyzeScripts(root)).toEqual({ status: "missing", scripts: [] });
  });

  it("resolves common local imports, catches missing relatives, counts aliases, and conservatively flags candidates", async () => {
    const root = await createProject();
    await mkdir(path.join(root, "src"));
    await mkdir(path.join(root, "src", "ui"));
    const files = ["src/main.ts", "src/App.tsx", "src/shared.ts", "src/ui/index.ts", "tsconfig.json"];
    await writeFile(path.join(root, files[0]), `import App from "./App.js";\nimport { value } from "./shared";\nimport UI from "./ui";\nimport React from "react";\nimport missing from "./not-here";\nimport alias from "@/utils";\nimport Button from "@ui/button";\nconst lazy = import("./shared");\nconst runtime = import(modulePath);\n`);
    await writeFile(path.join(root, files[1]), `import React from "react";\n`);
    await writeFile(path.join(root, files[2]), "export const value = 1;\n");
    await writeFile(path.join(root, files[3]), "export default {};\n");
    await writeFile(path.join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@ui/*": ["src/ui/*"] } } }));
    await writeFile(path.join(root, "package.json"), JSON.stringify({
      dependencies: { react: "^19", lodash: "^4" },
      devDependencies: { vite: "^7", vitest: "^4" },
      scripts: { build: "vite build", test: "vitest run" },
    }));
    const dependencies = { packageJsonStatus: "valid" as const, productionCount: 2, developmentCount: 2,
      productionNames: ["lodash", "react"], developmentNames: ["vite", "vitest"] };
    const scripts = await analyzeScripts(root);
    const { imports, dependencyOverview } = await analyzeImports(root, files, dependencies, scripts);
    expect(imports.resolvedLocalImports.map((item) => item.resolvedPath)).toContain("src/App.tsx");
    expect(imports.resolvedLocalImports.map((item) => item.resolvedPath)).toContain("src/shared.ts");
    expect(imports.resolvedLocalImports.map((item) => item.resolvedPath)).toContain("src/ui/index.ts");
    expect(imports.unresolvedLocalImports).toContainEqual({ importer: "src/main.ts", specifier: "./not-here" });
    expect(imports.frequentlyImported).toContainEqual({ path: "src/shared.ts", count: 2 });
    expect(imports.aliasImportsDetected).toBe(2);
    expect(imports.dynamicImportsDetected).toBe(1);
    expect(imports.computedDynamicImportsDetected).toBe(1);
    expect(imports.referencedPackages).toContain("react");
    expect(dependencyOverview.referencedProduction).toEqual(["react"]);
    expect(dependencyOverview.unusedProductionCandidates).toEqual([]); // alias resolution uncertainty suppresses candidates.
    expect(imports.limitations.join(" ")).toMatch(/aliases/);
    expect(imports.limitations.join(" ")).toMatch(/dynamic imports/);
  });

  it("checks only relevant configurations and summarizes findings without changing health scoring", async () => {
    const root = await createProject();
    await mkdir(path.join(root, "src"));
    await writeFile(path.join(root, "src", "main.ts"), "// TODO: revisit\nexport {};\n");
    await writeFile(path.join(root, "src", "unused.ts"), "");
    await writeFile(path.join(root, "package.json"), JSON.stringify({ dependencies: { react: "^19", unused: "^1" }, devDependencies: { vitest: "^4" } }));
    const analysis = await analyzeProject(root);
    const checks = Object.fromEntries(analysis.configurationChecks.map((check) => [check.fileName, check]));
    expect(checks["tsconfig.json"].status).toBe("missing");
    expect(checks["package.json"].status).toBe("present");
    expect(checks["ESLint configuration"].status).toBe("not-relevant");
    expect(analysis.technicalDebt.findings.map((finding) => finding.id)).toContain("code-markers");
    expect(analysis.technicalDebt.findings.map((finding) => finding.id)).toContain("empty-files");
    expect(analysis.health.methodologyVersion).toBe("1.0");
    expect(analysis.health.categories).toHaveLength(6);
  });

  it("marks plausible unused packages only when static source and scripts do not reference them", async () => {
    const root = await createProject();
    const source = path.join(root, "main.js");
    await writeFile(source, `import used from "used-package";\n`);
    await writeFile(path.join(root, "package.json"), JSON.stringify({
      dependencies: { "used-package": "^1", "unused-candidate": "^1" },
      devDependencies: { vite: "^7" },
      scripts: { build: "vite build" },
    }));
    const dependencies = { packageJsonStatus: "valid" as const, productionCount: 2, developmentCount: 1,
      productionNames: ["used-package", "unused-candidate"], developmentNames: ["vite"] };
    const scripts = await analyzeScripts(root);
    const result = await analyzeImports(root, ["main.js"], dependencies, scripts);
    expect(result.dependencyOverview.referencedProduction).toEqual(["used-package"]);
    expect(result.dependencyOverview.unusedProductionCandidates).toEqual(["unused-candidate"]);
    expect(result.dependencyOverview.unusedDevelopmentCandidates).toEqual([]); // The build script uses Vite.
  });

  it("analyzes a representative React application and non-Git directories", async () => {
    const root = await createProject();
    await mkdir(path.join(root, "src"));
    await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "react-shop", dependencies: { react: "^19", "react-dom": "^19" }, scripts: { dev: "vite" } }));
    await writeFile(path.join(root, "src", "App.tsx"), `import React from "react";\nexport default function App() { return <main>Shop</main>; }\n`);
    await writeFile(path.join(root, "src", "main.tsx"), `import App from "./App";\nimport { createRoot } from "react-dom/client";\nimport Missing from "./missing";\n`);
    const analysis = await analyzeProject(root);
    expect(analysis.projectName).toBe("react-shop");
    expect(analysis.frameworks).toContain("React");
    expect(analysis.scripts.scripts).toEqual([{ name: "dev", command: "vite" }]);
    expect(analysis.imports.resolvedLocalImports).toContainEqual({ importer: "src/main.tsx", specifier: "./App", resolvedPath: "src/App.tsx" });
    expect(analysis.imports.unresolvedLocalImports).toContainEqual({ importer: "src/main.tsx", specifier: "./missing" });
    expect(analysis.git.available).toBe(false);
    const payload = createProjectReportPayload(analysis);
    expect(renderTerminalReport(analysis)).toContain("./missing");
    expect(renderMarkdownReport(payload)).toContain("./missing");
    expect(JSON.parse(renderJsonReport(payload)).project.imports.unresolvedLocalImports).toContainEqual({ importer: "src/main.tsx", specifier: "./missing" });
    expect(renderHtmlReport(payload)).toContain("./missing");
  });

  it("renders standalone escaped HTML and refuses to overwrite an analyzed project file", async () => {
    const root = await createProject();
    await writeFile(path.join(root, "package.json"), JSON.stringify({ name: `<img src=x onerror=alert(1)>` }));
    await writeFile(path.join(root, "README.md"), "# <script>alert(1)</script>\nA small project.\n");
    const analysis = await analyzeProject(root);
    const html = renderHtmlReport(createProjectReportPayload(analysis, new Date("2026-11-22T00:00:00.000Z")));
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<style>");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<img src=x onerror");
    expect(html).not.toMatch(/<script(?:\s|>)/i);
    expect(html).toContain("Technical debt summary");
    const reportPath = path.join(root, "analysis.html");
    const report = await writeProjectReport(analysis, "html", reportPath, root);
    expect(await readFile(report.outputPath, "utf8")).toContain("Technical debt summary");
    await expect(writeProjectReport(analysis, "html", reportPath, root)).rejects.toThrow(/Refusing to overwrite/);
  });
});
