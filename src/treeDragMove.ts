import type { ExplorerNode } from "./rojoExplorerProvider";

export interface DraggedExplorerNodesPayload {
  nodes: ExplorerNode[];
}

export function createDraggedExplorerNodesPayload(
  source: readonly ExplorerNode[],
  canMoveResource: (node: ExplorerNode) => boolean,
): DraggedExplorerNodesPayload | undefined {
  const nodes = source.filter(canMoveResource);
  return nodes.length > 0 ? { nodes } : undefined;
}

export function readDraggedExplorerNodesPayload(value: unknown): ExplorerNode[] {
  if (!isDraggedExplorerNodesPayload(value)) {
    return [];
  }

  return value.nodes;
}

function isDraggedExplorerNodesPayload(value: unknown): value is DraggedExplorerNodesPayload {
  return (
    typeof value === "object"
    && value !== null
    && Array.isArray((value as DraggedExplorerNodesPayload).nodes)
  );
}
