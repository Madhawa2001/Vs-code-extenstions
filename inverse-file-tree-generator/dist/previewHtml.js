"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPreviewHtml = createPreviewHtml;
function escapeHtml(s) {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
function buildList(node, isRoot = false) {
    // build HTML list with checkboxes, recursively
    const children = node.children || [];
    const rows = [];
    for (const c of children) {
        const rel = c.fullPath ?? c.name;
        const id = encodeURIComponent(rel || c.name);
        const label = escapeHtml(c.name + (c.isDirectory ? "/" : ""));
        const contentField = c.content
            ? `<div class="inline-content">Content: <pre>${escapeHtml(c.content)}</pre></div>`
            : "";
        const childHtml = `<li>
      <label><input type="checkbox" data-path="${escapeHtml(rel)}" checked /> ${label}</label>
      ${contentField}
      ${c.children && c.children.length ? `<ul>${buildList(c)}</ul>` : ""}
    </li>`;
        rows.push(childHtml);
    }
    return rows.join("\n");
}
function createPreviewHtml(webview, extensionUri, root) {
    const baseScriptUri = webview.asWebviewUri(extensionUri);
    const listHtml = buildList(root, true);
    const html = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' 'unsafe-eval';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Inverse File Tree Preview</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial; padding:10px; }
      ul { list-style: none; padding-left: 20px; }
      li { margin: 4px 0; }
      .controls { margin: 12px 0; }
      .inline-content pre { background: #f3f3f3; padding: 6px; border-radius: 4px; white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <h2>Preview — uncheck items you do not want to create</h2>
    <div>
      <ul>
        ${listHtml}
      </ul>
    </div>
    <div class="controls">
      <button id="generate">Generate Selected</button>
      <button id="cancel">Cancel</button>
    </div>
    <script>
      const vscode = acquireVsCodeApi();
      document.getElementById('generate').addEventListener('click', () => {
        const checks = Array.from(document.querySelectorAll('input[type=checkbox]'));
        const selected = [];
        const isDirMap = {};
        const contentMap = {};
        for (const c of checks) {
          if (c.checked) {
            const p = c.getAttribute('data-path');
            selected.push(p);
            // directory heuristic: trailing slash present in label? but we did not preserve slash inside data-path,
            // parent nodes that have children are directories: find nearest ancestor ul
            const li = c.closest('li');
            const hasChildren = li && li.querySelector('ul');
            isDirMap[p] = !!hasChildren;
            const pre = li && li.querySelector('pre');
            if (pre) contentMap[p] = pre.innerText;
          }
        }
        vscode.postMessage({ command: 'generate', selected, isDirMap, contentMap });
      });
      document.getElementById('cancel').addEventListener('click', () => {
        vscode.postMessage({ command: 'cancel' });
      });
    </script>
  </body>
  </html>`;
    return html;
}
//# sourceMappingURL=previewHtml.js.map