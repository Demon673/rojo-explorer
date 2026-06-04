import * as vscode from "vscode";

import { ExplorerNode, RojoExplorerProvider } from "./rojoExplorerProvider";
import { CreatableResourceKind, planResourceCreation } from "./resourceCreation";
import { planResourceRename, ResourceRenameFailureReason } from "./resourceRename";
import { VscodeRojoFileSystem } from "./vscodeFileSystem";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new RojoExplorerProvider(context);
  const fileSystem = new VscodeRojoFileSystem();
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

      if (!(await resourceExists(node.resourceUri))) {
        showMissingSourcePath(node.resourceUri);
        return;
      }

      await vscode.commands.executeCommand("revealFileInOS", node.resourceUri);
    }),
    vscode.commands.registerCommand("rojoExplorer.revealInVsCodeExplorer", async (node?: ExplorerNode) => {
      if (!node?.resourceUri) {
        return;
      }

      if (!(await resourceExists(node.resourceUri))) {
        showMissingSourcePath(node.resourceUri);
        return;
      }

      await vscode.commands.executeCommand("revealInExplorer", node.resourceUri);
    }),
    vscode.commands.registerCommand("rojoExplorer.copyStudioPath", async (node?: ExplorerNode) => {
      if (!node?.studioPath) {
        return;
      }

      await vscode.env.clipboard.writeText(node.studioPath);
      void vscode.window.showInformationMessage(vscode.l10n.t("Copied Studio path: {0}", node.studioPath));
    }),
    vscode.commands.registerCommand("rojoExplorer.copySourcePath", async (node?: ExplorerNode) => {
      if (!node?.resourceUri) {
        return;
      }

      await vscode.env.clipboard.writeText(node.resourceUri.fsPath);
      void vscode.window.showInformationMessage(vscode.l10n.t("Copied source path: {0}", node.resourceUri.fsPath));
    }),
    vscode.commands.registerCommand("rojoExplorer.createFolder", (node?: ExplorerNode) =>
      createResource(provider, fileSystem, node, "Folder"),
    ),
    vscode.commands.registerCommand("rojoExplorer.createScript", (node?: ExplorerNode) =>
      createResource(provider, fileSystem, node, "Script"),
    ),
    vscode.commands.registerCommand("rojoExplorer.createLocalScript", (node?: ExplorerNode) =>
      createResource(provider, fileSystem, node, "LocalScript"),
    ),
    vscode.commands.registerCommand("rojoExplorer.createModuleScript", (node?: ExplorerNode) =>
      createResource(provider, fileSystem, node, "ModuleScript"),
    ),
    vscode.commands.registerCommand("rojoExplorer.renameResource", (node?: ExplorerNode) =>
      renameResource(provider, fileSystem, node),
    ),
    vscode.commands.registerCommand("rojoExplorer.editProjectMapping", async (node?: ExplorerNode) => {
      const projectMappingUri = provider.getProjectMappingUri(node);
      if (!projectMappingUri) {
        void vscode.window.showWarningMessage(vscode.l10n.t("Select a project-controlled resource first."));
        return;
      }

      await openTextDocument(projectMappingUri);
    }),
  );
}

export function deactivate(): void {
  // No background resources are kept after subscriptions are disposed.
}

async function openTextDocument(uri: vscode.Uri): Promise<void> {
  const stat = await statResource(uri);
  if (!stat) {
    showMissingSourcePath(uri);
    return;
  }

  if (stat.type === vscode.FileType.Directory) {
    await vscode.commands.executeCommand("revealFileInOS", uri);
    return;
  }

  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document, { preview: false });
}

async function createResource(
  provider: RojoExplorerProvider,
  fileSystem: VscodeRojoFileSystem,
  node: ExplorerNode | undefined,
  kind: CreatableResourceKind,
): Promise<void> {
  if (!provider.canCreateChildren(node) || !node?.resourceUri) {
    void vscode.window.showWarningMessage(vscode.l10n.t("Select a filesystem-backed folder resource first."));
    return;
  }

  const resourceName = await vscode.window.showInputBox({
    prompt: vscode.l10n.t("Enter {0} name", localizeResourceKind(kind)),
    placeHolder: vscode.l10n.t("Resource name"),
    validateInput(value) {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        return vscode.l10n.t("Resource name is required.");
      }

      if (trimmed.includes("/") || trimmed.includes("\\")) {
        return vscode.l10n.t("Resource name cannot contain path separators.");
      }

      return undefined;
    },
  });

  if (resourceName === undefined) {
    return;
  }

  const result = await planResourceCreation(
    {
      parentDirectoryPath: node.resourceUri.fsPath,
      resourceName,
      kind,
    },
    fileSystem,
  );

  if (!result.ok) {
    void vscode.window.showWarningMessage(localizeCreationFailure(result.reason, result.targetPath));
    return;
  }

  const targetUri = vscode.Uri.file(result.plan.targetPath);
  if (result.plan.entryType === "directory") {
    await vscode.workspace.fs.createDirectory(targetUri);
  } else {
    await vscode.workspace.fs.writeFile(targetUri, Buffer.from(result.plan.content ?? "", "utf8"));
  }

  provider.refresh();
  void vscode.window.showInformationMessage(vscode.l10n.t("Created {0}: {1}", localizeResourceKind(kind), result.plan.resourceName));

  if (result.plan.entryType === "file") {
    await openTextDocument(targetUri);
  }
}

