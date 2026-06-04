import { RojoFsEntryType } from "./domain";

export interface ExplorerClickBehaviorNode {
  kind: string;
  hasChildren: boolean;
  hasResource: boolean;
  sourceEntryType?: RojoFsEntryType;
}

export type ExplorerClickAction = "openResource" | "selectOnly" | undefined;

export function getExplorerClickAction(node: ExplorerClickBehaviorNode): ExplorerClickAction {
  if (shouldOpenResourceOnClick(node)) {
    return "openResource";
  }

  if (node.hasChildren) {
    return "selectOnly";
  }

  return undefined;
}

export function shouldOpenResourceOnClick(node: ExplorerClickBehaviorNode): boolean {
  return node.kind === "instance" && node.hasResource && node.sourceEntryType === "file";
}
