import * as vscode from "vscode";
import { parseFileTreeText, FileNode } from "./parser";
import { createPreviewHtml } from "./previewHtml";
import * as path from "path";

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel("Inverse File Tree");

  async function runWithText(text: string | undefined) {
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

    let root: FileNode | null;
    try {
      root = parseFileTreeText(text);
    } catch (e: any) {
      vscode.window.showErrorMessage(
        "Failed to parse file tree: " + (e?.message ?? e)
      );
      return;
    }
    if (!root) {
      vscode.window.showErrorMessage("No nodes found in the selection.");
      return;
    }

    // create webview preview
    const panel = vscode.window.createWebviewPanel(
      "inverseFileTreePreview",
      "Inverse File Tree Preview",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
      }
    );

    panel.webview.html = createPreviewHtml(
      panel.webview,
      context.extensionUri,
      root
    );

    // receive message from webview
    panel.webview.onDidReceiveMessage(
      async (msg) => {
        if (msg.command === "generate") {
          const selectedPaths: string[] = msg.selected; // list of full paths (relative)
          const workspaceFolder = getBaseDirectory();

          for (const relPath of selectedPaths) {
            const absUri = vscode.Uri.joinPath(workspaceFolder, relPath);
            const isDir = msg.isDirMap && msg.isDirMap[relPath];

            try {
              if (isDir) {
                await vscode.workspace.fs.createDirectory(absUri);
                output.appendLine(`Created folder: ${relPath}`);
              } else {
                // ensure directory exists
                const dir = path.posix.dirname(relPath);
                if (dir && dir !== ".") {
                  await vscode.workspace.fs.createDirectory(
                    vscode.Uri.joinPath(workspaceFolder, dir)
                  );
                }

                // check exists
                let exists = true;
                try {
                  await vscode.workspace.fs.stat(absUri);
                } catch (e) {
                  exists = false;
                }
                type OverwritePolicy = "skip" | "prompt" | "overwrite";
                const policy = vscode.workspace
                  .getConfiguration()
                  .get<OverwritePolicy>(
                    "inverseFileTree.overwritePolicy",
                    "skip"
                  );
                if (exists && policy === "skip") {
                  output.appendLine(`Skipped existing file: ${relPath}`);
                  continue;
                } else if (exists && policy === "prompt") {
                  const pick = await vscode.window.showQuickPick(
                    ["Overwrite", "Skip"],
                    { placeHolder: `File exists: ${relPath}` }
                  );
                  if (pick !== "Overwrite") {
                    output.appendLine(`Skipped existing file: ${relPath}`);
                    continue;
                  }
                }

                // get inline content from msg.contentMap if provided
                const content =
                  msg.contentMap && msg.contentMap[relPath]
                    ? msg.contentMap[relPath]
                    : "";
                await vscode.workspace.fs.writeFile(
                  absUri,
                  Buffer.from(content, "utf8")
                );
                output.appendLine(
                  `${exists ? "Overwritten" : "Created"} file: ${relPath}`
                );
              }
            } catch (err: any) {
              output.appendLine(
                `Error creating ${relPath}: ${err?.message ?? err}`
              );
            }
          }

          vscode.window.showInformationMessage(
            "Generation complete. See Output → Inverse File Tree for details."
          );
          panel.dispose();
          output.show(true);
        }
      },
      undefined,
      context.subscriptions
    );
  }

  function getBaseDirectory(): vscode.Uri {
    const rawBase = vscode.workspace
      .getConfiguration()
      .get("inverseFileTree.baseDirectory", "${workspaceFolder}");
    let resolved = rawBase as string;
    if (resolved === "${workspaceFolder}") {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders || folders.length === 0) {
        throw new Error(
          "No workspace folder open. Open a folder before generating files."
        );
      }
      return folders[0].uri;
    } else {
      // expand simple ${workspaceFolder}
      if (resolved.includes("${workspaceFolder}")) {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
          throw new Error(
            "No workspace folder open. Open a folder before generating files."
          );
        }
        resolved = resolved.replace(
          "${workspaceFolder}",
          folders[0].uri.fsPath
        );
      }
      return vscode.Uri.file(resolved);
    }
  }

  // command: generate from an input box (paste)
  context.subscriptions.push(
    vscode.commands.registerCommand("inverseFileTree.generate", async () => {
      const text = await vscode.window.showInputBox({
        prompt:
          "Paste the file tree text (supports tree symbols and indentation).",
        placeHolder: "my-project/\n├── src/\n│   └── index.js",
      });
      await runWithText(text);
    })
  );

  // command: generate from current selection
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "inverseFileTree.generateFromEditor",
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showErrorMessage(
            "Open a file and select the file tree text first."
          );
          return;
        }
        const sel = editor.selection;
        let text = editor.document.getText(sel);
        if (!text || !text.trim()) {
          // fallback: whole document
          text = editor.document.getText();
        }
        await runWithText(text);
      }
    )
  );
}

export function deactivate() {}
