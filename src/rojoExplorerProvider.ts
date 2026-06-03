import * as path from "node:path";

import * as vscode from "vscode";

import {
  buildRojoProjectModel,
  formatNodeStudioPath,
  RojoDiagnostic,
  RojoInstanceNode,
  RojoProjectModel,
} from "./domain";
import { shouldOpenResourceOnClick } from "./explorerNodeBehavior";
import { VscodeRojoFileSystem } from "./vscodeFileSystem";
import { findRojoProjectFiles } from "./vscodeRojoProjects";

export type ExplorerNodeKind = "project" | "workspaceFolder" | "instance" | "diagnostic" | "message";

export interface ExplorerNode {
  kind: ExplorerNodeKind;
  label: string;
  description?: string;
  tooltip?: string;
  className?: string;
  resourceUri?: vscode.Uri;
  projectUri?: vscode.Uri;
  studioPath?: string;
  instance?: RojoInstanceNode;
  diagnostic?: RojoDiagnostic;
  diagnostics?: RojoDiagnostic[];
  children?: ExplorerNode[];
  loadChildren?: () => Promise<ExplorerNode[]>;
}

export class RojoExplorerProvider implements vscode.TreeDataProvider<ExplorerNode> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<ExplorerNode | undefined | null | void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private readonly fileSystem = new VscodeRojoFileSystem();
  private refreshTimer: NodeJS.Timeout | undefined;
  private rootNodes: ExplorerNode[] | undefined;

  constructor(context: vscode.ExtensionContext) {
    const projectWatcher = vscode.workspace.createFileSystemWatcher("**/*.project.json");
    projectWatcher.onDidCreate(() => this.scheduleRefresh());
    projectWatcher.onDidChange(() => this.scheduleRefresh());
    projectWatcher.onDidDelete(() => this.scheduleRefresh());

    const sourceWatchers = [
      "**/*.{lua,luau,json,toml,txt,csv,rbxm,rbxmx}",
      "**/*.meta.json",
      "**/default.project.json",
    ].map((pattern) => vscode.workspace.createFileSystemWatcher(pattern));

    for (const watcher of sourceWatchers) {
      watcher.onDidCreate(() => this.scheduleRefresh());
      watcher.onDidChange(() => this.scheduleRefresh());
      watcher.onDidDelete(() => this.scheduleRefresh());
    }

    context.subscriptions.push(projectWatcher, ...sourceWatchers);
  }

  refresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }

    this.rootNodes = undefined;
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = setTimeout(() => this.refresh(), 150);
  }

  getTreeItem(node: ExplorerNode): vscode.TreeItem {
    const state = this.hasChildren(node)
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    const item = new vscode.TreeItem(node.label, state);
    item.description = node.description;
    item.tooltip = node.tooltip ?? this.createTooltip(node);
    item.contextValue = `${node.kind}${node.resourceUri ? ".resource" : ""}${node.studioPath ? ".studioPath" : ""}`;
    item.resourceUri = node.resourceUri;
    item.iconPath = this.getIcon(node);

    if (shouldOpenResourceOnClick({
      kind: node.kind,
      hasChildren: this.hasChildren(node),
      hasResource: Boolean(node.resourceUri),
      sourceEntryType: node.instance?.source?.entryType,
    })) {
      item.command = {
        command: "rojoExplorer.openResource",
        title: vscode.l10n.t("Open Resource"),
        arguments: [node],
      };
    }

    if (node.kind === "diagnostic") {
      item.command = node.diagnostic?.fsPath
        ? {
            command: "rojoExplorer.openResource",
            title: vscode.l10n.t("Open Diagnostic Source"),
            arguments: [{ ...node, resourceUri: vscode.Uri.file(node.diagnostic.fsPath) }],
          }
        : undefined;
    }

    return item;
  }

  async getChildren(node?: ExplorerNode): Promise<ExplorerNode[]> {
    if (node) {
      return this.getNodeChildren(node);
    }

    if (this.rootNodes) {
      return this.rootNodes;
    }

    this.rootNodes = await this.createRootNodes();
    return this.rootNodes;
  }

  async pickRojoProject(): Promise<vscode.Uri | undefined> {
    const projectUris = await findRojoProjectFiles();
    if (projectUris.length === 0) {
      void vscode.window.showInformationMessage(vscode.l10n.t("No Rojo project file was found in this workspace."));
      return undefined;
    }

    if (projectUris.length === 1) {
      return projectUris[0];
    }

    const picks = projectUris.map((uri) => ({
      label: path.basename(uri.fsPath),
      description: vscode.workspace.asRelativePath(uri),
      uri,
    }));
    const selected = await vscode.window.showQuickPick(picks, {
      placeHolder: vscode.l10n.t("Select a Rojo project file"),
    });

    return selected?.uri;
  }

  private async createRootNodes(): Promise<ExplorerNode[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return [this.createMessageNode(vscode.l10n.t("Open a Rojo workspace or folder to inspect resources."))];
    }

    const projectUris = await findRojoProjectFiles();
    if (projectUris.length > 0) {
      const projects = await Promise.all(projectUris.map((uri) => this.createProjectNode(uri)));
      return projects.filter((node): node is ExplorerNode => node !== undefined);
    }

    return workspaceFolders.map((folder) => ({
      kind: "workspaceFolder",
      label: folder.name,
      description: vscode.l10n.t("No Rojo project file"),
      tooltip: folder.uri.fsPath,
      resourceUri: folder.uri,
      children: [this.createMessageNode(vscode.l10n.t("No Rojo project file was found in this workspace folder."))],
    }));
  }

  private async createProjectNode(projectUri: vscode.Uri): Promise<ExplorerNode | undefined> {
    const model = await buildRojoProjectModel(projectUri.fsPath, this.fileSystem);
    return {
      kind: "project",
      label: model.config.name,
      description: vscode.workspace.asRelativePath(projectUri),
      tooltip: this.createProjectTooltip(model),
      resourceUri: projectUri,
      projectUri,
      diagnostics: model.diagnostics,
      children: [
        ...this.createDiagnosticNodes(model.diagnostics, projectUri),
        this.createInstanceNode(model.root, projectUri),
      ],
    };
  }

  private createInstanceNode(instance: RojoInstanceNode, projectUri: vscode.Uri): ExplorerNode {
    return {
      kind: "instance",
      label: instance.name,
      description: this.createInstanceDescription(instance),
      className: instance.className,
      tooltip: this.createInstanceTooltip(instance),
      resourceUri: instance.source ? vscode.Uri.file(instance.source.fsPath) : undefined,
      projectUri,
      studioPath: formatNodeStudioPath(instance),
      instance,
      diagnostics: instance.diagnostics,
      children: [
        ...this.createDiagnosticNodes(instance.diagnostics, projectUri),
        ...instance.children.map((child) => this.createInstanceNode(child, projectUri)),
      ],
    };
  }

  private async getNodeChildren(node: ExplorerNode): Promise<ExplorerNode[]> {
    if (node.children && !node.loadChildren) {
      return node.children;
    }

    if (!node.loadChildren) {
      return node.children ?? [];
    }

    const loadedChildren = await node.loadChildren();
    node.children = loadedChildren;
    node.loadChildren = undefined;
    return loadedChildren;
  }

  private hasChildren(node: ExplorerNode): boolean {
    return Boolean(node.loadChildren || (node.children && node.children.length > 0));
  }

  private getIcon(node: ExplorerNode): vscode.ThemeIcon {
    if (node.kind === "project") {
      return new vscode.ThemeIcon("project");
    }

    if (node.kind === "workspaceFolder") {
      return new vscode.ThemeIcon("root-folder");
    }

    if (node.kind === "message") {
      return new vscode.ThemeIcon("info");
    }

    if (node.kind === "diagnostic") {
      return diagnosticIcon(node.diagnostic?.severity ?? "info");
    }

    if (node.diagnostics?.some((diagnostic) => diagnostic.severity === "error")) {
      return new vscode.ThemeIcon("error");
    }

    if (node.diagnostics?.some((diagnostic) => diagnostic.severity === "warning")) {
      return new vscode.ThemeIcon("warning");
    }

    if (node.className) {
      return iconForClassName(node.className);
    }

    return new vscode.ThemeIcon("file");
  }

  private createTooltip(node: ExplorerNode): string {
    const diagnostics = node.diagnostics?.map((diagnostic) => this.formatDiagnosticLine(diagnostic)) ?? [];
    const details = [node.className, node.studioPath, node.resourceUri?.fsPath, ...diagnostics].filter(Boolean);
    return details.length > 0 ? details.join("\n") : node.label;
  }

  private createProjectTooltip(model: RojoProjectModel): string {
    const diagnostics = model.diagnostics.map((diagnostic) => this.formatDiagnosticLine(diagnostic));
    return [model.config.projectFilePath, ...diagnostics].join("\n");
  }

  private createInstanceDescription(instance: RojoInstanceNode): string {
    if (instance.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
      return vscode.l10n.t("{0} - error", instance.className);
    }

    if (instance.diagnostics.some((diagnostic) => diagnostic.severity === "warning")) {
      return vscode.l10n.t("{0} - warning", instance.className);
    }

    return instance.className;
  }

  private createInstanceTooltip(instance: RojoInstanceNode): string {
    const diagnostics = instance.diagnostics.map((diagnostic) => this.formatDiagnosticLine(diagnostic));
    return [
      instance.className,
      formatNodeStudioPath(instance),
      instance.source?.fsPath,
      ...diagnostics,
    ].filter(Boolean).join("\n");
  }

  private createDiagnosticNodes(diagnostics: RojoDiagnostic[], projectUri: vscode.Uri): ExplorerNode[] {
    return diagnostics.map((diagnostic) => ({
      kind: "diagnostic",
      label: this.localizeDiagnosticMessage(diagnostic),
      description: diagnostic.code,
      tooltip: this.createDiagnosticTooltip(diagnostic),
      resourceUri: diagnostic.fsPath ? vscode.Uri.file(diagnostic.fsPath) : undefined,
      projectUri,
      studioPath: diagnostic.studioPath,
      diagnostic,
    }));
  }

  private createDiagnosticTooltip(diagnostic: RojoDiagnostic): string {
    return [
      this.formatDiagnosticLine(diagnostic),
      diagnostic.code,
      diagnostic.studioPath,
      diagnostic.fsPath,
    ].filter(Boolean).join("\n");
  }

  private formatDiagnosticLine(diagnostic: RojoDiagnostic): string {
    return `${localizeSeverity(diagnostic.severity)}: ${this.localizeDiagnosticMessage(diagnostic)}`;
  }

  private localizeDiagnosticMessage(diagnostic: RojoDiagnostic): string {
    const location = diagnostic.fsPath ?? diagnostic.studioPath ?? "";

    switch (diagnostic.code) {
      case "invalidJson":
        return vscode.l10n.t("Invalid JSON: {0}", location);
      case "missingTree":
        return vscode.l10n.t("Rojo project file is missing a valid tree object.");
      case "pathNotFound":
        return vscode.l10n.t("Mapped path does not exist: {0}", location);
      case "unsupportedPathType":
        return vscode.l10n.t("Mapped file is not a supported Rojo resource: {0}", location);
      case "duplicateInitScript":
        return vscode.l10n.t("Only one init script can be present in this directory: {0}", location);
      case "invalidMetaJson":
        return vscode.l10n.t("Invalid meta JSON: {0}", location);
      case "unsupportedMetaClassName":
        return vscode.l10n.t("Only init.meta.json can change className.");
      case "unsupportedMetaProperties":
        return vscode.l10n.t("Meta properties are not applied to model resources.");
      case "orphanMetaFile":
        return vscode.l10n.t("Meta file has no matching Rojo resource: {0}", location);
    }
  }

  private createMessageNode(label: string): ExplorerNode {
    return {
      kind: "message",
      label,
    };
  }
}

