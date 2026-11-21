# CodebaseLens

CodebaseLens is a lightweight command-line project analyzer. It gives developers a quick, evidence-based view of a codebase: its size, languages, likely frameworks, dependencies, configuration, code markers, and project health.

It runs locally, does not modify the project being analyzed, does not follow symbolic links, and never reads `.env` files.

## Features

- Recursively counts files and directories, groups files by language, and lists top-level folders.
- Skips `node_modules`, `.git`, `dist`, `build`, `coverage`, `.next`, `.nuxt`, `.cache`, and `vendor`.
- Detects supported frameworks from project manifests and dependencies.
- Summarizes production and development dependencies in `package.json` and identifies a package manager from lockfiles.
- Detects common configuration files without reading environment secrets.
- Finds TODO, FIXME, and HACK markers in supported source files and reports their locations, not file contents.
- Calculates a deterministic project health score, explains deductions, and provides prioritized insights.
- Prints a terminal summary or saves a Markdown or JSON report.

## Requirements

- Node.js 20.19 or newer.

## Install

After release, install the CLI globally:

```sh
npm install --global @tripathi_ji/codebaselens
```

Or run it without a global install using `npx`:

```sh
npx @tripathi_ji/codebaselens analyze .
```

## Usage

```sh
codebaselens analyze .
codebaselens analyze "/path/to/my project"
codebaselens analyze /absolute/path/to/project --format json
codebaselens analyze . --format markdown --output ./reports/project.md
codebaselens --help
codebaselens --version
```

The directory is optional and defaults to the current directory. Paths may be relative or absolute. Supported formats are `terminal` (default), `markdown`, and `json`. Markdown and JSON reports use a project-named file in the current directory by default; when run from inside the analyzed project, the default report is written alongside it. Use `--output` to choose a path. Parent directories must already exist.

### Development

```sh
git clone https://github.com/SirTripathiJi/CodebaseLens.git
cd CodebaseLens
npm ci
npm run dev -- analyze .
```

Useful development scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev -- analyze [directory]` | Run the TypeScript CLI directly; directory defaults to `.` |
| `npm test` | Run the automated test suite |
| `npm run typecheck` | Type-check source and tests |
| `npm run build` | Compile production JavaScript and declarations into `dist/` |

## Terminal output example

```text
Project: sample-app
Path: /work/sample-app
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
  TypeScript: 8
  TypeScript (TSX): 2

Frameworks:
  Next.js, React

Dependencies:
  Production (2): next, react
  Development (2): eslint, typescript

Package manager: npm
Configuration files:
  .gitignore
  package.json
  tsconfig.json
Code markers: 1 (TODO 1, FIXME 0, HACK 0)
```

## Markdown report example

Run `codebaselens analyze . --format markdown`. Reports include a scan timestamp, project summary, languages, frameworks, dependency names, configuration, marker locations, health categories, deductions, insights, recommended actions, and scoring methodology.

```markdown
# CodebaseLens report: sample-app

- Scan date: 2026-11-21T10:00:00.000Z
- Project path: `/work/sample-app`

## Project health: 92/100

| Category | Score | Deductions |
| --- | ---: | --- |
| Documentation | 15/15 | None |

## Insights and recommendations

No notable insights were detected.
```

## JSON report example

Run `codebaselens analyze . --format json`. The report is structured JSON with a stable `reportVersion`, `scanDate`, `project` analysis object, and `healthScoringMethodology`.

```json
{
  "reportVersion": 1,
  "scanDate": "2026-11-21T10:00:00.000Z",
  "project": {
    "projectName": "sample-app",
    "health": { "score": 92 }
  },
  "healthScoringMethodology": {
    "version": "1.0"
  }
}
```

The examples are shortened for readability; generated reports contain the full analysis.

## Supported languages

File extensions are grouped as C, C++, C#, C/C++ Header, CSS, Go, HTML, Java, JavaScript, JavaScript (JSX), JSON, Kotlin, Markdown, PHP, Python, Ruby, Rust, Scala, Shell, SQL, Swift, TypeScript, TypeScript (TSX), Vue, XML, YAML, or Other. Unknown extensions are counted as `Other`.

## Supported framework detection

CodebaseLens looks for evidence of React, Next.js, Vue, Nuxt, Angular, Svelte, Express, NestJS, Fastify, Django, Flask, FastAPI, Laravel, and Spring Boot. Detection uses dependency manifests and build configuration; it does not infer a framework from folder names alone. A project may report multiple frameworks when the manifests support them.

## Health score

The score is deterministic, ranges from 0 to 100, and is based on detected project signals. It is not a security audit or a measure of runtime correctness. Category weights and deductions are:

| Category | Maximum | Deductions |
| --- | ---: | --- |
| Project configuration | 20 | 8 when TypeScript files exist without `tsconfig.json` |
| Documentation | 15 | 15 when no root README exists |
| Dependency setup | 15 | 12 when JavaScript/TypeScript source has no `package.json`; 15 for invalid JSON; 5 when dependencies exist without a single identified package manager |
| Version control hygiene | 15 | 10 when `.gitignore` is missing |
| Code quality indicators | 20 | 8 when source exists but no common test pattern is detected; 4 for 11–30 TODO/FIXME/HACK markers; 8 for more than 30 |
| Project structure | 15 | 15 when no regular files are found outside ignored directories |

Applicable category points are normalized to a 100-point scale and rounded to the nearest integer. Dependency setup is excluded for projects where it does not apply. Missing optional ESLint, Prettier, Docker, or environment-example files does not reduce the score. An undetected test layout is informational because not every test convention can be recognized.

## Limitations

- Framework and test detection rely on known manifest and filename patterns; custom conventions may not be recognized.
- Dependency counts come from `package.json` and do not include Python, PHP, or Java dependency counts.
- Package manager detection uses root lockfiles and returns `unknown` when evidence is missing or ambiguous.
- Marker scanning supports common text source extensions and skips files containing binary NUL bytes.
- Ignored directory names are fixed to the list above; this is not a configurable ignore-file parser.
- CodebaseLens reports observable signals and does not install dependencies, execute project code, assess vulnerabilities, or validate build behavior.

## Contributing

Bug reports and pull requests are welcome at https://github.com/SirTripathiJi/CodebaseLens. For changes, run `npm ci`, `npm test`, `npm run typecheck`, and `npm run build` before submitting a pull request.

## License

MIT. See [LICENSE](LICENSE).
