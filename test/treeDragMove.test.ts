import { describe, expect, it } from "vitest";

import type { ExplorerNode } from "../src/rojoExplorerProvider";
import { createDraggedExplorerNodesPayload, readDraggedExplorerNodesPayload } from "../src/treeDragMove";

describe("tree drag move payloads", () => {
  it("keeps only movable drag source nodes", () => {
    const movable = createNode("Main");
    const blocked = createNode("ReplicatedStorage");
    const payload = createDraggedExplorerNodesPayload([movable, blocked], (node) => node.label === "Main");

    expect(payload).toEqual({
      nodes: [movable],
    });
  });

  it("returns undefined when no dragged node can be moved", () => {
    const payload = createDraggedExplorerNodesPayload([createNode("ReplicatedStorage")], () => false);

    expect(payload).toBeUndefined();
  });

  it("reads valid payload nodes and rejects unrelated values", () => {
    const nodes = [createNode("Main")];

    expect(readDraggedExplorerNodesPayload({ nodes })).toEqual(nodes);
    expect(readDraggedExplorerNodesPayload(undefined)).toEqual([]);
    expect(readDraggedExplorerNodesPayload({ nodes: "Main" })).toEqual([]);
  });
});

function createNode(label: string): ExplorerNode {
  return {
    kind: "instance",
    label,
  };
}
