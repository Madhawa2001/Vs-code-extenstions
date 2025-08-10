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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const parser_1 = require("./parser");
const previewHtml_1 = require("./previewHtml");
const path = __importStar(require("path"));
function activate(context) {
    const output = vscode.window.createOutputChannel("Inverse File Tree");
    async function runWithText(text) {
        if (!text) {
            vscode.window.showWarningMessage("No text provided.");
            return;
        }
        // strip markdown code fences if present
        text = text.replace(/^\s*```[\s\S]*?```/gm, (m) => {
            // keep content inside fences: we will remove fences but preserve inner content
            const inner = m.replace(/^```.*\n?/, "").replace(/\n?```$/, "");
            return inner;
        });
        let root;
        try {
            root = (0, parser_1.parseFileTreeText)(text);
        }
        catch (e) {
            vscode.window.showErrorMessage("Failed to parse file tree: " + (e?.message ?? e));
            return;
        }
        if (!root) {
            vscode.window.showErrorMessage("No nodes found in the selection.");
            return;
        }
        // create webview preview
        const panel = vscode.window.createWebviewPanel("inverseFileTreePreview", "Inverse File Tree Preview", vscode.ViewColumn.One, {
            enableScripts: true,
        });
        panel.webview.html = (0, previewHtml_1.createPreviewHtml)(panel.webview, context.extensionUri, root);
        // receive message from webview
        panel.webview.onDidReceiveMessage(async (msg) => {
            if (msg.command === "generate") {
                const selectedPaths = msg.selected; // list of full paths (relative)
                const workspaceFolder = getBaseDirectory();
                for (const relPath of selectedPaths) {
                    const absUri = vscode.Uri.joinPath(workspaceFolder, relPath);
                    const isDir = msg.isDirMap && msg.isDirMap[relPath];
                    try {
                        if (isDir) {
                            await vscode.workspace.fs.createDirectory(absUri);
                            output.appendLine(`Created folder: ${relPath}`);
                        }
                        else {
                            // ensure directory exists
                            const dir = path.posix.dirname(relPath);
                            if (dir && dir !== ".") {
                                await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(workspaceFolder, dir));
                            }
                            // check exists
                            let exists = true;
                            try {
                                await vscode.workspace.fs.stat(absUri);
                            }
                            catch (e) {
                                exists = false;
                            }
                            const policy = vscode.workspace
                                .getConfiguration()
                                .get("inverseFileTree.overwritePolicy", "skip");
                            if (exists && policy === "skip") {
                                output.appendLine(`Skipped existing file: ${relPath}`);
                                continue;
                            }
                            else if (exists && policy === "prompt") {
                                const pick = await vscode.window.showQuickPick(["Overwrite", "Skip"], { placeHolder: `File exists: ${relPath}` });
                                if (pick !== "Overwrite") {
                                    output.appendLine(`Skipped existing file: ${relPath}`);
                                    continue;
                                }
                            }
                            // get inline content from msg.contentMap if provided
                            const content = msg.contentMap && msg.contentMap[relPath]
                                ? msg.contentMap[relPath]
                                : "";
                            await vscode.workspace.fs.writeFile(absUri, Buffer.from(content, "utf8"));
                            output.appendLine(`${exists ? "Overwritten" : "Created"} file: ${relPath}`);
                        }
                    }
                    catch (err) {
                        output.appendLine(`Error creating ${relPath}: ${err?.message ?? err}`);
                    }
                }
                vscode.window.showInformationMessage("Generation complete. See Output → Inverse File Tree for details.");
                panel.dispose();
                output.show(true);
            }
        }, undefined, context.subscriptions);
    }
    function getBaseDirectory() {
        const rawBase = vscode.workspace
            .getConfiguration()
            .get("inverseFileTree.baseDirectory", "${workspaceFolder}");
        let resolved = rawBase;
        if (resolved === "${workspaceFolder}") {
            const folders = vscode.workspace.workspaceFolders;
            if (!folders || folders.length === 0) {
                throw new Error("No workspace folder open. Open a folder before generating files.");
            }
            return folders[0].uri;
        }
        else {
            // expand simple ${workspaceFolder}
            if (resolved.includes("${workspaceFolder}")) {
                const folders = vscode.workspace.workspaceFolders;
                if (!folders || folders.length === 0) {
                    throw new Error("No workspace folder open. Open a folder before generating files.");
                }
                resolved = resolved.replace("${workspaceFolder}", folders[0].uri.fsPath);
            }
            return vscode.Uri.file(resolved);
        }
    }
    // command: generate from an input box (paste)
    context.subscriptions.push(vscode.commands.registerCommand("inverseFileTree.generate", async () => {
        const text = await vscode.window.showInputBox({
            prompt: "Paste the file tree text (supports tree symbols and indentation).",
            placeHolder: "my-project/\n├── src/\n│   └── index.js",
        });
        await runWithText(text);
    }));
    // command: generate from current selection
    context.subscriptions.push(vscode.commands.registerCommand("inverseFileTree.generateFromEditor", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("Open a file and select the file tree text first.");
            return;
        }
        const sel = editor.selection;
        let text = editor.document.getText(sel);
        if (!text || !text.trim()) {
            // fallback: whole document
            text = editor.document.getText();
        }
        await runWithText(text);
    }));
}
function deactivate() { }
//# sourceMappingURL=extension.js.map