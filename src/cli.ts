#!/usr/bin/env node
import { Command, Option } from "commander";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { analyzeProject } from "./intelligence/analyze-project.js";
import { renderTerminalReport } from "./reports/terminal.js";
import { writeProjectReport, type ExportFormat } from "./reports/report.js";
import packageMetadata from "../package.json" with { type: "json" };

export const program = new Command();

program
  .name("codebaselens")
  .description("Analyze project structure, languages, project intelligence, and health.")
  .showHelpAfterError()
  .showSuggestionAfterError()
  .version(packageMetadata.version);

program
  .command("analyze")
  .description("Analyze a project directory")
  .argument("[directory]", "directory to scan", ".")
  .addOption(
    new Option("--format <format>", "report format").choices(["terminal", "markdown", "json", "html"]).default("terminal"),
  )
  .option("--output <path>", "write a Markdown, JSON, or HTML report to this path")
  .action(async (directory: string, options: { format: string; output?: string }) => {
    try {
      if (options.output && options.format === "terminal") {
        throw new Error("The --output option requires --format markdown, --format json, or --format html.");
      }

      const result = await analyzeProject(directory);
      if (options.format === "terminal") {
        console.log(renderTerminalReport(result));
      } else {
        const report = await writeProjectReport(result, options.format as ExportFormat, options.output);
        console.log(`Report written to ${report.outputPath}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exitCode = 1;
    }
  });

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await program.parseAsync(process.argv);
}
