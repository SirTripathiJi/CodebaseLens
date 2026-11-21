# CodebaseLens

CodebaseLens is a small command-line tool that scans a project directory and summarizes its files, folders, and programming languages. It skips common dependency and generated-output directories and does not follow symbolic links.

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

## Example

```text
$ codebaselens analyze .
CodebaseLens analysis: /work/my-app
Files: 12
Directories: 3

Files by language:
  JSON: 1
  Markdown: 1
  TypeScript: 8
  TypeScript (TSX): 2

Top-level folders:
  src
  tests
```

Counts exclude `node_modules`, `.git`, `dist`, `build`, `coverage`, `.next`, `.nuxt`, `.cache`, and `vendor`. Unknown file extensions are grouped as `Other`.
