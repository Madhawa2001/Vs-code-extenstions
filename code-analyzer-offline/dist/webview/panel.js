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
exports.RationalePanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class RationalePanel {
    static show(extensionUri, markdown) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        if (RationalePanel.currentPanel) {
            RationalePanel.currentPanel._panel.reveal(column);
            RationalePanel.currentPanel.update(markdown);
        }
        else {
            const panel = vscode.window.createWebviewPanel("rationale", "Rationale Document", column || vscode.ViewColumn.One, {
                enableScripts: true,
            });
            RationalePanel.currentPanel = new RationalePanel(panel, extensionUri, markdown);
        }
    }
    constructor(panel, extensionUri, markdown) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        // initial HTML
        this._panel.webview.html = this.getHtmlForWebview(markdown);
        // handle messages
        this._panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === "save") {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                const folder = workspaceFolders
                    ? workspaceFolders[0].uri.fsPath
                    : undefined;
                const target = folder
                    ? path.join(folder, "README_Rationale.md")
                    : undefined;
                if (!target) {
                    vscode.window.showErrorMessage("No workspace folder open to save README_Rationale.md");
                    return;
                }
                fs.writeFileSync(target, message.markdown, { encoding: "utf8" });
                vscode.window.showInformationMessage("Saved README_Rationale.md in workspace root");
            }
        });
        this._panel.onDidDispose(() => {
            RationalePanel.currentPanel = undefined;
        });
    }
    update(markdown) {
        this._panel.webview.html = this.getHtmlForWebview(markdown);
    }
    getHtmlForWebview(markdown) {
        const escaped = markdown.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        // simple HTML with copy & save button
        return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Rationale Document</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; padding: 1rem; }
pre { background:#f6f8fa; padding:1rem; overflow:auto; white-space:pre-wrap; }
button { margin-right: 8px; }
</style>
</head>
<body>
  <div>
    <button id="copyBtn">Copy to clipboard</button>
    <button id="saveBtn">Save to workspace as README_Rationale.md</button>
  </div>
  <hr/>
  <pre id="content">${escaped}</pre>

<script>
const vscode = acquireVsCodeApi();
document.getElementById('copyBtn').addEventListener('click', async () => {
  const text = document.getElementById('content').innerText;
  await navigator.clipboard.writeText(text);
  alert('Copied to clipboard');
});
document.getElementById('saveBtn').addEventListener('click', () => {
  const markdown = document.getElementById('content').innerText;
  vscode.postMessage({ command: 'save', markdown });
});
</script>
</body>
</html>`;
    }
}
exports.RationalePanel = RationalePanel;
//# sourceMappingURL=panel.js.map