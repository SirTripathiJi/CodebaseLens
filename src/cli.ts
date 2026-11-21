#!/usr/bin/env node
import { Command } from "commander";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { analyzeProject } from "./intelligence/analyze-project.js";
import { renderTerminalReport } from "./reports/terminal.js";
import { writeProjectReport, type ExportFormat } from "./reports/report.js";
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
  .option("--format <format>", "output format: terminal, markdown, or json", "terminal")
  .option("--output <path>", "write a Markdown or JSON report to this path")
  .action(async (directory: string, options: { format: string; output?: string }) => {
    try {
      if (!["terminal", "markdown", "json"].includes(options.format)) {
        throw new Error(`Unsupported output format "${options.format}". Choose terminal, markdown, or json.`);
      }
      if (options.output && options.format === "terminal") {
        throw new Error("The --output option requires --format markdown or --format json.");
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
