import * as vscode from "vscode";
import {
  generateForActiveFile,
  generateForWorkspace,
} from "./commands/analyze";
import { RationalePanel } from "./webview/panel";

export function activate(context: vscode.ExtensionContext) {
  console.log("Rationale Document Generator extension activated");

  const disposable1 = vscode.commands.registerCommand(
    "rationale.generateForFile",
    async () => {
      try {
        const md = await generateForActiveFile();
        RationalePanel.show(context.extensionUri, md);
      } catch (err: any) {
        vscode.window.showErrorMessage(
          "Rationale: " + (err.message || String(err))
        );
      }
    }
  );

  const disposable2 = vscode.commands.registerCommand(
    "rationale.generateForWorkspace",
    async () => {
      try {
        const md = await generateForWorkspace();
        RationalePanel.show(context.extensionUri, md);
      } catch (err: any) {
        vscode.window.showErrorMessage(
          "Rationale: " + (err.message || String(err))
        );
      }
    }
  );

  context.subscriptions.push(disposable1, disposable2);
}

export function deactivate() {}
