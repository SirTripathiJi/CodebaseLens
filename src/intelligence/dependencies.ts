import { readFile } from "node:fs/promises";
import path from "node:path";
import type { DependencyAnalysis } from "./types.js";

export interface PackageManifest {
  name?: string;
  dependencyNames: Set<string>;
  productionNames: string[];
  developmentNames: string[];
}

function namesIn(value: unknown): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
  return Object.entries(value)
    .filter(([, version]) => typeof version === "string")
    .map(([name]) => name)
    .sort((left, right) => left.localeCompare(right));
}

export async function readPackageManifest(
  rootPath: string,
  rootFiles: Set<string>,
): Promise<{ analysis: DependencyAnalysis; manifest: PackageManifest | null }> {
  if (!rootFiles.has("package.json")) {
    return {
      analysis: {
        packageJsonStatus: "missing",
        productionCount: 0,
        developmentCount: 0,
        productionNames: [],
        developmentNames: [],
      },
      manifest: null,
    };
  }

  try {
    const parsed: unknown = JSON.parse(await readFile(path.join(rootPath, "package.json"), "utf8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("package.json must contain a JSON object");
    }

    const packageData = parsed as Record<string, unknown>;
    const productionNames = namesIn(packageData.dependencies);
    const developmentNames = namesIn(packageData.devDependencies);
    const dependencyNames = new Set([
      ...productionNames,
      ...developmentNames,
      ...namesIn(packageData.peerDependencies),
      ...namesIn(packageData.optionalDependencies),
    ]);
    const packageName = typeof packageData.name === "string" && packageData.name.trim()
      ? packageData.name.trim()
      : undefined;

    return {
      analysis: {
        packageJsonStatus: "valid",
        productionCount: productionNames.length,
        developmentCount: developmentNames.length,
        productionNames,
        developmentNames,
      },
      manifest: { name: packageName, dependencyNames, productionNames, developmentNames },
    };
  } catch {
    return {
      analysis: {
        packageJsonStatus: "invalid",
        productionCount: 0,
        developmentCount: 0,
        productionNames: [],
        developmentNames: [],
      },
      manifest: null,
    };
  }
}
