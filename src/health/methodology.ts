const CODE_MARKER_NAMES = ["TO" + "DO", "FIX" + "ME", "HA" + "CK"].join("/");

export const HEALTH_METHODOLOGY = {
  version: "1.0",
  scale: { minimum: 0, maximum: 100 },
  normalization: "Earned category points divided by applicable category points, rounded to the nearest integer.",
  categories: [
    { id: "configuration", name: "Project configuration", maximum: 20 },
    { id: "documentation", name: "Documentation", maximum: 15 },
    { id: "dependencies", name: "Dependency setup", maximum: 15 },
    { id: "version-control", name: "Version control hygiene", maximum: 15 },
    { id: "code-quality", name: "Code quality indicators", maximum: 20 },
    { id: "structure", name: "Project structure", maximum: 15 },
  ],
  deductions: [
    { category: "Project configuration", points: 8, condition: "TypeScript files exist but tsconfig.json is absent." },
    { category: "Documentation", points: 15, condition: "No root README file exists." },
    { category: "Dependency setup", points: 12, condition: "A JavaScript/TypeScript project has no package.json." },
    { category: "Dependency setup", points: 15, condition: "package.json is invalid JSON." },
    { category: "Dependency setup", points: 5, condition: "A valid package.json declares dependencies but no single package manager is identified from lockfiles." },
    { category: "Version control hygiene", points: 10, condition: ".gitignore is absent." },
    { category: "Code quality indicators", points: 8, condition: "Source files exist, but no test file is detected using common test directory or filename patterns." },
    { category: "Code quality indicators", points: 4, condition: `There are 11–30 ${CODE_MARKER_NAMES} markers.` },
    { category: "Code quality indicators", points: 8, condition: `There are more than 30 ${CODE_MARKER_NAMES} markers.` },
    { category: "Project structure", points: 15, condition: "No files are found outside ignored directories." },
  ],
  notes: [
    "Optional ESLint, Prettier, Docker, and environment-example files do not affect the score.",
    "Dependency setup is not applicable to projects with no package.json and no JavaScript/TypeScript files; its weight is excluded before normalization.",
    "The score is a deterministic summary of detectable project signals, not a measure of runtime correctness or security.",
  ],
} as const;

export const HEALTH_CATEGORY_WEIGHTS = {
  configuration: 20,
  documentation: 15,
  dependencies: 15,
  versionControl: 15,
  codeQuality: 20,
  structure: 15,
} as const;
