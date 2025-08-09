import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export class RationalePanel {
  public static currentPanel: RationalePanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;

  public static show(extensionUri: vscode.Uri, markdown: string) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;
    if (RationalePanel.currentPanel) {
      RationalePanel.currentPanel._panel.reveal(column);
      RationalePanel.currentPanel.update(markdown);
    } else {
      const panel = vscode.window.createWebviewPanel(
        "rationale",
        "Rationale Document",
        column || vscode.ViewColumn.One,
        {
          enableScripts: true,
        }
      );
      RationalePanel.currentPanel = new RationalePanel(
        panel,
        extensionUri,
        markdown
      );
    }
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    markdown: string
  ) {
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
          vscode.window.showErrorMessage(
            "No workspace folder open to save README_Rationale.md"
          );
          return;
        }
        fs.writeFileSync(target, message.markdown, { encoding: "utf8" });
        vscode.window.showInformationMessage(
          "Saved README_Rationale.md in workspace root"
        );
      }
    });

    this._panel.onDidDispose(() => {
      RationalePanel.currentPanel = undefined;
    });
  }

  public update(markdown: string) {
    this._panel.webview.html = this.getHtmlForWebview(markdown);
  }

  private getHtmlForWebview(markdown: string) {
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
