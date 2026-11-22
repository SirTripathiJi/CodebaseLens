import type { ProjectReportPayload } from "./report.js";

function esc(value: unknown): string {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function list(items: string[], empty = "None detected."): string {
  return items.length ? `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : `<p class="muted">${esc(empty)}</p>`;
}

function table(headers: string[], rows: string[][]): string {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}" class="muted">No data detected.</td></tr>`}</tbody></table></div>`;
}

export function renderHtmlReport(payload: ProjectReportPayload): string {
  const { project } = payload;
  const maxLanguageCount = Math.max(1, ...Object.values(project.filesByLanguage));
  const languageRows = Object.entries(project.filesByLanguage).sort(([a], [b]) => a.localeCompare(b));
  const languageChart = languageRows.length ? `<div class="bars" role="img" aria-label="File counts by language">${languageRows.map(([name, count]) => `<div class="bar-row"><span>${esc(name)}</span><div class="bar-track"><i style="width:${Math.round((count / maxLanguageCount) * 100)}%"></i></div><b>${count}</b></div>`).join("")}</div>` : `<p class="muted">No files were found.</p>`;
  const debtRows = project.technicalDebt.groups.flatMap((group) => group.findings.map((finding) => [esc(group.category), `<span class="badge ${esc(finding.severity)}">${esc(finding.severity)}</span>`, esc(finding.title), esc(finding.evidence), esc(finding.recommendation)]));
  const readmeSection = project.readme.status === "read"
    ? `<p>${esc(project.readme.description ?? "No introductory description was identified.")}</p><p class="muted">Technologies mentioned: ${esc(project.readme.technologyMentions.join(", ") || "none identified")}</p>${list(project.readme.headings.map((heading) => `${"#".repeat(heading.level)} ${heading.text}`), "No headings found.")}`
    : `<p class="muted">Root README ${esc(project.readme.status)}.</p>`;
  const gitSummary = project.git.available
    ? `<dl><dt>Branch</dt><dd>${esc(project.git.branch ?? "detached HEAD")}</dd><dt>Working tree</dt><dd>${esc(project.git.workingTree)}</dd><dt>Changes</dt><dd>${project.git.modifiedFiles} modified · ${project.git.addedFiles} added · ${project.git.deletedFiles} deleted · ${project.git.untrackedFiles} untracked</dd><dt>Latest commit</dt><dd>${project.git.latestCommit ? `${esc(project.git.latestCommit.hash)} · ${esc(project.git.latestCommit.date)} · ${esc(project.git.latestCommit.subject)}` : "Unavailable"}</dd></dl>`
    : `<p class="muted">${esc(project.git.error ?? "Git information unavailable.")}</p>`;
  const score = Math.min(100, Math.max(0, project.health.score));
  const scripts = project.scripts.scripts.map((script) => [esc(script.name), `<code>${esc(script.command)}</code>`]);
  const dependencies = [
    ["Production", project.dependencies.productionCount, project.dependencies.productionNames],
    ["Development", project.dependencies.developmentCount, project.dependencies.developmentNames],
  ].map(([kind, count, names]) => [esc(kind), String(count), esc((names as string[]).join(", ") || "none")]);
  const importRows = [
    ...project.imports.unresolvedLocalImports.map((item) => ["Unresolved", esc(item.importer), esc(item.specifier), "—"]),
    ...project.imports.resolvedLocalImports.slice(0, 30).map((item) => ["Resolved", esc(item.importer), esc(item.specifier), esc(item.resolvedPath)]),
  ];
  const configRows = project.configurationChecks.map((item) => [esc(item.fileName), `<span class="badge ${esc(item.status)}">${esc(item.status)}</span>`, esc(item.reason), esc(item.recommendation)]);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>CodebaseLens report — ${esc(project.projectName)}</title>
<style>
:root{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#19242e;background:#f4f7f9;font-synthesis:none;text-rendering:optimizeLegibility}*{box-sizing:border-box}body{margin:0;line-height:1.55}header{background:#102a43;color:white;padding:36px max(22px,calc((100vw - 1120px)/2));}header p{color:#c6d7e5;margin:6px 0 0}.wrap{max-width:1120px;margin:26px auto;padding:0 20px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}.card{background:white;border:1px solid #e2e9ee;border-radius:12px;padding:20px;margin:16px 0;box-shadow:0 3px 12px #102a4308}.card h2{font-size:1.12rem;margin:0 0 14px;color:#102a43}.score-card{display:flex;align-items:center;gap:20px}.score{width:96px;height:96px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#14866d calc(var(--score)*1%),#e8eff2 0);position:relative;flex:none}.score:before{content:"";position:absolute;inset:8px;background:white;border-radius:50%}.score strong{position:relative;font-size:1.45rem}.muted{color:#657785}.bars{display:grid;gap:8px}.bar-row{display:grid;grid-template-columns:minmax(90px,150px) 1fr 34px;gap:10px;align-items:center;font-size:.9rem}.bar-track{height:10px;background:#eaf0f3;border-radius:10px;overflow:hidden}.bar-track i{display:block;height:100%;background:#20a387;border-radius:10px}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:.9rem}th,td{text-align:left;vertical-align:top;padding:9px 10px;border-bottom:1px solid #e8eef1}th{color:#536675;background:#f7fafb;font-weight:600}td code,code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.86em;overflow-wrap:anywhere}pre{white-space:pre;overflow:auto;background:#f6f9fa;padding:14px;border-radius:8px;font-size:.85rem}ul{padding-left:22px}li{margin:4px 0}.badge{display:inline-block;border-radius:99px;padding:2px 9px;font-size:.78rem;background:#eaf0f3}.badge.critical{background:#ffe2df;color:#8b241a}.badge.warning{background:#fff0cf;color:#765000}.badge.info{background:#e4efff;color:#17497a}.badge.missing{background:#fff0cf}.badge.present{background:#dff4ec;color:#176247}.badge.not-relevant{background:#eef1f3;color:#687782}dl{display:grid;grid-template-columns:140px 1fr;gap:8px}dt{color:#657785}dd{margin:0;overflow-wrap:anywhere}.small{font-size:.86rem}footer{color:#71808a;text-align:center;padding:18px}@media(max-width:600px){header{padding:26px 20px}.wrap{margin:16px auto;padding:0 12px}.card{padding:15px}dl{grid-template-columns:1fr;gap:2px}dd{margin-bottom:8px}}
</style></head><body>
<header><h1>CodebaseLens report: ${esc(project.projectName)}</h1><p>${esc(project.rootPath)} · scanned ${esc(payload.scanDate)}</p></header>
<main class="wrap">
<div class="grid"><section class="card score-card"><div class="score" style="--score:${score}"><strong>${score}</strong></div><div><h2>Project health</h2><p>${score}/100 · methodology ${esc(project.health.methodologyVersion)}</p><p class="muted">${project.totalFiles} files · ${project.totalDirectories} directories</p></div></section><section class="card"><h2>Project overview</h2><p>Package manager: <strong>${esc(project.packageManager)}</strong></p><p>Frameworks: ${esc(project.frameworks.join(", ") || "none detected")}</p><p>README: ${esc(project.readme.status)}</p></section></div>
<section class="card"><h2>Language statistics</h2>${languageChart}${table(["Language", "Files"], languageRows.map(([name, count]) => [esc(name), String(count)]))}</section>
<div class="grid"><section class="card"><h2>Frameworks and dependencies</h2><p><strong>Frameworks:</strong> ${esc(project.frameworks.join(", ") || "none detected")}</p>${table(["Type", "Count", "Names"], dependencies)}<p class="small"><strong>Referenced production:</strong> ${esc(project.dependencyOverview.referencedProduction.join(", ") || "none detected")}</p><p class="small"><strong>Referenced development:</strong> ${esc(project.dependencyOverview.referencedDevelopment.join(", ") || "none detected")}</p><p class="small"><strong>Possible unused candidates:</strong> ${esc([...project.dependencyOverview.unusedProductionCandidates, ...project.dependencyOverview.unusedDevelopmentCandidates].join(", ") || "none detected; candidates are not confirmed unused")}</p></section><section class="card"><h2>README summary</h2>${readmeSection}</section></div>
<section class="card"><h2>Project scripts</h2><p class="muted">Scripts are listed only; CodebaseLens never executes them.</p>${project.scripts.status !== "valid" ? `<p class="muted">package.json ${esc(project.scripts.status)}.</p>` : table(["Script", "Configured command"], scripts)}</section>
<section class="card"><h2>Code statistics</h2><p>${project.codeStatistics.files} supported text/source files · ${project.codeStatistics.totalLines} lines · ${project.codeStatistics.blankLines} blank · ${project.codeStatistics.nonEmptyLines} non-empty (not necessarily executable code)</p>${table(["Extension", "Files", "Lines", "Blank", "Non-empty"], Object.entries(project.codeStatistics.byExtension).map(([ext, stats]) => [esc(ext), String(stats.files), String(stats.totalLines), String(stats.blankLines), String(stats.nonEmptyLines)]))}</section>
<section class="card"><h2>Test intelligence</h2><p>${project.tests.fileCount} test files · ${esc(project.tests.frameworkStatus)}</p><p>Frameworks: ${esc(project.tests.frameworks.join(", ") || "none detected")}</p><p>Test scripts: ${esc(project.tests.testScripts.map((item) => item.name).join(", ") || "none detected")}</p></section>
<section class="card"><h2>Configuration checks</h2>${table(["File", "Status", "Why it matters", "Recommendation"], configRows)}</section>
<section class="card"><h2>Folder structure</h2><pre>${esc(project.folderTree.lines.join("\n"))}</pre>${project.folderTree.truncated ? `<p class="muted">Tree truncated at depth ${project.folderTree.maxDepth} or ${project.folderTree.maxEntries} entries.</p>` : ""}</section>
<div class="grid"><section class="card"><h2>Empty files and directories</h2><p>Zero-byte files (${project.emptyFilesAndDirectories.files.length})</p>${list(project.emptyFilesAndDirectories.files)}<p>Empty directories (${project.emptyFilesAndDirectories.directories.length})</p>${list(project.emptyFilesAndDirectories.directories)}</section><section class="card"><h2>Git information</h2>${gitSummary}</section></div>
<section class="card"><h2>Import analysis</h2><p>${project.imports.analyzedFiles} JS/TS files analyzed · ${project.imports.localImportCount} relative imports · ${project.imports.aliasImportsDetected} alias imports · ${project.imports.dynamicImportsDetected} literal dynamic imports · ${project.imports.computedDynamicImportsDetected} computed dynamic imports</p>${table(["Status", "Importer", "Specifier", "Resolved path"], importRows)}<h3>Frequently imported local modules</h3>${table(["Module", "Import count"], project.imports.frequentlyImported.map((item) => [esc(item.path), String(item.count)]))}<h3>Analysis limitations</h3>${list(project.imports.limitations)}</section>
<section class="card"><h2>Technical debt summary</h2><p>${project.technicalDebt.counts.critical} critical · ${project.technicalDebt.counts.warning} warnings · ${project.technicalDebt.counts.info} informational</p>${table(["Category", "Severity", "Finding", "Evidence", "Recommendation"], debtRows)}</section>
<section class="card"><h2>Recommendations</h2>${list([...project.technicalDebt.findings.map((finding) => finding.recommendation), ...project.insights.map((insight) => insight.recommendation)].filter((item, index, all) => all.indexOf(item) === index))}</section>
</main><footer>Generated by CodebaseLens · Rule-based, local project analysis</footer></body></html>\n`;
}
