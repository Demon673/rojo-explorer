import { RojoFsEntryType } from "./domain";

export interface ExplorerClickBehaviorNode {
  kind: string;
  hasChildren: boolean;
  hasResource: boolean;
  sourceEntryType?: RojoFsEntryType;
}

export function shouldOpenResourceOnClick(node: ExplorerClickBehaviorNode): boolean {
  return node.kind === "instance" && node.hasResource && node.sourceEntryType === "file" && !node.hasChildren;
}
