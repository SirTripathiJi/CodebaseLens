#!/usr/bin/env node
import { Command } from "commander";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { analyzeProject } from "./intelligence/analyze-project.js";
import packageMetadata from "../package.json" with { type: "json" };

export const program = new Command();

program
  .name("codebaselens")
  .description("Scan a project directory and summarize its files and languages.")
  .version(packageMetadata.version);

program
  .command("analyze")
  .description("Analyze a project directory")
  .argument("[directory]", "directory to scan", ".")
  .action(async (directory: string) => {
    try {
      const result = await analyzeProject(directory);
      console.log(`Project: ${result.projectName}`);
      console.log(`Path: ${result.rootPath}`);
      console.log(`Files: ${result.totalFiles}`);
      console.log(`Directories: ${result.totalDirectories}`);
      console.log("\nFiles by language:");

      const languages = Object.entries(result.filesByLanguage).sort(
        ([left], [right]) => left.localeCompare(right),
      );
      if (languages.length === 0) {
        console.log("  (no files found)");
      } else {
        for (const [language, count] of languages) {
          console.log(`  ${language}: ${count}`);
        }
      }

      console.log("\nFrameworks:");
      console.log(
        result.frameworks.length > 0 ? `  ${result.frameworks.join(", ")}` : "  (none detected)",
      );

      console.log("\nDependencies:");
      if (result.dependencies.packageJsonStatus === "valid") {
        console.log(
          `  Production (${result.dependencies.productionCount}): ${result.dependencies.productionNames.join(", ") || "(none)"}`,
        );
        console.log(
          `  Development (${result.dependencies.developmentCount}): ${result.dependencies.developmentNames.join(", ") || "(none)"}`,
        );
      } else {
        console.log(`  Unavailable: package.json ${result.dependencies.packageJsonStatus}`);
      }

      console.log(`\nPackage manager: ${result.packageManager}`);
      console.log("\nConfiguration files:");
      console.log(
        result.configurationFiles.length > 0
          ? result.configurationFiles.map((file) => `  ${file}`).join("\n")
          : "  (none detected)",
      );

      const markerSummary = Object.entries(result.markers.counts)
        .map(([marker, count]) => `${marker} ${count}`)
        .join(", ");
      console.log(`\nCode markers: ${result.markers.total} (${markerSummary})`);
      if (result.markers.locations.length > 0) {
        for (const location of result.markers.locations) {
          console.log(`  ${location.filePath}:${location.line} (${location.marker})`);
        }
      }

      console.log("\nTop-level folders:");
      console.log(
        result.topLevelFolders.length > 0
          ? result.topLevelFolders.map((folder) => `  ${folder}`).join("\n")
          : "  (none)",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exitCode = 1;
    }
  });

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await program.parseAsync(process.argv);
}
