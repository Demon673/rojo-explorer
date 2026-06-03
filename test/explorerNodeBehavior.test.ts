import { describe, expect, it } from "vitest";

import { shouldOpenResourceOnClick } from "../src/explorerNodeBehavior";

describe("Explorer click behavior", () => {
  it("opens file-backed leaf instances on click", () => {
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
      shouldOpenResourceOnClick({
        kind: "instance",
        hasChildren: false,
        hasResource: true,
        sourceEntryType: "directory",
      }),
    ).toBe(false);
  });

  it("does not open expandable instances on click even when backed by an init file", () => {
    expect(
      shouldOpenResourceOnClick({
        kind: "instance",
        hasChildren: true,
        hasResource: true,
        sourceEntryType: "file",
      }),
    ).toBe(false);
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
});