async function renameResource(
  provider: RojoExplorerProvider,
  fileSystem: VscodeRojoFileSystem,
  node: ExplorerNode | undefined,
): Promise<void> {
  const source = node?.instance?.source;
  if (!provider.canRenameResource(node) || !node?.instance || !source?.entryType) {
    void vscode.window.showWarningMessage(vscode.l10n.t("This resource cannot be renamed safely yet."));
    return;
  }

  const currentName = node.instance.name;
  const newName = await vscode.window.showInputBox({
    prompt: vscode.l10n.t("Rename {0}", currentName),
    placeHolder: vscode.l10n.t("Resource name"),
    value: currentName,
    valueSelection: [0, currentName.length],
    validateInput(value) {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        return vscode.l10n.t("Resource name is required.");
      }

      if (trimmed.includes("/") || trimmed.includes("\\")) {
        return vscode.l10n.t("Resource name cannot contain path separators.");
      }

      return undefined;
    },
  });

  if (newName === undefined) {
    return;
  }

  const result = await planResourceRename(
    {
      sourcePath: source.fsPath,
      sourceKind: source.kind,
      entryType: source.entryType,
      currentResourceName: currentName,
      newResourceName: newName,
    },
    fileSystem,
  );

  if (!result.ok) {
    void vscode.window.showWarningMessage(localizeRenameFailure(result.reason, result.targetPath));
    return;
  }

  for (const move of result.plan.moves) {
    await vscode.workspace.fs.rename(vscode.Uri.file(move.sourcePath), vscode.Uri.file(move.targetPath), {
      overwrite: false,
    });
  }

  provider.refresh();
  void vscode.window.showInformationMessage(
    vscode.l10n.t("Renamed {0} to {1}", result.plan.currentResourceName, result.plan.newResourceName),
  );

  const primaryMove = result.plan.moves.find((move) => move.role === "resource");
  if (primaryMove?.entryType === "file") {
    await openTextDocument(vscode.Uri.file(primaryMove.targetPath));
  }
}

function localizeResourceKind(kind: CreatableResourceKind): string {
  switch (kind) {
    case "Folder":
      return vscode.l10n.t("Folder");
    case "Script":
      return vscode.l10n.t("Script");
    case "LocalScript":
      return vscode.l10n.t("LocalScript");
    case "ModuleScript":
      return vscode.l10n.t("ModuleScript");
  }
}

function localizeCreationFailure(reason: "invalidName" | "parentNotDirectory" | "targetExists", targetPath: string | undefined): string {
  switch (reason) {
    case "invalidName":
      return vscode.l10n.t("Resource names cannot be empty or contain path separators.");
    case "parentNotDirectory":
      return vscode.l10n.t("Resources can only be created under filesystem-backed directories.");
    case "targetExists":
      return targetPath
        ? vscode.l10n.t("A resource with that Rojo name already exists: {0}", targetPath)
        : vscode.l10n.t("A resource with that Rojo name already exists.");
  }
}

function localizeRenameFailure(reason: ResourceRenameFailureReason, targetPath: string | undefined): string {
  switch (reason) {
    case "invalidName":
      return vscode.l10n.t("Resource names cannot be empty or contain path separators.");
    case "sourceNotFound":
      return targetPath
        ? vscode.l10n.t("Source path does not exist: {0}", targetPath)
        : vscode.l10n.t("Source path does not exist.");
    case "unsupportedResource":
      return vscode.l10n.t("This resource cannot be renamed safely yet.");
    case "targetExists":
      return targetPath
        ? vscode.l10n.t("A resource with that Rojo name already exists: {0}", targetPath)
        : vscode.l10n.t("A resource with that Rojo name already exists.");
    case "unchangedName":
      return vscode.l10n.t("Resource name is unchanged.");
  }
}

function showMissingSourcePath(uri: vscode.Uri): void {
  void vscode.window.showWarningMessage(vscode.l10n.t("Source path does not exist: {0}", uri.fsPath));
}

async function resourceExists(uri: vscode.Uri): Promise<boolean> {
  return (await statResource(uri)) !== undefined;
}

async function statResource(uri: vscode.Uri): Promise<vscode.FileStat | undefined> {
  try {
    return await vscode.workspace.fs.stat(uri);
  } catch {
    return undefined;
  }
}
