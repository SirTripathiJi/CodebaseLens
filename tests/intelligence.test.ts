import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { analyzeProject } from "../src/intelligence/analyze-project.js";

const temporaryDirectories: string[] = [];

async function createProject(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codebaselens-intel-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("analyzeProject", () => {
  it("counts production and development dependencies and returns their names", async () => {
    const root = await createProject();
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "sample-app",
        dependencies: { express: "^5", react: "^19" },
        devDependencies: { eslint: "^9", typescript: "^7", vitest: "^4" },
      }),
    );

    const result = await analyzeProject(root);

    expect(result.projectName).toBe("sample-app");
    expect(result.dependencies).toMatchObject({
      packageJsonStatus: "valid",
      productionCount: 2,
      developmentCount: 3,
      productionNames: ["express", "react"],
      developmentNames: ["eslint", "typescript", "vitest"],
    });
  });

  it("detects supported frameworks from dependency manifests", async () => {
    const root = await createProject();
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({
        dependencies: {
          react: "*",
          next: "*",
          vue: "*",
          nuxt: "*",
          "@angular/core": "*",
          svelte: "*",
          express: "*",
          "@nestjs/core": "*",
          "@nestjs/platform-fastify": "*",
        },
      }),
    );
    await writeFile(
      path.join(root, "requirements.txt"),
      "Django>=5\nFlask==3\nfastapi[standard]>=0.1\n",
    );
    await writeFile(
      path.join(root, "composer.json"),
      JSON.stringify({ require: { "laravel/framework": "^12" } }),
    );
    await writeFile(
      path.join(root, "pom.xml"),
      "<dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter</artifactId></dependency>",
    );

    const result = await analyzeProject(root);

    expect(result.frameworks).toEqual([
      "Angular",
      "Django",
      "Express",
      "FastAPI",
      "Fastify",
      "Flask",
      "Laravel",
      "NestJS",
      "Next.js",
      "Nuxt",
      "React",
      "Spring Boot",
      "Svelte",
      "Vue",
    ]);
  });

  it("reports multiple frameworks present in one project", async () => {
    const root = await createProject();
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ dependencies: { next: "*", express: "*" } }),
    );

    const result = await analyzeProject(root);

    expect(result.frameworks).toEqual(["Express", "Next.js", "React"]);
  });

  it("detects a package manager only when lockfile evidence is unambiguous", async () => {
    const lockfiles = [
      ["package-lock.json", "npm"],
      ["pnpm-lock.yaml", "pnpm"],
      ["yarn.lock", "Yarn"],
      ["bun.lock", "Bun"],
    ];
    for (const [lockfile, expectedManager] of lockfiles) {
      const root = await createProject();
      await writeFile(path.join(root, lockfile), "");
      expect((await analyzeProject(root)).packageManager).toBe(expectedManager);
    }

    const ambiguousProject = await createProject();
    await writeFile(path.join(ambiguousProject, "package-lock.json"), "");
    await writeFile(path.join(ambiguousProject, "yarn.lock"), "");
    expect((await analyzeProject(ambiguousProject)).packageManager).toBe("unknown");
  });

  it("identifies configuration files without reading real environment files", async () => {
    const root = await createProject();
    const fileNames = [
      "tsconfig.json",
      "eslint.config.mjs",
      ".prettierrc.json",
      "Dockerfile.dev",
      "docker-compose.override.yaml",
      ".gitignore",
      ".env.example",
      ".env.sample",
      "package.json",
    ];
    for (const fileName of fileNames) {
      await writeFile(path.join(root, fileName), fileName === ".env.example" ? "EXAMPLE=1" : "{}");
    }
    await writeFile(path.join(root, ".env"), "PRIVATE_VALUE=must-not-be-read-or-reported");

    const result = await analyzeProject(root);

    expect(result.configurationFiles).toEqual(fileNames.slice().sort((left, right) => left.localeCompare(right)));
    expect(result.configurationFiles).not.toContain(".env");
  });

  it("counts code markers by line and skips binary and ignored files", async () => {
    const root = await createProject();
    const sourceDirectory = path.join(root, "src");
    await mkdir(sourceDirectory);
    const terms = {
      note: ["TO", "DO"].join(""),
      repair: ["FIX", "ME"].join(""),
      workaround: ["HA", "CK"].join(""),
    };
    await writeFile(
      path.join(sourceDirectory, "work.ts"),
      `// ${terms.note}: first\nconst value = 1; // ${terms.repair}\n// ${terms.note} and ${terms.workaround}\n`,
    );
    await writeFile(path.join(sourceDirectory, "binary.ts"), Buffer.from(`${terms.note}\u0000`));
    const ignored = path.join(root, "node_modules");
    await mkdir(ignored);
    await writeFile(path.join(ignored, "ignored.ts"), `// ${terms.note}\n`);

    const result = await analyzeProject(root);

    expect(result.markers.total).toBe(4);
    expect(result.markers.counts[terms.note as keyof typeof result.markers.counts]).toBe(2);
    expect(result.markers.counts[terms.repair as keyof typeof result.markers.counts]).toBe(1);
    expect(result.markers.counts[terms.workaround as keyof typeof result.markers.counts]).toBe(1);
    expect(result.markers.locations.map(({ filePath, line }) => [filePath, line])).toEqual([
      ["src/work.ts", 1],
      ["src/work.ts", 2],
      ["src/work.ts", 3],
      ["src/work.ts", 3],
    ]);
  });

  it("handles projects with no package or configuration files", async () => {
    const root = await createProject();

    const result = await analyzeProject(root);

    expect(result.projectName).toBe(path.basename(root));
    expect(result.dependencies.packageJsonStatus).toBe("missing");
    expect(result.dependencies.productionCount).toBe(0);
    expect(result.packageManager).toBe("unknown");
    expect(result.configurationFiles).toEqual([]);
    expect(result.frameworks).toEqual([]);
  });

  it("handles malformed package metadata without failing analysis", async () => {
    const root = await createProject();
    await writeFile(path.join(root, "package.json"), "{ malformed");

    const result = await analyzeProject(root);

    expect(result.dependencies.packageJsonStatus).toBe("invalid");
    expect(result.dependencies.productionCount).toBe(0);
    expect(result.projectName).toBe(path.basename(root));
    expect(result.configurationFiles).toContain("package.json");
  });

  it("does not traverse symlinked source directories", async () => {
    const root = await createProject();
    const outside = await createProject();
    const terms = ["TO", "DO"].join("");
    await writeFile(path.join(outside, "external.ts"), `// ${terms}\n`);
    await symlink(outside, path.join(root, "linked"), "dir");

    const result = await analyzeProject(root);

    expect(result.markers.total).toBe(0);
  });
});
