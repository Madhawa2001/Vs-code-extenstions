"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateForActiveFile = generateForActiveFile;
exports.generateForWorkspace = generateForWorkspace;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const tree_analyzer_1 = require("../analyzers/tree_analyzer");
const child_process_1 = require("child_process");
const formatter_1 = require("../utils/formatter");
const ai_client_1 = require("../ai/ai_client");
async function analyzePythonFileFallback(filePath) {
    const scriptPath = path.join(__dirname, "..", "analyzers", "python_analyzer.py");
    const res = (0, child_process_1.spawnSync)("python", [scriptPath, filePath], {
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
        return parsed.items.map((it) => ({
            ...it,
            file: filePath,
        }));
    }
    catch (e) {
        console.warn("Failed to parse python analyzer output", e);
        return [];
    }
}
async function analyzeAndReturnItems(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    try {
        const items = (0, tree_analyzer_1.analyzeFileWithTreeSitter)(filePath);
        if (items && items.length) {
            return items;
        }
        // fallback for py/js if tree-sitter failed
        if (ext === ".py") {
            return await analyzePythonFileFallback(filePath);
        }
        // for JS/TS fallback could be added
        return [];
    }
    catch (err) {
        console.warn("Analysis error, fallback if possible", err);
        if (ext === ".py") {
            return await analyzePythonFileFallback(filePath);
        }
        return [];
    }
}
async function generateForActiveFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        throw new Error("No active editor");
    }
    const doc = editor.document;
    const filePath = doc.uri.fsPath;
    const items = await analyzeAndReturnItems(filePath);
    return await finalizeDocument(items);
}
async function generateForWorkspace() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        throw new Error("No workspace folder open");
    }
    const root = folders[0].uri.fsPath;
    const files = [];
    const includeNodeModules = vscode.workspace
        .getConfiguration("rationale")
        .get("includeNodeModules", false);
    function walk(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
            if (!includeNodeModules &&
                (e.name === "node_modules" || e.name === ".git")) {
                continue;
            }
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
                walk(full);
            }
            else if (/\.(py|js|ts|jsx|tsx|java|cs)$/.test(e.name)) {
                files.push(full);
            }
        }
    }
    walk(root);
    const allItems = [];
    for (const f of files) {
        try {
            const items = await analyzeAndReturnItems(f);
            allItems.push(...items);
        }
        catch (err) {
            console.warn("Failed to analyze", f, err);
        }
    }
    return await finalizeDocument(allItems);
}
async function finalizeDocument(items) {
    // generate offline skeleton markdown
    const offlineMd = (0, formatter_1.formatRationaleFromItems)(items);
    // if AI is enabled, call AI to produce richer doc
    const aiEnabled = vscode.workspace
        .getConfiguration("rationale")
        .get("aiEnabled", false);
    if (aiEnabled) {
        const apiKey = vscode.workspace
            .getConfiguration("rationale")
            .get("geminiApiKey", "");
        if (!apiKey || (typeof apiKey === "string" && apiKey.length === 0)) {
            vscode.window.showWarningMessage("Rationale: AI Mode enabled but no OpenAI API key configured (rationale.openaiApiKey). Falling back to offline output.");
            return offlineMd;
        }
        try {
            const aiMd = await (0, ai_client_1.callAiForDocument)(items, apiKey);
            return aiMd;
        }
        catch (err) {
            console.warn("AI call failed, returning offline output", err);
            return offlineMd;
        }
    }
    else {
        return offlineMd;
    }
}
//# sourceMappingURL=analyze.js.map