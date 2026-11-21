export function detectConfigurationFiles(rootFiles: Set<string>): string[] {
  const matches = [...rootFiles].filter((fileName) => {
    const lowerName = fileName.toLowerCase();

    return (
      fileName === "tsconfig.json" ||
      fileName === "package.json" ||
      fileName === ".gitignore" ||
      fileName === ".env.example" ||
      fileName === ".env.sample" ||
      lowerName === "dockerfile" ||
      lowerName.startsWith("dockerfile.") ||
      lowerName === "docker-compose" ||
      /^docker-compose\.(yml|yaml)$/.test(lowerName) ||
      /^docker-compose\.[^.]+\.(yml|yaml)$/.test(lowerName) ||
      /^compose(?:\.[^.]+)?\.(yml|yaml)$/.test(lowerName) ||
      fileName === ".eslintrc" ||
      fileName.startsWith(".eslintrc.") ||
      fileName.startsWith("eslint.config.") ||
      fileName === ".prettierrc" ||
      fileName.startsWith(".prettierrc.") ||
      fileName.startsWith("prettier.config.")
    );
  });

  return matches.sort((left, right) => left.localeCompare(right));
}
