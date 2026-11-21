import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PackageManifest } from "./dependencies.js";

const PYTHON_MANIFEST_NAMES = /^(requirements.*\.txt|pyproject\.toml|Pipfile|Pipfile\.lock|poetry\.lock)$/i;

export async function detectFrameworks(
  rootPath: string,
  rootFiles: Set<string>,
  manifest: PackageManifest | null,
): Promise<string[]> {
  const frameworks = new Set<string>();
  const dependencies = manifest?.dependencyNames ?? new Set<string>();

  if (dependencies.has("react") || dependencies.has("next")) frameworks.add("React");
  if (dependencies.has("next")) frameworks.add("Next.js");
  if (dependencies.has("vue") || dependencies.has("nuxt")) frameworks.add("Vue");
  if (dependencies.has("nuxt")) frameworks.add("Nuxt");
  if (dependencies.has("@angular/core")) frameworks.add("Angular");
  if (dependencies.has("svelte")) frameworks.add("Svelte");
  if (dependencies.has("express")) frameworks.add("Express");
  if (dependencies.has("@nestjs/core")) frameworks.add("NestJS");
  if (dependencies.has("fastify") || dependencies.has("@nestjs/platform-fastify")) {
    frameworks.add("Fastify");
  }

  let pythonManifestText = "";
  for (const fileName of rootFiles) {
    if (!PYTHON_MANIFEST_NAMES.test(fileName)) continue;
    try {
      pythonManifestText += `\n${await readFile(path.join(rootPath, fileName), "utf8")}`;
    } catch {
      // An unreadable optional manifest should not prevent the rest of the analysis.
    }
  }
  const pythonDependency = (name: string): boolean =>
    new RegExp(`(?:^|[^a-z0-9_.-])${name}(?=$|[^a-z0-9_.-])`, "im").test(pythonManifestText);

  if (pythonDependency("django")) frameworks.add("Django");
  if (pythonDependency("flask")) frameworks.add("Flask");
  if (pythonDependency("fastapi")) frameworks.add("FastAPI");

  if (rootFiles.has("composer.json")) {
    try {
      const composer: unknown = JSON.parse(await readFile(path.join(rootPath, "composer.json"), "utf8"));
      if (typeof composer === "object" && composer !== null) {
        const data = composer as Record<string, unknown>;
        const required = [data.require, data["require-dev"]]
          .filter((section): section is Record<string, unknown> =>
            typeof section === "object" && section !== null && !Array.isArray(section),
          );
        if (required.some((section) => "laravel/framework" in section)) frameworks.add("Laravel");
      }
    } catch {
      // Ignore invalid optional manifests and continue scanning other ecosystems.
    }
  }

  for (const buildFile of ["pom.xml", "build.gradle", "build.gradle.kts"]) {
    if (!rootFiles.has(buildFile)) continue;
    try {
      const contents = await readFile(path.join(rootPath, buildFile), "utf8");
      const usesSpringBoot = /org\.springframework\.boot(?::|["'<])/i.test(contents) ||
        /id\s*(?:\(\s*)?["']org\.springframework\.boot["']/i.test(contents);
      if (usesSpringBoot) {
        frameworks.add("Spring Boot");
        break;
      }
    } catch {
      // An unreadable optional build file is not a project-wide failure.
    }
  }

  return [...frameworks].sort((left, right) => left.localeCompare(right));
}
