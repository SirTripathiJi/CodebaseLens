# CodebaseLens

CodebaseLens is a lightweight command-line tool that summarizes a software project: files, languages, frameworks, dependencies, package manager, configuration files, and code markers. It skips common dependency and generated-output directories and does not follow symbolic links.

## Requirements

Node.js 20.19 or newer.

## Install

```sh
npm install
npm run build
npm link
```

Then run `codebaselens analyze .` in a project directory.

## Development

Clone the repository, install its dependencies, and run the CLI without a global install:

```sh
npm install
npm run dev -- analyze .
```

The available project commands are:

| Command | Purpose |
| --- | --- |
| `npm run dev -- analyze [directory]` | Run the TypeScript CLI directly; directory defaults to `.` |
| `npm test` | Run the automated test suite |
| `npm run typecheck` | Check TypeScript types without emitting files |
| `npm run build` | Compile the package into `dist/` |

The installed CLI also supports `codebaselens --help` and `codebaselens --version`.

## Project analysis

The analyzer identifies frameworks from dependency manifests, reports dependency names and production/development counts from `package.json`, and uses lockfiles to identify npm, pnpm, Yarn, or Bun. It lists common configuration files without opening environment files. Code marker matches include file paths and line numbers; source files are scanned without printing their contents.

## Health score and insights

The health score starts with the maximum points in each applicable category and subtracts only the deductions below. The final score is the earned points divided by applicable points, rounded to the nearest integer. Dependency setup is not applicable to projects without a Node package manifest or JavaScript/TypeScript source, and its weight is excluded from that calculation.

| Category | Maximum | Deterministic deductions |
| --- | ---: | --- |
| Project configuration | 20 | 8 points when TypeScript files exist without `tsconfig.json` |
| Documentation | 15 | 15 points when no root README exists |
| Dependency setup | 15 | 12 points when a JavaScript/TypeScript project has no `package.json`; 15 when it is invalid; 5 when declared dependencies have no unambiguous lockfile evidence |
| Version control hygiene | 15 | 10 points when `.gitignore` is missing |
| Code quality indicators | 20 | 8 points when no tests match recognized patterns; 4 points for 11–30 code markers or 8 points for more than 30 |
| Project structure | 15 | 15 points when no files are found outside ignored folders |

Missing optional ESLint, Prettier, Docker, and environment-example files do not reduce the score. Insights explain observed conditions and offer recommendations; for example, an undetected test layout is informational, while malformed `package.json` is critical. The score summarizes detectable signals and does not measure runtime correctness or security.

## Report exports

```sh
npm run dev -- analyze . --format markdown
npm run dev -- analyze . --format json
npm run dev -- analyze . --format json --output ./analysis.json
```

Markdown and JSON reports include the scan date, analysis, score categories, deductions, insights, recommendations, and scoring methodology. Without `--output`, CodebaseLens saves a project-named report in the current directory, or alongside the analyzed directory when the command is run from inside that project. This keeps the default report outside the scanned project. Custom relative output paths are resolved from the current working directory. Reports cannot be written to `.env`-named paths.

## Example

```text
$ codebaselens analyze .
Project: my-app
Path: /work/my-app
Project health: 92/100
Files: 12
Directories: 3

Health categories:
  Project configuration: 20/20
  Documentation: 15/15
  Dependency setup: 15/15
  Version control hygiene: 15/15
  Code quality indicators: 12/20
  Project structure: 15/15

Files by language:
  JSON: 1
  Markdown: 1
  TypeScript: 8
  TypeScript (TSX): 2

Frameworks:
  Next.js, React

Dependencies:
  Production (2): next, react
  Development (2): eslint, typescript

Package manager: npm

Configuration files:
  .env.example
  .gitignore
  package.json
  tsconfig.json

Code markers: 1 (TODO 1, FIXME 0, HACK 0)
  src/app.tsx:18 (TODO)

Important insights:
  [info] No tests detected: No files matched common test directory or filename patterns.
    Recommendation: Add automated tests or verify that the test filenames use a recognized convention.

Top-level folders:
  src
  tests
```

Counts exclude `node_modules`, `.git`, `dist`, `build`, `coverage`, `.next`, `.nuxt`, `.cache`, and `vendor`. Unknown file extensions are grouped as `Other`. Multiple or missing lockfile types are reported as an unknown package manager. Actual `.env` files are never opened or listed.
