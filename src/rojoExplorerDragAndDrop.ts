import * as vscode from "vscode";

import { ExplorerNode, RojoExplorerProvider } from "./rojoExplorerProvider";
import { createDraggedExplorerNodesPayload, readDraggedExplorerNodesPayload } from "./treeDragMove";

export const rojoExplorerTreeMimeType = "application/vnd.code.tree.rojoexplorer.views.explorer";

export type MoveDroppedResources = (sourceNodes: ExplorerNode[], targetFolder: ExplorerNode) => Thenable<void> | Promise<void>;

export class RojoExplorerDragAndDropController implements vscode.TreeDragAndDropController<ExplorerNode> {
  readonly dropMimeTypes = [rojoExplorerTreeMimeType];
  readonly dragMimeTypes = [rojoExplorerTreeMimeType];

  constructor(
    private readonly provider: Pick<RojoExplorerProvider, "canCreateChildren" | "canMoveResource">,
    private readonly moveDroppedResources: MoveDroppedResources,
  ) {}

  handleDrag(source: readonly ExplorerNode[], dataTransfer: vscode.DataTransfer): void {
    const payload = createDraggedExplorerNodesPayload(source, (node) => this.provider.canMoveResource(node));
    if (!payload) {
      return;
    }

    dataTransfer.set(rojoExplorerTreeMimeType, new vscode.DataTransferItem(payload));
  }

  async handleDrop(target: ExplorerNode | undefined, dataTransfer: vscode.DataTransfer): Promise<void> {
    if (!target || !this.provider.canCreateChildren(target)) {
      void vscode.window.showWarningMessage(vscode.l10n.t("Drop resources onto a filesystem-backed folder resource."));
      return;
    }

    const sourceNodes = readDraggedExplorerNodesPayload(dataTransfer.get(rojoExplorerTreeMimeType)?.value);
    if (sourceNodes.length === 0) {
      return;
    }

    await this.moveDroppedResources(sourceNodes, target);
  }
}
