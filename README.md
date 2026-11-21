# CodebaseLens

CodebaseLens is a local command-line tool for understanding a project from its files and manifests. It summarizes repository structure, languages, selected framework and package-manager signals, JavaScript dependencies, configuration files, code markers, and a deterministic project-health score with evidence and recommendations.

It is intended for developers onboarding to an unfamiliar repository, maintainers reviewing project hygiene, and teams that want a quick, repeatable inventory before deeper work. The value is a compact, explainable snapshot: findings point to observable files and rules rather than attempting to execute or judge the application.

CodebaseLens does not modify the project being analyzed. It does not follow symbolic links and does not read `.env` files.

## Table of contents

- [Features](#features)
- [Installation](#installation)
- [Quick start](#quick-start)
- [CLI reference](#cli-reference)
- [Output examples](#output-examples)
- [Health score methodology](#health-score-methodology)
- [Insights and recommendations](#insights-and-recommendations)
- [Supported languages and frameworks](#supported-languages-and-frameworks)
- [JavaScript API](#javascript-api)
- [Project architecture](#project-architecture)
- [Development setup](#development-setup)
- [Example workflow: React project](#example-workflow-react-project)
- [Limitations](#limitations)
- [Roadmap ideas](#roadmap-ideas)
- [License](#license)

## Features

| Capability | What it reports |
| --- | --- |
| Recursive scan | Regular file and directory totals, root-level folders, and extension-based file counts. It skips `node_modules`, `.git`, `dist`, `build`, `coverage`, `.next`, `.nuxt`, `.cache`, and `vendor`. |
| Language grouping | Counts recognized extensions and groups unrecognized extensions as `Other`. This is extension detection, not parsing. |
| Framework signals | Detects a fixed set of frameworks using package dependencies or root build/manifest files. Multiple matches can be reported. |
| Dependency analysis | Reads root `package.json` and lists/counts `dependencies` and `devDependencies` separately. Peer and optional dependencies are considered for framework detection, but are not included in the production/development counts. |
| Package manager | Identifies npm, pnpm, Yarn, or Bun from a single unambiguous recognized root lockfile; otherwise reports `unknown`. |
| Configuration inventory | Lists recognized root configuration files such as `tsconfig.json`, package metadata, lint/format configuration, Docker files, `.gitignore`, and example environment files. Real `.env` files are excluded. |
| Code markers | Counts case-insensitive TODO, FIXME, and HACK tokens in supported source extensions and records project-relative file paths and one-based line numbers. |
| Health analysis | Calculates a normalized score out of 100, category scores, and explicit deductions. |
| Insights | Produces sorted critical, warning, and informational findings with an explanation and recommended action. |
| Reports | Prints a terminal report or writes a Markdown or JSON report containing the analysis and scoring methodology. |

The scanner counts regular files and directories only. Symlinks are skipped, as are entries inside the fixed ignored-directory list above.

## Installation

Requires Node.js 20.19 or newer.

Install the published scoped package globally:

```sh
npm install -g @tripathi_ji/codebaselens
```

Or run with `npx` without a global install:

```sh
npx @tripathi_ji/codebaselens analyze .
```

The installed executable is `codebaselens`.

## Quick start

```sh
codebaselens --version
codebaselens --help
codebaselens analyze .
```

The analyze command scans the current directory and prints the terminal report by default.

## CLI reference

The CLI exposes one subcommand, `analyze`, plus Commander’s top-level help and version options.

| Command | Arguments and options | Default / result |
| --- | --- | --- |
| `codebaselens analyze [directory]` | Optional directory path; relative and absolute paths are accepted. | Directory defaults to `.`; terminal report is printed. |
| `codebaselens analyze [directory] --format <format>` | `terminal`, `markdown`, or `json`. | `terminal`. Unsupported values are rejected by the CLI. |
| `codebaselens analyze [directory] --format markdown --output <path>` | Optional custom output path. | Writes Markdown to an automatically selected `*-report.md` path if omitted. |
| `codebaselens analyze [directory] --format json --output <path>` | Optional custom output path. | Writes JSON to an automatically selected `*-report.json` path if omitted. |
| `codebaselens --help` | No arguments. | Displays top-level help. `codebaselens analyze --help` displays analyze options. |
| `codebaselens --version` | No arguments. | Prints the package version. |

With Markdown or JSON, the default report is written outside the analyzed tree: typically in the current working directory when outside the project, or next to the project when invoked from inside it. If that would still place it within the scanned project, the system temporary directory is used. The CLI prints `Report written to <path>`. A custom `--output` path is resolved relative to the current working directory; its parent directory must already exist. Paths whose basename starts with `.env` are rejected. `--output` cannot be combined with terminal format.

Examples:

```sh
# Analyze the current working directory
codebaselens analyze .

# Analyze a specified relative or absolute directory
codebaselens analyze ../storefront
codebaselens analyze "/work/client project"

# Explicit terminal format
codebaselens analyze /work/storefront --format terminal

# Write JSON using the default report filename
codebaselens analyze /work/storefront --format json

# Write Markdown to a chosen path (the reports directory must exist)
codebaselens analyze /work/storefront --format markdown --output ./reports/storefront.md

# Write JSON to a chosen path
codebaselens analyze . --format json --output ./analysis.json

# Inspect CLI usage and version
codebaselens --help
codebaselens analyze --help
codebaselens --version
```

On invalid scan paths or report write failures, the CLI prints an error to stderr and exits with status 1.

## Output examples

The following snippets are illustrative examples only. Counts, findings, paths, and scores depend on the analyzed project.

### Terminal

```text
Project: storefront
Path: /work/storefront
Project health: 96/100
12 files · 3 directories

Health categories:
  Project configuration: 20/20
  Documentation: 15/15
  Dependency setup: 15/15
  Version control hygiene: 15/15
  Code quality indicators: 16/20
  Project structure: 15/15

Languages:
  JavaScript: 2
  JavaScript (JSX): 2
  JSON: 2
  Markdown: 1
  TypeScript: 3
  TypeScript (TSX): 2

Frameworks:
  React

Dependencies:
  Production (1):
    react
  Development (2):
    eslint, vite

Configuration: .gitignore, package.json, tsconfig.json
Package manager: npm
Code markers: 11 (TODO 11, FIXME 0, HACK 0)
Marker locations:
  src/App.tsx:18 (TODO)

Important insights:
  [warning] Code marker backlog detected: 11 code markers were found, above the 10-marker review threshold.
    Recommendation: Review the listed locations and prioritize items that block correctness or maintenance.

Top-level folders: public, src, tests
```

The terminal report lists at most ten marker locations; Markdown and JSON exports contain the full location list.

### JSON

JSON output is a complete payload with `reportVersion`, an ISO `scanDate`, the full `project` analysis, and `healthScoringMethodology`. Representative excerpt:

```json
{
  "reportVersion": 1,
  "scanDate": "2026-11-21T10:00:00.000Z",
  "project": {
    "projectName": "storefront",
    "totalFiles": 12,
    "frameworks": ["React"],
    "packageManager": "npm",
    "health": {
      "score": 96,
      "methodologyVersion": "1.0",
      "categories": [
        {
          "id": "configuration",
          "name": "Project configuration",
          "score": 20,
          "maxScore": 20,
          "deductions": []
        }
      ]
    },
    "insights": [
      {
        "id": "many-code-markers",
        "title": "Code marker backlog detected",
        "explanation": "11 code markers were found, above the 10-marker review threshold.",
        "severity": "warning",
        "recommendation": "Review the listed locations and prioritize items that block correctness or maintenance."
      }
    ]
  },
  "healthScoringMethodology": {
    "version": "1.0",
    "scale": { "minimum": 0, "maximum": 100 }
  }
}
```

This excerpt omits other fields and categories for readability; actual reports contain the complete analysis object and methodology.

### Markdown

Representative generated Markdown excerpt:

```markdown
# CodebaseLens report: storefront

- Scan date: 2026-11-21T10:00:00.000Z
- Project path: `/work/storefront`

## Project health: 96/100

| Category | Score | Deductions |
| --- | ---: | --- |
| Project configuration | 20/20 | None |
| Documentation | 15/15 | None |

## Analysis summary

- Files: 12
- Directories: 3
- Package manager: npm
- Dependency manifest status: valid
- Tests detected: yes

### Code markers

- Total: 11
- TODO: 11
- FIXME: 0
- HACK: 0
- `src/App.tsx:18` — TODO
```

Generated Markdown also includes languages, frameworks, dependency names, configuration files, all marker locations, top-level folders, insights and recommendations, and scoring methodology.

## Health score methodology

The score is a deterministic summary of detectable signals, not a measure of runtime correctness or security. There are six categories, with the following maximum points and deductions:

| Category | Maximum | Implemented deductions |
| --- | ---: | --- |
| Project configuration | 20 | −8 if TypeScript or TSX files exist but root `tsconfig.json` is absent. |
| Documentation | 15 | −15 if no root file named `README` (optionally with an extension, case-insensitive) exists. |
| Dependency setup | 15 | −12 if JavaScript/TypeScript files exist but `package.json` is missing; −15 if `package.json` is invalid JSON; −5 if a valid manifest declares dependencies but no single recognized package manager is identified. |
| Version control hygiene | 15 | −10 if root `.gitignore` is absent. |
| Code quality indicators | 20 | −8 if source files exist but no test file matches recognized patterns; −4 for 11–30 markers; −8 for more than 30 markers. |
| Project structure | 15 | −15 if no files are found outside ignored directories. |

Each category score is its maximum minus applicable deductions, floored at zero. The overall score is the sum of earned points divided by the sum of maximum points for applicable categories, multiplied by 100 and rounded to the nearest integer. Dependency setup is not applicable when both `package.json` and JavaScript/TypeScript files are absent; its 15 possible points are excluded from the denominator. All other categories remain applicable. If no category is applicable, the score is zero. The resulting score is bounded from 0 to 100.

The code-quality marker tiers are mutually exclusive: 11–30 markers deduct 4, and more than 30 deduct 8. Ten or fewer markers cause no deduction. Missing optional ESLint, Prettier, Docker, or environment-example files do not change the score. The methodology is exposed as `HEALTH_METHODOLOGY` and included in exported report payloads.

## Insights and recommendations

Insights are generated from the same observed signals used in analysis, with a short explanation and a suggested action. They are sorted by severity (`critical`, then `warning`, then `info`) and by ID within a severity.

| Evidence | Example insight and recommendation |
| --- | --- |
| No regular files were found | Critical `No project files found`; verify the path or add project files. |
| No root README or `.gitignore` | Warning asking to add project documentation or ignore rules for generated, local, and private files. |
| Invalid or missing `package.json` where relevant | Critical for invalid JSON; warning when JavaScript/TypeScript source lacks a manifest. Correct the JSON or add a manifest if Node tooling is used. |
| TypeScript/TSX files with no root `tsconfig.json` | Warning to add TypeScript configuration if the project uses `tsc`. |
| Source files but no recognized test pattern | Informational suggestion to add tests or use a recognized filename/directory convention. |
| More than 10 TODO/FIXME/HACK markers | Warning to review locations and prioritize maintenance or correctness blockers. |
| Declared dependencies without one identifiable lockfile manager | Warning to commit the lockfile for the package manager in use. |

These are pattern-based observations, not proof of a defect. For example, a custom test layout may exist without being recognized.

## Supported languages and frameworks

Language names are assigned by file extension, case-insensitively:

| Language group | Extensions |
| --- | --- |
| C | `.c` |
| C++ | `.cc`, `.cpp`, `.hpp` |
| C# | `.cs` |
| C/C++ Header | `.h` |
| CSS | `.css` |
| Go | `.go` |
| HTML | `.html` |
| Java | `.java` |
| JavaScript | `.js` |
| JavaScript (JSX) | `.jsx` |
| JSON | `.json` |
| Kotlin | `.kt` |
| Markdown | `.md` |
| PHP | `.php` |
| Python | `.py` |
| Ruby | `.rb` |
| Rust | `.rs` |
| Scala | `.scala` |
| Shell | `.sh` |
| SQL | `.sql` |
| Swift | `.swift` |
| TypeScript | `.ts` |
| TypeScript (TSX) | `.tsx` |
| Vue | `.vue` |
| XML | `.xml` |
| YAML | `.yaml`, `.yml` |
| Other | Any unrecognized extension (including extensionless files). |

Framework detection is limited to these explicit signals:

| Framework | Detection evidence |
| --- | --- |
| React | `react` or `next` dependency in root `package.json` |
| Next.js | `next` dependency in root `package.json` |
| Vue | `vue` or `nuxt` dependency in root `package.json` |
| Nuxt | `nuxt` dependency in root `package.json` |
| Angular | `@angular/core` dependency in root `package.json` |
| Svelte | `svelte` dependency in root `package.json` |
| Express | `express` dependency in root `package.json` |
| NestJS | `@nestjs/core` dependency in root `package.json` |
| Fastify | `fastify` or `@nestjs/platform-fastify` dependency in root `package.json` |
| Django, Flask, FastAPI | Name token found in root `requirements*.txt`, `pyproject.toml`, `Pipfile`, `Pipfile.lock`, or `poetry.lock` text |
| Laravel | `laravel/framework` in root `composer.json` `require` or `require-dev` |
| Spring Boot | Spring Boot evidence in root `pom.xml`, `build.gradle`, or `build.gradle.kts` |

These checks do not parse every ecosystem's manifest format completely and do not infer frameworks from source code or folder names.

Package manager detection recognizes root `package-lock.json` or `npm-shrinkwrap.json` (npm), `pnpm-lock.yaml` (pnpm), `yarn.lock` (Yarn), and `bun.lock` or `bun.lockb` (Bun). It reports a manager only when exactly one manager matches.

## JavaScript API

The package exports an ES module entry point and TypeScript declarations. Supported named exports are:

```js
import {
  analyzeProject,
  scanDirectory,
  calculateProjectHealth,
  generateProjectInsights,
  HEALTH_METHODOLOGY,
  renderTerminalReport,
  createProjectReportPayload,
  renderJsonReport,
  renderMarkdownReport,
  resolveReportOutputPath,
  writeProjectReport,
} from "@tripathi_ji/codebaselens";

const analysis = await analyzeProject(".");
console.log(renderTerminalReport(analysis));
```

The package also exports TypeScript types: `ScanResult`, `DependencyAnalysis`, `HealthCategory`, `HealthDeduction`, `InsightSeverity`, `MarkerAnalysis`, `MarkerKind`, `MarkerLocation`, `PackageJsonStatus`, `ProjectAnalysis`, `ProjectHealth`, `ProjectInsight`, `ProjectSignals`, `ExportFormat`, `ProjectReportPayload`, and `WrittenReport`.

`calculateProjectHealth` and `generateProjectInsights` take an analysis subset and `ProjectSignals`; their implementation signatures and data shapes are available in the published declarations. `writeProjectReport` writes to disk. The CLI is provided separately as the `codebaselens` executable.

## Project architecture

| Module | Responsibility |
| --- | --- |
| `src/scanner.ts` | Recursively scans regular files/directories, skips configured directory names, counts extension groups, and lists root folders. |
| `src/intelligence/` | Builds the project analysis: file lists, package manifest and dependency data, frameworks, package manager, configuration files, and marker locations. |
| `src/health/` | Detects project signals, applies the versioned scoring methodology, and generates prioritized insights. |
| `src/reports/` | Renders terminal, Markdown, and JSON reports and resolves/writes export paths. |
| `src/cli.ts` | Defines the `codebaselens` Commander CLI and connects analysis to report output. |
| `src/index.ts` | Exposes the public JavaScript and TypeScript API. |

## Development setup

Prerequisites: Node.js 20.19 or newer and npm.

```sh
git clone https://github.com/SirTripathiJi/CodebaseLens.git
cd CodebaseLens
npm ci
```

Available scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev -- analyze .` | Run the TypeScript CLI directly through `tsx`. |
| `npm test` | Run the Vitest suite in `tests/`. |
| `npm run typecheck` | Type-check source and test TypeScript configurations without emitting files. |
| `npm run build` | Compile JavaScript and declarations into `dist/`. |

## Example workflow: React project

From an existing React application, inspect the terminal summary:

```sh
cd /path/to/my-react-app
codebaselens analyze .
```

If the root `package.json` declares `react` (or `next`), CodebaseLens reports React. It counts `.js`, `.jsx`, `.ts`, and `.tsx` files by extension, separates production and development dependencies from `package.json`, and identifies a package manager when one recognized root lockfile is present. It also checks common configuration and marker files and reports applicable health deductions and recommendations.

Save a portable report for a review or issue:

```sh
codebaselens analyze . --format markdown --output ./review/react-project.md
```

Create `./review` first. For machine-readable analysis, use `--format json` instead.

## Limitations

- Language identification is extension-based; CodebaseLens does not parse source syntax, generated code, or language versions.
- Scanning excludes a fixed set of directory names and does not read ignore-file rules such as `.gitignore`. It does not follow symlinks.
- Framework and package-manager detection uses specific manifest and root-lockfile patterns. Custom, nested, or newer conventions may not be recognized.
- Production and development dependency lists come only from root `package.json`; dependencies in Python, PHP, Java, or other ecosystem manifests are not inventoried or counted.
- Marker scanning searches raw text for whole-word TODO, FIXME, and HACK in a fixed set of source extensions. It does not interpret comments, and skips a file if a NUL byte is encountered while reading it.
- Test detection uses common directory and filename patterns. A project can have tests that are not detected.
- Health scoring measures selected repository signals only. It does not run tests or builds, inspect dependency vulnerabilities, assess runtime behavior, or prove code quality.
- Report output directories are not created automatically. The CLI prevents writing reports to paths whose basename starts with `.env`; reports can still contain absolute project paths and should be handled accordingly.

## Roadmap ideas

Potential future improvements, not current functionality:

- Configurable scan exclusions and marker patterns.
- Broader manifest support for dependency inventory across ecosystems.
- Additional framework and test-convention detection.
- Optional CI output formats and baseline comparisons.

## License

MIT. See [LICENSE](LICENSE).
