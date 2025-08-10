import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { analyzeFileWithTreeSitter } from "../analyzers/tree_analyzer";
import { spawnSync } from "child_process";
import { formatRationaleFromItems } from "../utils/formatter";
import { callAiForDocument } from "../ai/ai_client";

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
  file?: string;
};

async function analyzePythonFileFallback(filePath: string): Promise<Item[]> {
  const scriptPath = path.join(
    __dirname,
    "..",
    "analyzers",
    "python_analyzer.py"
  );
  const res = spawnSync("python", [scriptPath, filePath], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (res.error) {
    throw res.error;
  }
  if (!res.stdout) {
    return [];
  }
  try {
    const parsed = JSON.parse(res.stdout);
    return parsed.items.map((it: any) => ({
      ...it,
      file: filePath,
    }));
  } catch (e) {
    console.warn("Failed to parse python analyzer output", e);
    return [];
  }
}

async function analyzeAndReturnItems(filePath: string): Promise<Item[]> {
  const ext = path.extname(filePath).toLowerCase();
  try {
    const items = analyzeFileWithTreeSitter(filePath);
    if (items && items.length) {
      return items;
    }
    // fallback for py/js if tree-sitter failed
    if (ext === ".py") {
      return await analyzePythonFileFallback(filePath);
    }
    // for JS/TS fallback could be added
    return [];
  } catch (err) {
    console.warn("Analysis error, fallback if possible", err);
    if (ext === ".py") {
      return await analyzePythonFileFallback(filePath);
    }
    return [];
  }
}

export async function generateForActiveFile(): Promise<string> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw new Error("No active editor");
  }

  const doc = editor.document;
  const filePath = doc.uri.fsPath;
  const items = await analyzeAndReturnItems(filePath);
  return await finalizeDocument(items);
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
      } else if (/\.(py|js|ts|jsx|tsx|java|cs)$/.test(e.name)) {
        files.push(full);
      }
    }
  }
  walk(root);

  const allItems: Item[] = [];
  for (const f of files) {
    try {
      const items = await analyzeAndReturnItems(f);
      allItems.push(...items);
    } catch (err) {
      console.warn("Failed to analyze", f, err);
    }
  }

  return await finalizeDocument(allItems);
}

async function finalizeDocument(items: Item[]): Promise<string> {
  // generate offline skeleton markdown
  const offlineMd = formatRationaleFromItems(items);

  // if AI is enabled, call AI to produce richer doc
  const aiEnabled = vscode.workspace
    .getConfiguration("rationale")
    .get("aiEnabled", false);
  if (aiEnabled) {
    const apiKey = vscode.workspace
      .getConfiguration("rationale")
      .get<string>("geminiApiKey", "");
    if (!apiKey || (typeof apiKey === "string" && apiKey.length === 0)) {
      vscode.window.showWarningMessage(
        "Rationale: AI Mode enabled but no OpenAI API key configured (rationale.openaiApiKey). Falling back to offline output."
      );
      return offlineMd;
    }
    try {
      const aiMd = await callAiForDocument(items, apiKey as string);
      return aiMd;
    } catch (err) {
      console.warn("AI call failed, returning offline output", err);
      return offlineMd;
    }
  } else {
    return offlineMd;
  }
}
