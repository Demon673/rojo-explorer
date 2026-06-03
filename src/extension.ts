import * as vscode from "vscode";

import { ExplorerNode, RojoExplorerProvider } from "./rojoExplorerProvider";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new RojoExplorerProvider(context);
  const treeView = vscode.window.createTreeView("rojoExplorer.views.explorer", {
    treeDataProvider: provider,
    showCollapseAll: true,
  });

  context.subscriptions.push(
    treeView,
    vscode.commands.registerCommand("rojoExplorer.refresh", () => provider.refresh()),
    vscode.commands.registerCommand("rojoExplorer.openRojoProject", async () => {
      const projectUri = await provider.pickRojoProject();
      if (projectUri) {
        await openTextDocument(projectUri);
      }
    }),
    vscode.commands.registerCommand("rojoExplorer.openResource", async (node?: ExplorerNode) => {
      if (!node?.resourceUri) {
        return;
      }

      await openTextDocument(node.resourceUri);
    }),
    vscode.commands.registerCommand("rojoExplorer.revealInFileExplorer", async (node?: ExplorerNode) => {
      if (!node?.resourceUri) {
        return;
      }

      await vscode.commands.executeCommand("revealFileInOS", node.resourceUri);
    }),
    vscode.commands.registerCommand("rojoExplorer.copyStudioPath", async (node?: ExplorerNode) => {
      if (!node?.studioPath) {
        return;
      }

      await vscode.env.clipboard.writeText(node.studioPath);
      void vscode.window.showInformationMessage(`Copied Studio path: ${node.studioPath}`);
    }),
  );
}

export function deactivate(): void {
  // No background resources are kept after subscriptions are disposed.
}

async function openTextDocument(uri: vscode.Uri): Promise<void> {
  const stat = await vscode.workspace.fs.stat(uri);
  if (stat.type === vscode.FileType.Directory) {
    await vscode.commands.executeCommand("revealFileInOS", uri);
    return;
  }

  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document, { preview: false });
}