function diagnosticIcon(severity: RojoDiagnostic["severity"]): vscode.ThemeIcon {
  switch (severity) {
    case "error":
      return new vscode.ThemeIcon("error");
    case "warning":
      return new vscode.ThemeIcon("warning");
    case "info":
      return new vscode.ThemeIcon("info");
  }
}

function localizeSeverity(severity: RojoDiagnostic["severity"]): string {
  switch (severity) {
    case "error":
      return vscode.l10n.t("error");
    case "warning":
      return vscode.l10n.t("warning");
    case "info":
      return vscode.l10n.t("info");
  }
}

function iconForClassName(className: string): vscode.ThemeIcon {
  switch (className) {
    case "DataModel":
      return new vscode.ThemeIcon("symbol-namespace");
    case "Workspace":
      return new vscode.ThemeIcon("symbol-namespace");
    case "ReplicatedStorage":
    case "ServerStorage":
      return new vscode.ThemeIcon("database");
    case "ServerScriptService":
      return new vscode.ThemeIcon("server-process");
    case "StarterPlayer":
    case "StarterPlayerScripts":
    case "StarterGui":
      return new vscode.ThemeIcon("account");
    case "Script":
      return new vscode.ThemeIcon("file-code");
    case "LocalScript":
      return new vscode.ThemeIcon("device-mobile");
    case "ModuleScript":
      return new vscode.ThemeIcon("symbol-module");
    case "Folder":
      return new vscode.ThemeIcon("folder");
    case "Model":
      return new vscode.ThemeIcon("symbol-structure");
    case "StringValue":
      return new vscode.ThemeIcon("symbol-string");
    case "LocalizationTable":
      return new vscode.ThemeIcon("table");
    default:
      return new vscode.ThemeIcon("symbol-object");
  }
}
