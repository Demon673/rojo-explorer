import { describe, expect, it } from "vitest";

import { getExplorerClickAction, shouldOpenResourceOnClick } from "../src/explorerNodeBehavior";

describe("Explorer click behavior", () => {
  it("opens file-backed leaf instances on click", () => {
    expect(
      getExplorerClickAction({
        kind: "instance",
        hasChildren: false,
        hasResource: true,
        sourceEntryType: "file",
      }),
    ).toBe("openResource");

    expect(
      shouldOpenResourceOnClick({
        kind: "instance",
        hasChildren: false,
        hasResource: true,
        sourceEntryType: "file",
      }),
    ).toBe(true);
  });

  it("does not open directory-backed instances on click", () => {
    expect(
      getExplorerClickAction({
        kind: "instance",
        hasChildren: false,
        hasResource: true,
        sourceEntryType: "directory",
      }),
    ).toBeUndefined();

    expect(
      shouldOpenResourceOnClick({
        kind: "instance",
        hasChildren: false,
        hasResource: true,
        sourceEntryType: "directory",
      }),
    ).toBe(false);
  });

  it("opens expandable init-backed instances on click without using label click to expand them", () => {
    expect(
      getExplorerClickAction({
        kind: "instance",
        hasChildren: true,
        hasResource: true,
        sourceEntryType: "file",
      }),
    ).toBe("openResource");

    expect(
      shouldOpenResourceOnClick({
        kind: "instance",
        hasChildren: true,
        hasResource: true,
        sourceEntryType: "file",
      }),
    ).toBe(true);
  });

  it("does not open projects, diagnostics, or messages as normal resources", () => {
    for (const kind of ["project", "diagnostic", "message"]) {
      expect(
        shouldOpenResourceOnClick({
          kind,
          hasChildren: false,
          hasResource: true,
          sourceEntryType: "file",
        }),
      ).toBe(false);
    }
  });

  it("selects expandable project and directory-backed nodes without using label click to open them", () => {
    for (const kind of ["project", "workspaceFolder"]) {
      expect(
        getExplorerClickAction({
          kind,
          hasChildren: true,
          hasResource: true,
          sourceEntryType: "directory",
        }),
      ).toBe("selectOnly");
    }

    expect(
      getExplorerClickAction({
        kind: "instance",
        hasChildren: true,
        hasResource: true,
        sourceEntryType: "directory",
      }),
    ).toBe("selectOnly");
  });
});
