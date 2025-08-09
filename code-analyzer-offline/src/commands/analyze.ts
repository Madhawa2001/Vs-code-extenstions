import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { analyzeJSFile } from "../analyzers/js_analyzer";
import { spawnSync } from "child_process";
import { computeSimpleComplexity } from "../utils/metrics";

type Item = {
  type: string;
  name: string;
  signature?: string;
  doc?: string | null;
  loc: number;
  params: number;
  complexity: number;
  calls: string[];
  snippet?: string;
  sideEffects?: string[];
  file: string;
};

async function analyzePythonFile(filePath: string): Promise<Item[]> {
  const scriptPath = path.join(
    __dirname,
    "..",
    "analyzers",
    "python_analyzer.py"
  );
  const res = spawnSync("python", [scriptPath, filePath], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  if (res.error) {
    throw res.error;
  }
  if (res.status !== 0 && res.stderr) {
    // if python outputs to stderr but returned ok, include it in message
    console.warn("python stderr:", res.stderr);
  }
  const out = res.stdout;
  if (!out) {
    return [];
  }
  try {
    const parsed = JSON.parse(out);
    // compute complexity again or trust python's complexity
    return parsed.items.map((it: any) => ({
      type: it.type,
      name: it.name,
      signature: it.signature,
      doc: it.doc,
      loc: it.loc,
      params: it.params,
      complexity: it.complexity ?? computeSimpleComplexity(it.snippet ?? ""),
      calls: it.calls ?? [],
      snippet: it.snippet,
      sideEffects: it.side_effects ?? [],
      file: filePath,
    }));
  } catch (e) {
    throw new Error("Failed to parse python analyzer output: " + e);
  }
}

export async function generateForActiveFile(): Promise<string> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw new Error("No active editor");
  }

  const doc = editor.document;
  const filePath = doc.uri.fsPath;
  return await analyzeAndRenderFile(filePath);
}

export async function generateForWorkspace(): Promise<string> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    throw new Error("No workspace folder open");
  }
  const root = folders[0].uri.fsPath;
  const files: string[] = [];
  const includeNodeModules = vscode.workspace
    .getConfiguration("rationale")
    .get("includeNodeModules", false);

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (
        !includeNodeModules &&
        (e.name === "node_modules" || e.name === ".git")
      ) {
        continue;
      }
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (/\.(py|js|ts|jsx|tsx)$/.test(e.name)) {
        files.push(full);
      }
    }
  }
  walk(root);

  const allItems: any[] = [];
  for (const f of files) {
    try {
      const items = await analyzeAndReturnItems(f);
      allItems.push(...items);
      console.log(`Analyzed ${f}: found ${items.length} items`);
    } catch (err) {
      console.warn("Failed to analyze", f, err);
    }
  }

  return renderRationaleDocument(allItems);
}

async function analyzeAndReturnItems(filePath: string): Promise<Item[]> {
  if (/\.(py)$/.test(filePath)) {
    return await analyzePythonFile(filePath);
  } else if (/\.(js|ts|jsx|tsx)$/.test(filePath)) {
    const code = fs.readFileSync(filePath, { encoding: "utf8" });
    return analyzeJSFile(code, filePath);
  } else {
    return [];
  }
}

async function analyzeAndRenderFile(filePath: string): Promise<string> {
  const items = await analyzeAndReturnItems(filePath);
  return renderRationaleDocument(items);
}

function renderRationaleDocument(items: Item[]): string {
  // Group by file
  const byFile = new Map<string, Item[]>();
  items.forEach((it) => {
    const arr = byFile.get(it.file) ?? [];
    arr.push(it);
    byFile.set(it.file, arr);
  });

  let md = "";
  for (const [file, its] of byFile.entries()) {
    md += `\n---\n\n# Rationale: ${file}\n\n`;
    for (const it of its) {
      md += `\n## ${it.type}: ${it.name}\n\n`;
      md += `**Signature:** \`${it.signature ?? ""}\`\n\n`;
      md += `**LOC:** ${it.loc}  \n**Params:** ${it.params}  \n**Cyclomatic complexity (approx):** ${it.complexity}\n\n`;
      md += `**Calls:** ${it.calls.length ? it.calls.join(", ") : "none"}\n\n`;
      md += `**Docstring / Comments:** ${
        it.doc ? `\n\n${it.doc}\n\n` : "None"
      }\n\n`;
      md += `**Snippet:**\n\n\`\`\`\n${it.snippet ?? ""}\n\`\`\`\n\n`;

      // Fill the Rationale Document per function as requested
      md += `---\n\n## Rationale Document\n\n### Purpose\nExplain the overall goal of this function/file and the problem it tries to solve.\n\n### Function-by-Function Analysis\n- **${it.name}**: Purpose, details. Complexity: ${it.complexity}. Params: ${it.params}.\n\n### Design Decisions & Trade-offs\nDiscuss design choices visible here.\n\n### Possible Origin Prompt\n"Likely prompt text here"\n\n### Inspiration & References\n- Possible patterns or libs referenced by the code.\n\n### Improvement Suggestions\n- Suggest improvements (readability, security, tests).\n\n\n`;
    }
  }

  // Add single-file summary header if only one file
  if (byFile.size === 1) {
    md = `# Generated Rationale Document\n\n${md}`;
  } else {
    md = `# Generated Rationale Document (workspace)\n\n${md}`;
  }
  return md;
}
