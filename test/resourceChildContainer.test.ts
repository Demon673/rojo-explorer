import * as path from "node:path";

import { describe, expect, it } from "vitest";

import type { RojoSourceRef } from "../src/domain";
import { getResourceChildContainerPath } from "../src/resourceChildContainer";

describe("resource child containers", () => {
  it("uses directory-backed resources as their own child container", () => {
    const source = createSource({
      fsPath: path.join("project", "src", "ReplicatedStorage"),
      kind: "directory",
      entryType: "directory",
    });

    expect(getResourceChildContainerPath(source)).toBe(source.fsPath);
  });

  it("uses the containing directory for init-backed resources", () => {
    const source = createSource({
      fsPath: path.join("project", "src", "Main", "init.server.lua"),
      kind: "initScript",
      entryType: "file",
    });

    expect(getResourceChildContainerPath(source)).toBe(path.join("project", "src", "Main"));
  });

  it("does not treat file-backed script resources as child containers", () => {
    const source = createSource({
      fsPath: path.join("project", "src", "Main.server.lua"),
      kind: "script",
      entryType: "file",
    });

    expect(getResourceChildContainerPath(source)).toBeUndefined();
  });

  it("rejects missing resources", () => {
    expect(getResourceChildContainerPath(createSource({ exists: false }))).toBeUndefined();
    expect(getResourceChildContainerPath(createSource({ entryType: undefined }))).toBeUndefined();
    expect(getResourceChildContainerPath(undefined)).toBeUndefined();
  });
});

function createSource(overrides: Partial<RojoSourceRef>): RojoSourceRef {
  return {
    fsPath: path.join("project", "src", "Resource"),
    kind: "directory",
    exists: true,
    entryType: "directory",
    ...overrides,
  };
}
