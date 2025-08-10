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
const js_analyzer_1 = require("../analyzers/js_analyzer");
const child_process_1 = require("child_process");
const metrics_1 = require("../utils/metrics");
async function analyzePythonFile(filePath) {
    const scriptPath = path.join(__dirname, "..", "analyzers", "python_analyzer.py");
    const res = (0, child_process_1.spawnSync)("python", [scriptPath, filePath], {
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
        return parsed.items.map((it) => ({
            type: it.type,
            name: it.name,
            signature: it.signature,
            doc: it.doc,
            loc: it.loc,
            params: it.params,
            complexity: it.complexity ?? (0, metrics_1.computeSimpleComplexity)(it.snippet ?? ""),
            calls: it.calls ?? [],
            snippet: it.snippet,
            sideEffects: it.side_effects ?? [],
            file: filePath,
        }));
    }
    catch (e) {
        throw new Error("Failed to parse python analyzer output: " + e);
    }
}
async function generateForActiveFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        throw new Error("No active editor");
    }
    const doc = editor.document;
    const filePath = doc.uri.fsPath;
    return await analyzeAndRenderFile(filePath);
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
            else if (/\.(py|js|ts|jsx|tsx)$/.test(e.name)) {
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
            console.log(`Analyzed ${f}: found ${items.length} items`);
        }
        catch (err) {
            console.warn("Failed to analyze", f, err);
        }
    }
    return renderRationaleDocument(allItems);
}
async function analyzeAndReturnItems(filePath) {
    if (/\.(py)$/.test(filePath)) {
        return await analyzePythonFile(filePath);
    }
    else if (/\.(js|ts|jsx|tsx)$/.test(filePath)) {
        const code = fs.readFileSync(filePath, { encoding: "utf8" });
        return (0, js_analyzer_1.analyzeJSFile)(code, filePath);
    }
    else {
        return [];
    }
}
async function analyzeAndRenderFile(filePath) {
    const items = await analyzeAndReturnItems(filePath);
    return renderRationaleDocument(items);
}
function renderRationaleDocument(items) {
    // Group by file
    const byFile = new Map();
    items.forEach((it) => {
        const arr = byFile.get(it.file) ?? [];
        arr.push(it);
        byFile.set(it.file, arr);
    });
    let md = "";
    for (const [file, its] of byFile.entries()) {
        md += `\n---\n\n# 📄 Rationale Document: \`${file}\`\n\n`;
        for (const it of its) {
            md += `## 🔹 ${it.type.charAt(0).toUpperCase() + it.type.slice(1)}: **${it.name}**\n\n`;
            md += `| Attribute | Details |\n`;
            md += `| --------- | ------- |\n`;
            md += `| **Signature** | \`${it.signature ?? "N/A"}\` |\n`;
            md += `| **Lines of Code (LOC)** | ${it.loc} |\n`;
            md += `| **Parameters** | ${it.params} |\n`;
            md += `| **Cyclomatic Complexity (approx.)** | ${it.complexity} |\n`;
            md += `| **Function Calls** | ${it.calls.length ? it.calls.join(", ") : "None"} |\n`;
            md += `| **Docstring / Comments** | ${it.doc ? it.doc.replace(/\n/g, " ") : "None"} |\n\n`;
            md += `<details>\n<summary>📝 Rationale Document</summary>\n\n`;
            md += `### Purpose\n`;
            md += `Explain the overall goal of this function/file and the problem it tries to solve.\n\n`;
            md += `### Function-by-Function Analysis\n`;
            md += `- **${it.name}**: Purpose, details. Complexity: ${it.complexity}. Params: ${it.params}.\n\n`;
            md += `### Design Decisions & Trade-offs\n`;
            md += `Discuss design choices visible here, pros and cons.\n\n`;
            md += `### Possible Origin Prompt\n`;
            md += `> "Likely prompt text here"\n\n`;
            md += `### Inspiration & References\n`;
            md += `- Possible design patterns, libraries, or concepts referenced.\n\n`;
            md += `### Improvement Suggestions\n`;
            md += `- Suggestions for improvements (readability, security, testing, etc).\n\n`;
            md += `<!-- Example diagram placeholder -->\n`;
            md += `![Design Diagram](https://via.placeholder.com/600x150?text=Design+Diagram)\n`;
            md += `</details>\n\n`;
        }
    }
    if (byFile.size === 1) {
        md = `# 🧾 Generated Rationale Document\n\n${md}`;
    }
    else {
        md = `# 🧾 Generated Rationale Document (Workspace)\n\n${md}`;
    }
    return md;
}
//# sourceMappingURL=analyze.js.map