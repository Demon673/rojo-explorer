import * as path from "node:path";

import * as vscode from "vscode";

import { ExplorerNode, RojoExplorerProvider } from "./rojoExplorerProvider";
import { RojoExplorerDragAndDropController } from "./rojoExplorerDragAndDrop";
import { planProjectMappingPathEdit, ProjectMappingPathEditFailureReason } from "./projectMappingPathEdit";
import { planProjectMappingRename, ProjectMappingRenameFailureReason } from "./projectMappingRename";
import { createRenameInputOptions } from "./renameInputOptions";
import { CreatableResourceKind, planResourceCreation } from "./resourceCreation";
import { planResourceDeletion, ResourceDeletionFailureReason } from "./resourceDeletion";
import { planResourceDuplicate, ResourceDuplicateFailureReason } from "./resourceDuplicate";
import { planResourceInitMeta, ResourceInitMetaFailureReason } from "./resourceInitMeta";
import { planResourceMeta, ResourceMetaFailureReason } from "./resourceMeta";
import { planResourceMove, ResourceMoveFailureReason, ResourceMovePlan } from "./resourceMove";
import { planResourceRename, ResourceRenameFailureReason } from "./resourceRename";
import { VscodeRojoFileSystem } from "./vscodeFileSystem";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new RojoExplorerProvider(context);
  const fileSystem = new VscodeRojoFileSystem();
  const dragAndDropController = new RojoExplorerDragAndDropController(provider, (sourceNodes, targetFolder) =>
    moveResourcesToFolder(provider, fileSystem, sourceNodes, targetFolder),
  );
  const treeView = vscode.window.createTreeView("rojoExplorer.views.explorer", {
    treeDataProvider: provider,
    dragAndDropController,
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
    vscode.commands.registerCommand("rojoExplorer.selectNode", () => undefined),
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
    vscode.commands.registerCommand("rojoExplorer.copyRelativeSourcePath", async (node?: ExplorerNode) => {
      if (!node?.resourceUri) {
        return;
      }

      const relativePath = vscode.workspace.asRelativePath(node.resourceUri, false);
      await vscode.env.clipboard.writeText(relativePath);
      void vscode.window.showInformationMessage(vscode.l10n.t("Copied relative source path: {0}", relativePath));
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
    vscode.commands.registerCommand("rojoExplorer.createModel", (node?: ExplorerNode) =>
      createResource(provider, fileSystem, node, "Model"),
    ),
    vscode.commands.registerCommand("rojoExplorer.createRemoteEvent", (node?: ExplorerNode) =>
      createResource(provider, fileSystem, node, "RemoteEvent"),
    ),
    vscode.commands.registerCommand("rojoExplorer.createStringValue", (node?: ExplorerNode) =>
      createResource(provider, fileSystem, node, "StringValue"),
    ),
    vscode.commands.registerCommand("rojoExplorer.createLocalizationTable", (node?: ExplorerNode) =>
      createResource(provider, fileSystem, node, "LocalizationTable"),
    ),
    vscode.commands.registerCommand("rojoExplorer.createJsonModule", (node?: ExplorerNode) =>
      createResource(provider, fileSystem, node, "JSONModule"),
    ),
    vscode.commands.registerCommand("rojoExplorer.createTomlModule", (node?: ExplorerNode) =>
      createResource(provider, fileSystem, node, "TOMLModule"),
    ),
    vscode.commands.registerCommand("rojoExplorer.renameResource", (node?: ExplorerNode) =>
      renameResource(provider, fileSystem, node),
    ),
    vscode.commands.registerCommand("rojoExplorer.duplicateResource", (node?: ExplorerNode) =>
      duplicateResource(provider, fileSystem, node),
    ),
    vscode.commands.registerCommand("rojoExplorer.openResourceMeta", (node?: ExplorerNode) =>
      openResourceMeta(provider, fileSystem, node),
    ),
    vscode.commands.registerCommand("rojoExplorer.openResourceInitMeta", (node?: ExplorerNode) =>
      openResourceInitMeta(provider, fileSystem, node),
    ),
    vscode.commands.registerCommand("rojoExplorer.moveResource", (node?: ExplorerNode) =>
      moveResource(provider, fileSystem, node),
    ),
    vscode.commands.registerCommand("rojoExplorer.deleteResource", (node?: ExplorerNode) =>
      deleteResource(provider, fileSystem, node),
    ),
    vscode.commands.registerCommand("rojoExplorer.editProjectMapping", (node?: ExplorerNode) =>
      editProjectMapping(provider, fileSystem, node),
    ),
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
  for (const file of result.plan.additionalFiles ?? []) {
    await vscode.workspace.fs.writeFile(vscode.Uri.file(file.targetPath), Buffer.from(file.content, "utf8"));
  }

  provider.refresh();
  void vscode.window.showInformationMessage(vscode.l10n.t("Created {0}: {1}", localizeResourceKind(kind), result.plan.resourceName));

  if (result.plan.entryType === "file") {
    await openTextDocument(targetUri);
  }
}

async function openResourceInitMeta(
  provider: RojoExplorerProvider,
  fileSystem: VscodeRojoFileSystem,
  node: ExplorerNode | undefined,
): Promise<void> {
  const source = node?.instance?.source;
  if (!provider.canEditResourceInitMeta(node) || !node?.instance || !source?.entryType) {
    void vscode.window.showWarningMessage(vscode.l10n.t("This resource init metadata cannot be edited safely yet."));
    return;
  }

  const result = await planResourceInitMeta(
    {
      sourcePath: source.fsPath,
      sourceKind: source.kind,
      entryType: source.entryType,
      currentResourceName: node.instance.name,
    },
    fileSystem,
  );

  if (!result.ok) {
    void vscode.window.showWarningMessage(localizeInitMetaFailure(result.reason, result.targetPath));
    return;
  }

  const metaUri = vscode.Uri.file(result.plan.metaPath);
  if (!result.plan.exists) {
    await vscode.workspace.fs.writeFile(metaUri, Buffer.from(result.plan.content ?? "{}\n", "utf8"));
    provider.refresh();
    void vscode.window.showInformationMessage(vscode.l10n.t("Created init meta file for {0}", result.plan.currentResourceName));
  }

  await openTextDocument(metaUri);
}

async function openResourceMeta(
  provider: RojoExplorerProvider,
  fileSystem: VscodeRojoFileSystem,
  node: ExplorerNode | undefined,
): Promise<void> {
  const source = node?.instance?.source;
  if (!provider.canEditResourceMeta(node) || !node?.instance || !source?.entryType) {
    void vscode.window.showWarningMessage(vscode.l10n.t("This resource metadata cannot be edited safely yet."));
    return;
  }

  const result = await planResourceMeta(
    {
      sourcePath: source.fsPath,
      sourceKind: source.kind,
      entryType: source.entryType,
      currentResourceName: node.instance.name,
    },
    fileSystem,
  );

  if (!result.ok) {
    void vscode.window.showWarningMessage(localizeMetaFailure(result.reason, result.targetPath));
    return;
  }

  const metaUri = vscode.Uri.file(result.plan.metaPath);
  if (!result.plan.exists) {
    await vscode.workspace.fs.writeFile(metaUri, Buffer.from(result.plan.content ?? "{}\n", "utf8"));
    provider.refresh();
    void vscode.window.showInformationMessage(vscode.l10n.t("Created meta file for {0}", result.plan.currentResourceName));
  }

  await openTextDocument(metaUri);
}

async function duplicateResource(
  provider: RojoExplorerProvider,
  fileSystem: VscodeRojoFileSystem,
  node: ExplorerNode | undefined,
): Promise<void> {
  const source = node?.instance?.source;
  if (!provider.canDuplicateResource(node) || !node?.instance || !source?.entryType) {
    void vscode.window.showWarningMessage(vscode.l10n.t("This resource cannot be duplicated safely yet."));
    return;
  }

  const result = await planResourceDuplicate(
    {
      sourcePath: source.fsPath,
      sourceKind: source.kind,
      entryType: source.entryType,
      currentResourceName: node.instance.name,
    },
    fileSystem,
  );

  if (!result.ok) {
    void vscode.window.showWarningMessage(localizeDuplicateFailure(result.reason, result.targetPath));
    return;
  }

  const duplicateAction = vscode.l10n.t("Duplicate");
  const confirmation = await vscode.window.showWarningMessage(
    vscode.l10n.t("Duplicate {0} as {1}?", result.plan.currentResourceName, result.plan.newResourceName),
    {
      modal: true,
      detail: result.plan.copies.map((copy) => `${copy.sourcePath} -> ${copy.targetPath}`).join("\n"),
    },
    duplicateAction,
  );
  if (confirmation !== duplicateAction) {
    return;
  }

  for (const copy of result.plan.copies) {
    await vscode.workspace.fs.copy(vscode.Uri.file(copy.sourcePath), vscode.Uri.file(copy.targetPath), {
      overwrite: false,
    });
  }

  provider.refresh();
  void vscode.window.showInformationMessage(
    vscode.l10n.t("Duplicated {0} as {1}", result.plan.currentResourceName, result.plan.newResourceName),
  );

  const primaryCopy = result.plan.copies.find((copy) => copy.role === "resource");
  if (primaryCopy?.entryType === "file") {
    await openTextDocument(vscode.Uri.file(primaryCopy.targetPath));
  }
}

async function moveResource(
  provider: RojoExplorerProvider,
  fileSystem: VscodeRojoFileSystem,
  node: ExplorerNode | undefined,
): Promise<void> {
  const source = node?.instance?.source;
  if (!provider.canMoveResource(node) || !node?.instance || !source?.entryType) {
    void vscode.window.showWarningMessage(vscode.l10n.t("This resource cannot be moved safely yet."));
    return;
  }

  const targetFolders = await provider.getFilesystemFolderNodes();
  const picks = targetFolders
    .filter((folder) => folder.resourceUri)
    .map((folder) => ({
      label: folder.studioPath ?? folder.label,
      description: vscode.workspace.asRelativePath(folder.resourceUri!),
      folder,
    }));

  if (picks.length === 0) {
    void vscode.window.showWarningMessage(vscode.l10n.t("No filesystem-backed folder is available as a move target."));
    return;
  }

  const selected = await vscode.window.showQuickPick(picks, {
    placeHolder: vscode.l10n.t("Select target folder"),
  });
  if (!selected?.folder.resourceUri) {
    return;
  }

  await moveResourcesToFolder(provider, fileSystem, [node], selected.folder, {
    openSingleMovedFile: true,
  });
}

interface PlannedResourceMove {
  plan: ResourceMovePlan;
}

interface MoveResourcesToFolderOptions {
  openSingleMovedFile?: boolean;
}

async function moveResourcesToFolder(
  provider: RojoExplorerProvider,
  fileSystem: VscodeRojoFileSystem,
  sourceNodes: ExplorerNode[],
  targetFolder: ExplorerNode,
  options: MoveResourcesToFolderOptions = {},
): Promise<void> {
  if (!provider.canCreateChildren(targetFolder) || !targetFolder.resourceUri) {
    void vscode.window.showWarningMessage(vscode.l10n.t("Drop resources onto a filesystem-backed folder resource."));
    return;
  }

  const plannedMoves: PlannedResourceMove[] = [];
  for (const sourceNode of dedupeMoveSourceNodes(sourceNodes)) {
    const source = sourceNode.instance?.source;
    if (!provider.canMoveResource(sourceNode) || !sourceNode.instance || !source?.entryType) {
      void vscode.window.showWarningMessage(vscode.l10n.t("This resource cannot be moved safely yet."));
      return;
    }

    const result = await planResourceMove(
      {
        sourcePath: source.fsPath,
        sourceKind: source.kind,
        entryType: source.entryType,
        currentResourceName: sourceNode.instance.name,
        targetDirectoryPath: targetFolder.resourceUri.fsPath,
      },
      fileSystem,
    );

    if (!result.ok) {
      void vscode.window.showWarningMessage(localizeMoveFailure(result.reason, result.targetPath));
      return;
    }

    plannedMoves.push({
      plan: result.plan,
    });
  }

  if (plannedMoves.length === 0) {
    return;
  }

  const moveAction = vscode.l10n.t("Move");
  const targetLabel = targetFolder.studioPath ?? targetFolder.label;
  const confirmation = await vscode.window.showWarningMessage(
    createMoveConfirmationMessage(plannedMoves, targetLabel),
    {
      modal: true,
      detail: plannedMoves.flatMap((move) =>
        move.plan.moves.map((operation) => `${operation.sourcePath} -> ${operation.targetPath}`),
      ).join("\n"),
    },
    moveAction,
  );
  if (confirmation !== moveAction) {
    return;
  }

  for (const plannedMove of plannedMoves) {
    for (const move of plannedMove.plan.moves) {
      await vscode.workspace.fs.rename(vscode.Uri.file(move.sourcePath), vscode.Uri.file(move.targetPath), {
        overwrite: false,
      });
    }
  }

  provider.refresh();
  void vscode.window.showInformationMessage(createMovedMessage(plannedMoves, targetLabel));

  const primaryMove = plannedMoves.length === 1
    ? plannedMoves[0].plan.moves.find((move) => move.role === "resource")
    : undefined;
  if (options.openSingleMovedFile && primaryMove?.entryType === "file") {
    await openTextDocument(vscode.Uri.file(primaryMove.targetPath));
  }
}

function dedupeMoveSourceNodes(sourceNodes: ExplorerNode[]): ExplorerNode[] {
  const seen = new Set<string>();
  return sourceNodes.filter((node) => {
    const key = node.instance?.source?.fsPath ?? node.studioPath ?? node.label;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function createMoveConfirmationMessage(plannedMoves: PlannedResourceMove[], targetLabel: string): string {
  return plannedMoves.length === 1
    ? vscode.l10n.t("Move {0} to {1}?", plannedMoves[0].plan.currentResourceName, targetLabel)
    : vscode.l10n.t("Move {0} resources to {1}?", plannedMoves.length, targetLabel);
}

function createMovedMessage(plannedMoves: PlannedResourceMove[], targetLabel: string): string {
  return plannedMoves.length === 1
    ? vscode.l10n.t("Moved {0} to {1}", plannedMoves[0].plan.currentResourceName, targetLabel)
    : vscode.l10n.t("Moved {0} resources to {1}", plannedMoves.length, targetLabel);
}

async function deleteResource(
  provider: RojoExplorerProvider,
  fileSystem: VscodeRojoFileSystem,
  node: ExplorerNode | undefined,
): Promise<void> {
  const source = node?.instance?.source;
  if (!provider.canDeleteResource(node) || !node?.instance || !source?.entryType) {
    void vscode.window.showWarningMessage(vscode.l10n.t("This resource cannot be deleted safely yet."));
    return;
  }

  const result = await planResourceDeletion(
    {
      sourcePath: source.fsPath,
      sourceKind: source.kind,
      entryType: source.entryType,
      currentResourceName: node.instance.name,
    },
    fileSystem,
  );

  if (!result.ok) {
    void vscode.window.showWarningMessage(localizeDeletionFailure(result.reason, result.targetPath));
    return;
  }

  const deleteAction = vscode.l10n.t("Delete");
  const confirmation = await vscode.window.showWarningMessage(
    createDeleteConfirmationMessage(result.plan.currentResourceName, result.plan.targets.length),
    {
      modal: true,
      detail: result.plan.targets.map((target) => target.targetPath).join("\n"),
    },
    deleteAction,
  );
  if (confirmation !== deleteAction) {
    return;
  }

  for (const target of result.plan.targets) {
    await vscode.workspace.fs.delete(vscode.Uri.file(target.targetPath), {
      recursive: target.recursive,
      useTrash: true,
    });
  }

  provider.refresh();
  void vscode.window.showInformationMessage(vscode.l10n.t("Deleted {0}", result.plan.currentResourceName));
}

async function editProjectMapping(
  provider: RojoExplorerProvider,
  fileSystem: VscodeRojoFileSystem,
  node: ExplorerNode | undefined,
): Promise<void> {
  const projectMappingUri = provider.getProjectMappingUri(node);
  if (!projectMappingUri) {
    void vscode.window.showWarningMessage(vscode.l10n.t("Select a project-controlled resource first."));
    return;
  }

  const actions = [
    ...(provider.canRenameProjectMapping(node)
      ? [{ label: vscode.l10n.t("Rename Studio Name"), action: "renameStudioName" as const }]
      : []),
    ...(provider.canEditProjectMappingPath(node)
      ? [{ label: vscode.l10n.t("Change Source Path"), action: "changeSourcePath" as const }]
      : []),
    { label: vscode.l10n.t("Open Project File"), action: "openProjectFile" as const },
  ];
  const selected = await vscode.window.showQuickPick(actions, {
    placeHolder: vscode.l10n.t("Edit Project Mapping"),
  });

  if (!selected) {
    return;
  }

  if (selected.action === "openProjectFile") {
    await openTextDocument(projectMappingUri);
    return;
  }

  if (selected.action === "changeSourcePath") {
    await changeProjectMappingPath(provider, fileSystem, node, projectMappingUri);
    return;
  }

  await renameProjectMapping(provider, node, projectMappingUri);
}

async function changeProjectMappingPath(
  provider: RojoExplorerProvider,
  fileSystem: VscodeRojoFileSystem,
  node: ExplorerNode | undefined,
  projectMappingUri: vscode.Uri,
): Promise<void> {
  const currentName = node?.instance?.name;
  const projectTreePath = node?.instance?.projectTreePath;
  if (!currentName || !projectTreePath || !provider.canEditProjectMappingPath(node)) {
    void vscode.window.showWarningMessage(vscode.l10n.t("This project mapping source path cannot be changed safely yet."));
    return;
  }

  const selectedUris = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: true,
    canSelectMany: false,
    defaultUri: getProjectMappingPathDefaultUri(node, projectMappingUri),
    openLabel: vscode.l10n.t("Use Source Path"),
    title: vscode.l10n.t("Select new source path"),
  });

  const selectedUri = selectedUris?.[0];
  if (!selectedUri) {
    return;
  }

  const projectContent = Buffer.from(await vscode.workspace.fs.readFile(projectMappingUri)).toString("utf8");
  const result = await planProjectMappingPathEdit(
    projectContent,
    {
      projectFilePath: projectMappingUri.fsPath,
      projectTreePath,
      newSourcePath: selectedUri.fsPath,
    },
    fileSystem,
  );

  if (!result.ok) {
    void vscode.window.showWarningMessage(localizeProjectMappingPathEditFailure(result.reason, result.targetPath));
    return;
  }

  await vscode.workspace.fs.writeFile(projectMappingUri, Buffer.from(result.plan.updatedContent, "utf8"));
  provider.refresh();
  void vscode.window.showInformationMessage(
    vscode.l10n.t("Changed source path for {0} to {1}", result.plan.mappingName, result.plan.pathValue),
  );
}

function getProjectMappingPathDefaultUri(node: ExplorerNode | undefined, projectMappingUri: vscode.Uri): vscode.Uri {
  const source = node?.instance?.source;
  if (node?.resourceUri && source?.exists) {
    return node.resourceUri;
  }

  return vscode.Uri.file(path.dirname(projectMappingUri.fsPath));
}

async function renameProjectMapping(
  provider: RojoExplorerProvider,
  node: ExplorerNode | undefined,
  projectMappingUri: vscode.Uri,
): Promise<void> {
  const currentName = node?.instance?.name;
  const projectTreePath = node?.instance?.projectTreePath;
  if (!currentName || !projectTreePath || projectTreePath.length === 0) {
    void vscode.window.showWarningMessage(vscode.l10n.t("This project mapping cannot be renamed safely yet."));
    return;
  }

  const newName = await vscode.window.showInputBox(createRenameInputOptions({
    prompt: vscode.l10n.t("Rename Studio name for {0}", currentName),
    placeHolder: vscode.l10n.t("Studio name"),
    currentName,
    requiredMessage: vscode.l10n.t("Studio name is required."),
    pathSeparatorMessage: vscode.l10n.t("Studio name cannot contain path separators."),
  }));

  if (newName === undefined) {
    return;
  }

  const projectContent = Buffer.from(await vscode.workspace.fs.readFile(projectMappingUri)).toString("utf8");
  const result = planProjectMappingRename(projectContent, {
    projectFilePath: projectMappingUri.fsPath,
    projectTreePath,
    newName,
  });

  if (!result.ok) {
    void vscode.window.showWarningMessage(localizeProjectMappingRenameFailure(result.reason));
    return;
  }

  await vscode.workspace.fs.writeFile(projectMappingUri, Buffer.from(result.plan.updatedContent, "utf8"));
  provider.refresh();
  void vscode.window.showInformationMessage(
    vscode.l10n.t("Renamed project mapping {0} to {1}", result.plan.currentName, result.plan.newName),
  );
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
  const newName = await vscode.window.showInputBox(createRenameInputOptions({
    prompt: vscode.l10n.t("Rename {0}", currentName),
    placeHolder: vscode.l10n.t("Resource name"),
    currentName,
    requiredMessage: vscode.l10n.t("Resource name is required."),
    pathSeparatorMessage: vscode.l10n.t("Resource name cannot contain path separators."),
  }));

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

function createDeleteConfirmationMessage(resourceName: string, targetCount: number): string {
  return targetCount > 1
    ? vscode.l10n.t("Delete {0} and {1} source items?", resourceName, targetCount)
    : vscode.l10n.t("Delete {0}?", resourceName);
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
    case "Model":
      return vscode.l10n.t("Model");
    case "RemoteEvent":
      return vscode.l10n.t("RemoteEvent");
    case "StringValue":
      return vscode.l10n.t("StringValue");
    case "LocalizationTable":
      return vscode.l10n.t("LocalizationTable");
    case "JSONModule":
      return vscode.l10n.t("JSON Module");
    case "TOMLModule":
      return vscode.l10n.t("TOML Module");
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

function localizeDeletionFailure(reason: ResourceDeletionFailureReason, targetPath: string | undefined): string {
  switch (reason) {
    case "sourceNotFound":
      return targetPath
        ? vscode.l10n.t("Source path does not exist: {0}", targetPath)
        : vscode.l10n.t("Source path does not exist.");
    case "unsupportedResource":
      return vscode.l10n.t("This resource cannot be deleted safely yet.");
  }
}

function localizeDuplicateFailure(reason: ResourceDuplicateFailureReason, targetPath: string | undefined): string {
  switch (reason) {
    case "sourceNotFound":
      return targetPath
        ? vscode.l10n.t("Source path does not exist: {0}", targetPath)
        : vscode.l10n.t("Source path does not exist.");
    case "unsupportedResource":
      return vscode.l10n.t("This resource cannot be duplicated safely yet.");
    case "targetExists":
      return targetPath
        ? vscode.l10n.t("A resource with that Rojo name already exists: {0}", targetPath)
        : vscode.l10n.t("A resource with that Rojo name already exists.");
    case "noAvailableName":
      return targetPath
        ? vscode.l10n.t("No available duplicate resource name was found near: {0}", targetPath)
        : vscode.l10n.t("No available duplicate resource name was found.");
  }
}

function localizeMetaFailure(reason: ResourceMetaFailureReason, targetPath: string | undefined): string {
  switch (reason) {
    case "sourceNotFound":
      return targetPath
        ? vscode.l10n.t("Source path does not exist: {0}", targetPath)
        : vscode.l10n.t("Source path does not exist.");
    case "unsupportedResource":
      return vscode.l10n.t("This resource metadata cannot be edited safely yet.");
    case "targetExists":
      return targetPath
        ? vscode.l10n.t("A directory already exists where the meta file would be created: {0}", targetPath)
        : vscode.l10n.t("A directory already exists where the meta file would be created.");
  }
}

function localizeInitMetaFailure(reason: ResourceInitMetaFailureReason, targetPath: string | undefined): string {
  switch (reason) {
    case "sourceNotFound":
      return targetPath
        ? vscode.l10n.t("Source path does not exist: {0}", targetPath)
        : vscode.l10n.t("Source path does not exist.");
    case "unsupportedResource":
      return vscode.l10n.t("This resource init metadata cannot be edited safely yet.");
    case "targetExists":
      return targetPath
        ? vscode.l10n.t("A directory already exists where the init meta file would be created: {0}", targetPath)
        : vscode.l10n.t("A directory already exists where the init meta file would be created.");
  }
}

function localizeMoveFailure(reason: ResourceMoveFailureReason, targetPath: string | undefined): string {
  switch (reason) {
    case "sourceNotFound":
      return targetPath
        ? vscode.l10n.t("Source path does not exist: {0}", targetPath)
        : vscode.l10n.t("Source path does not exist.");
    case "targetNotDirectory":
      return targetPath
        ? vscode.l10n.t("Target path is not a directory: {0}", targetPath)
        : vscode.l10n.t("Target path is not a directory.");
    case "targetExists":
      return targetPath
        ? vscode.l10n.t("A resource with that Rojo name already exists in the target folder: {0}", targetPath)
        : vscode.l10n.t("A resource with that Rojo name already exists in the target folder.");
    case "targetInsideSource":
      return vscode.l10n.t("A resource cannot be moved inside itself.");
    case "unchangedTarget":
      return vscode.l10n.t("Resource is already in that folder.");
    case "unsupportedResource":
      return vscode.l10n.t("This resource cannot be moved safely yet.");
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

function localizeProjectMappingRenameFailure(reason: ProjectMappingRenameFailureReason): string {
  switch (reason) {
    case "invalidJson":
      return vscode.l10n.t("Project file contains invalid JSON.");
    case "invalidName":
      return vscode.l10n.t("Project mapping names cannot be empty or contain path separators.");
    case "mappingNotFound":
      return vscode.l10n.t("Project mapping was not found in the project file.");
    case "rootMapping":
      return vscode.l10n.t("The project root mapping cannot be renamed here.");
    case "targetExists":
      return vscode.l10n.t("A project mapping with that name already exists.");
    case "unchangedName":
      return vscode.l10n.t("Project mapping name is unchanged.");
  }
}

function localizeProjectMappingPathEditFailure(
  reason: ProjectMappingPathEditFailureReason,
  targetPath: string | undefined,
): string {
  switch (reason) {
    case "invalidJson":
      return vscode.l10n.t("Project file contains invalid JSON.");
    case "mappingNotFound":
      return vscode.l10n.t("Project mapping was not found in the project file.");
    case "mappingHasNoPath":
      return vscode.l10n.t("Project mapping is missing a $path value.");
    case "targetNotFound":
      return targetPath
        ? vscode.l10n.t("Selected source path does not exist: {0}", targetPath)
        : vscode.l10n.t("Selected source path does not exist.");
    case "unsupportedPathType":
      return targetPath
        ? vscode.l10n.t("Selected source file is not a supported Rojo resource: {0}", targetPath)
        : vscode.l10n.t("Selected source file is not a supported Rojo resource.");
    case "unchangedPath":
      return vscode.l10n.t("Project mapping source path is unchanged.");
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
