import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import type { MarkerAnalysis, MarkerKind, MarkerLocation } from "./types.js";

const MARKER_NAMES = ["TO" + "DO", "FIX" + "ME", "HA" + "CK"] as const;
const SOURCE_EXTENSIONS = new Set([
  ".c", ".cc", ".cpp", ".cs", ".css", ".go", ".h", ".hpp", ".html", ".java",
  ".js", ".jsx", ".kt", ".php", ".py", ".rb", ".rs", ".scala", ".sh", ".swift",
  ".ts", ".tsx", ".vue",
]);
async function markersInFile(filePath: string, rootPath: string): Promise<MarkerLocation[]> {
  const input = createReadStream(filePath, { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });
  const locations: MarkerLocation[] = [];
  const relativePath = path.relative(rootPath, filePath).split(path.sep).join("/");
  let lineNumber = 0;
  let containsBinaryData = false;

  try {
    for await (const line of lines) {
      lineNumber += 1;
      if (line.includes("\u0000")) {
        containsBinaryData = true;
        break;
      }

      const pattern = new RegExp(`\\b(${MARKER_NAMES.join("|")})\\b`, "gi");
      for (const match of line.matchAll(pattern)) {
        locations.push({
          filePath: relativePath,
          line: lineNumber,
          marker: match[1].toUpperCase() as MarkerKind,
        });
      }
    }
  } catch {
    return [];
  } finally {
    lines.close();
  }

  return containsBinaryData ? [] : locations;
}

export async function analyzeMarkers(rootPath: string, projectFiles: string[]): Promise<MarkerAnalysis> {
  const locations: MarkerLocation[] = [];
  const sourceFiles = projectFiles
    .filter((filePath) => SOURCE_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
    .map((filePath) => path.join(rootPath, ...filePath.split("/")));

  for (const sourceFile of sourceFiles) {
    locations.push(...await markersInFile(sourceFile, rootPath));
  }

  locations.sort((left, right) =>
    left.filePath.localeCompare(right.filePath) ||
    left.line - right.line ||
    left.marker.localeCompare(right.marker),
  );

  const counts = Object.fromEntries(
    MARKER_NAMES.map((marker) => [marker, 0]),
  ) as Record<MarkerKind, number>;
  for (const location of locations) counts[location.marker] += 1;

  return {
    total: locations.length,
    counts,
    locations,
  };
}
