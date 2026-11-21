#!/usr/bin/env node
import { Command } from "commander";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { scanDirectory } from "./scanner.js";
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
      const result = await scanDirectory(directory);
      console.log(`CodebaseLens analysis: ${result.rootPath}`);
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
