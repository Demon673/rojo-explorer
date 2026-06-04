import { describe, expect, it } from "vitest";

import { createRenameInputOptions } from "../src/renameInputOptions";

describe("rename input options", () => {
  it("prefills the current name and selects it completely", () => {
    const options = createRenameInputOptions({
      currentName: "ReplicatedStorage",
      prompt: "Rename ReplicatedStorage",
      placeHolder: "Resource name",
      requiredMessage: "required",
      pathSeparatorMessage: "no separators",
    });

    expect(options.value).toBe("ReplicatedStorage");
    expect(options.valueSelection).toEqual([0, "ReplicatedStorage".length]);
    expect(options.ignoreFocusOut).toBe(true);
  });

  it("validates empty names and path separators", () => {
    const options = createRenameInputOptions({
      currentName: "Main",
      prompt: "Rename Main",
      placeHolder: "Resource name",
      requiredMessage: "required",
      pathSeparatorMessage: "no separators",
    });

    expect(options.validateInput("")).toBe("required");
    expect(options.validateInput("  ")).toBe("required");
    expect(options.validateInput("Bad/Name")).toBe("no separators");
    expect(options.validateInput("Bad\\Name")).toBe("no separators");
    expect(options.validateInput("GoodName")).toBeUndefined();
  });
});
