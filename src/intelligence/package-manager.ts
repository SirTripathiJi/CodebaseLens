const LOCKFILE_MANAGERS: Array<[string, string[]]> = [
  ["npm", ["package-lock.json", "npm-shrinkwrap.json"]],
  ["pnpm", ["pnpm-lock.yaml"]],
  ["Yarn", ["yarn.lock"]],
  ["Bun", ["bun.lock", "bun.lockb"]],
];

export function detectPackageManager(rootFiles: Set<string>): string {
  const matches = LOCKFILE_MANAGERS
    .filter(([, lockfiles]) => lockfiles.some((lockfile) => rootFiles.has(lockfile)))
    .map(([manager]) => manager);

  return matches.length === 1 ? matches[0] : "unknown";
}
