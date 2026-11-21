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

## Example

```text
$ codebaselens analyze .
Project: my-app
Path: /work/my-app
Files: 12
Directories: 3

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

Top-level folders:
  src
  tests
```

Counts exclude `node_modules`, `.git`, `dist`, `build`, `coverage`, `.next`, `.nuxt`, `.cache`, and `vendor`. Unknown file extensions are grouped as `Other`. Multiple or missing lockfile types are reported as an unknown package manager. Actual `.env` files are never opened or listed.
