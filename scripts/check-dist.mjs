// 配布の検査（infrastructure-specification 4章、cicd-pipeline 1章）。
// dist/ の HTML・JavaScript・CSS に、外部への参照がないことと、計測の印（perf:）が残っていないことを確かめる。
// Node.js の標準機能だけを使い、ネットワークは使わない。違反があれば終了コード 1 にする。
// 使い方: node scripts/check-dist.mjs dist
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** 計測の印（performance-design 3章）。本番の成果物には残さない。 */
const PERF_MARK = "perf:";

/** 検査の対象の拡張子。 */
const TEXT_EXTENSIONS = new Set([".html", ".js", ".css"]);

/** 許可リストの場所（1行1件。注釈は「  # 」の後に書く）。 */
export const ALLOWLIST_PATH = fileURLToPath(new URL("./check-dist-allowlist.txt", import.meta.url));

/** 許可リストの行を、判定に使う識別子の一覧にする（空行と注釈だけの行は除く）。 */
export function parseAllowlist(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(/\s+#/)[0].trim())
    .filter((entry) => entry !== "" && !entry.startsWith("#"));
}

/** 許可リストに当たるか（完全一致、または許可した接頭辞で始まる。例: エラー案内の URL）。 */
function isAllowed(found, allowlist) {
  return allowlist.some((entry) => found === entry || found.startsWith(entry));
}

/** 外部の参照の形か（http://、https://、プロトコル相対の //）。 */
function isExternalReference(value) {
  return /^(https?:)?\/\//i.test(value);
}

/**
 * 1ファイルの内容を調べ、違反の一覧（ファイル、行番号、見つかった文字列、理由）を返す。
 * HTML は src・href の属性、CSS は url() と @import、JavaScript は fetch・import・new URL の引数と URL の文字列を調べる。
 */
export function findViolations(file, content, allowlist) {
  const violations = [];
  const extension = extname(file);
  const report = (lineNumber, found, reason) =>
    violations.push({ file, line: lineNumber, found, reason });

  content.split("\n").forEach((line, index) => {
    const lineNumber = index + 1;
    if (line.includes(PERF_MARK)) report(lineNumber, PERF_MARK, "計測の印が残っている");
    if (extension === ".html") {
      for (const match of line.matchAll(/\b(?:src|href)\s*=\s*["']([^"']*)["']/gi)) {
        const value = match[1];
        if (isExternalReference(value) && !isAllowed(value, allowlist)) {
          report(lineNumber, value, "外部への参照（HTML の属性）");
        }
      }
    }
    if (extension === ".css") {
      // @import の行は下の @import の規則で調べる（同じ参照を二度数えない）。
      const isImportLine = /@import/i.test(line);
      for (const match of isImportLine ? [] : line.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
        const value = match[1];
        if (isExternalReference(value) && !isAllowed(value, allowlist)) {
          report(lineNumber, value, "外部への参照（CSS の url）");
        }
      }
      for (const match of line.matchAll(/@import\s+(?:url\(\s*)?["']?([^"'); ]+)/gi)) {
        const value = match[1];
        if (isExternalReference(value) && !isAllowed(value, allowlist)) {
          report(lineNumber, value, "外部への参照（CSS の @import）");
        }
      }
    }
    if (extension === ".js") {
      for (const match of line.matchAll(
        /(fetch|import|new URL)\(\s*["'`]((?:https?:)?\/\/[^"'`]*)/g,
      )) {
        const value = match[2];
        if (!isAllowed(value, allowlist)) report(lineNumber, value, "外部への通信・読み込みの引数");
      }
      for (const match of line.matchAll(/https?:\/\/[^\s"'`<>)\\]+/g)) {
        const value = match[0];
        if (!isAllowed(value, allowlist))
          report(lineNumber, value, "外部の URL（JavaScript の文字列）");
      }
    }
  });
  return violations;
}

/** 配布の中のファイル（相対パス）を、ディレクトリを下って集める。 */
function listFiles(directory, prefix = "") {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    const relativePath = prefix === "" ? name : `${prefix}/${name}`;
    if (statSync(path).isDirectory()) return listFiles(path, relativePath);
    return TEXT_EXTENSIONS.has(extname(name)) ? [relativePath] : [];
  });
}

/** dist/ を検査する。検査したファイルの数と違反の一覧を返す。 */
export function checkDist(directory, allowlist) {
  const files = listFiles(directory);
  const violations = files.flatMap((file) =>
    findViolations(file, readFileSync(join(directory, file), "utf8"), allowlist),
  );
  return { files, violations };
}

function main(argv) {
  const target = resolve(argv[2] ?? "dist");
  const allowlist = parseAllowlist(readFileSync(ALLOWLIST_PATH, "utf8"));
  let result;
  try {
    result = checkDist(target, allowlist);
  } catch (error) {
    // 読めないときは成功にしない（黙って通さない）。
    console.error(
      `dist を読めませんでした: ${target}（${error instanceof Error ? error.message : String(error)}）`,
    );
    return 1;
  }
  if (result.files.length === 0) {
    console.error(`検査の対象のファイルがありません: ${target}`);
    return 1;
  }
  console.log(`検査したファイル: ${result.files.length} 件（許可リスト: ${allowlist.length} 件）`);
  if (result.violations.length > 0) {
    for (const violation of result.violations) {
      console.error(`${violation.file}:${violation.line}: ${violation.reason}: ${violation.found}`);
    }
    console.error(`違反: ${result.violations.length} 件`);
    return 1;
  }
  console.log("違反はありません");
  return 0;
}

const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isEntryPoint) {
  process.exitCode = main(process.argv);
}
