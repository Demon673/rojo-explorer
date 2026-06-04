import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { planResourceRename } from "../src/resourceRename";
import { RojoFsEntry } from "../src/domain";

describe("resource rename planning", () => {
  it("renames script files while preserving their Rojo suffix", async () => {
    const sourcePath = path.join(root, "Main.server.lua");
    const result = await planResourceRename(
      {
        sourcePath,
        sourceKind: "script",
        entryType: "file",
        currentResourceName: "Main",
        newResourceName: "ServerMain",
      },
      fsWithEntries([{ name: "Main.server.lua", type: "file" }], [sourcePath]),
    );

    expect(result).toEqual({
      ok: true,
      plan: {
        currentResourceName: "Main",
        newResourceName: "ServerMain",
        targetPath: path.join(root, "ServerMain.server.lua"),
        moves: [
          {
            sourcePath,
            targetPath: path.join(root, "ServerMain.server.lua"),
            entryType: "file",
            role: "resource",
          },
        ],
      },
    });
  });

  it("preserves Luau and model-like file suffixes", async () => {
    await expectRenameTarget("Client.client.luau", "RenamedClient", "RenamedClient.client.luau", "script");
    await expectRenameTarget("Asset.model.json", "RenamedAsset", "RenamedAsset.model.json", "jsonModel");
    await expectRenameTarget("Model.rbxmx", "RenamedModel", "RenamedModel.rbxmx", "model");
  });

  it("renames directory resources as directories", async () => {
    const sourcePath = path.join(root, "Shared");
    const result = await planResourceRename(
      {
        sourcePath,
        sourceKind: "directory",
        entryType: "directory",
        currentResourceName: "Shared",
        newResourceName: "Common",
      },
      fsWithEntries([{ name: "Shared", type: "directory" }], [], [sourcePath]),
    );

    expect(result).toEqual({
      ok: true,
      plan: {
        currentResourceName: "Shared",
        newResourceName: "Common",
        targetPath: path.join(root, "Common"),
        moves: [
          {
            sourcePath,
            targetPath: path.join(root, "Common"),
            entryType: "directory",
            role: "resource",
          },
        ],
      },
    });
  });

  it("renames the containing directory for init script resources", async () => {
    const sourcePath = path.join(root, "Controller", "init.lua");
    const sourceDirectoryPath = path.join(root, "Controller");
    const result = await planResourceRename(
      {
        sourcePath,
        sourceKind: "initScript",
        entryType: "file",
        currentResourceName: "Controller",
        newResourceName: "InputController",
      },
      fsWithEntries(
        [{ name: "Controller", type: "directory" }],
        [sourcePath],
        [sourceDirectoryPath],
      ),
    );

    expect(result).toEqual({
      ok: true,
      plan: {
        currentResourceName: "Controller",
        newResourceName: "InputController",
        targetPath: path.join(root, "InputController"),
        moves: [
          {
            sourcePath: sourceDirectoryPath,
            targetPath: path.join(root, "InputController"),
            entryType: "directory",
            role: "resource",
          },
        ],
      },
    });
  });

  it("renames a sibling meta file with the resource", async () => {
    const sourcePath = path.join(root, "Tool.lua");
    const result = await planResourceRename(
      {
        sourcePath,
        sourceKind: "script",
        entryType: "file",
        currentResourceName: "Tool",
        newResourceName: "Gadget",
      },
      fsWithEntries(
        [
          { name: "Tool.lua", type: "file" },
          { name: "Tool.meta.json", type: "file" },
        ],
        [sourcePath, path.join(root, "Tool.meta.json")],
      ),
    );

    expect(result).toEqual({
      ok: true,
      plan: {
        currentResourceName: "Tool",
        newResourceName: "Gadget",
        targetPath: path.join(root, "Gadget.lua"),
        moves: [
          {
            sourcePath,
            targetPath: path.join(root, "Gadget.lua"),
            entryType: "file",
            role: "resource",
          },
          {
            sourcePath: path.join(root, "Tool.meta.json"),
            targetPath: path.join(root, "Gadget.meta.json"),
            entryType: "file",
            role: "meta",
          },
        ],
      },
    });
  });

  it("rejects invalid and unchanged names", async () => {
    const sourcePath = path.join(root, "Main.server.lua");
    for (const [newResourceName, reason] of [
      ["", "invalidName"],
      ["Bad/Name", "invalidName"],
      ["Main", "unchangedName"],
    ] as const) {
      const result = await planResourceRename(
        {
          sourcePath,
          sourceKind: "script",
          entryType: "file",
          currentResourceName: "Main",
          newResourceName,
        },
        fsWithEntries([{ name: "Main.server.lua", type: "file" }], [sourcePath]),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe(reason);
      }
    }
  });

  it("rejects project mapped resources that require project json edits", async () => {
    const sourcePath = path.join(root, "ServerScriptService");
    const result = await planResourceRename(
      {
        sourcePath,
        sourceKind: "projectTree",
        entryType: "directory",
        currentResourceName: "ServerScriptService",
        newResourceName: "ServerScripts",
      },
      fsWithEntries([{ name: "ServerScriptService", type: "directory" }], [], [sourcePath]),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unsupportedResource");
    }
  });

  it("rejects generated target path conflicts", async () => {
    const sourcePath = path.join(root, "Main.server.lua");
    const targetPath = path.join(root, "ServerMain.server.lua");
    const result = await planResourceRename(
      {
        sourcePath,
        sourceKind: "script",
        entryType: "file",
        currentResourceName: "Main",
        newResourceName: "ServerMain",
      },
      fsWithEntries(
        [
          { name: "Main.server.lua", type: "file" },
          { name: "ServerMain.server.lua", type: "file" },
        ],
        [sourcePath, targetPath],
      ),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("targetExists");
      expect(result.targetPath).toBe(targetPath);
    }
  });

  it("rejects Rojo resource name conflicts across different filesystem forms", async () => {
    const sourcePath = path.join(root, "Main.server.lua");
    const result = await planResourceRename(
      {
        sourcePath,
        sourceKind: "script",
        entryType: "file",
        currentResourceName: "Main",
        newResourceName: "Shared",
      },
      fsWithEntries(
        [
          { name: "Main.server.lua", type: "file" },
          { name: "Shared.lua", type: "file" },
        ],
        [sourcePath, path.join(root, "Shared.lua")],
      ),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("targetExists");
      expect(result.targetPath).toBe(path.join(root, "Shared.lua"));
    }
  });

  it("rejects sidecar meta target conflicts", async () => {
    const sourcePath = path.join(root, "Tool.lua");
    const result = await planResourceRename(
      {
        sourcePath,
        sourceKind: "script",
        entryType: "file",
        currentResourceName: "Tool",
        newResourceName: "Gadget",
      },
      fsWithEntries(
        [
          { name: "Tool.lua", type: "file" },
          { name: "Tool.meta.json", type: "file" },
          { name: "Gadget.meta.json", type: "file" },
        ],
        [sourcePath, path.join(root, "Tool.meta.json"), path.join(root, "Gadget.meta.json")],
      ),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("targetExists");
      expect(result.targetPath).toBe(path.join(root, "Gadget.meta.json"));
    }
  });
});

const root = path.resolve("project", "src");

async function expectRenameTarget(
  fileName: string,
  newResourceName: string,
  expectedFileName: string,
  sourceKind: "script" | "jsonModel" | "model",
) {
  const sourcePath = path.join(root, fileName);
  const currentResourceName = fileName.split(".")[0];
  const result = await planResourceRename(
    {
      sourcePath,
      sourceKind,
      entryType: "file",
      currentResourceName,
      newResourceName,
    },
    fsWithEntries([{ name: fileName, type: "file" }], [sourcePath]),
  );

  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.plan.targetPath).toBe(path.join(root, expectedFileName));
  }
}

function fsWithEntries(entries: RojoFsEntry[], files: string[] = [], directories: string[] = [root]) {
  return {
    async readDirectory(directoryPath: string) {
      return directoryPath === root ? entries : [];
    },
    async stat(filePath: string) {
      if (directories.some((directoryPath) => samePath(directoryPath, filePath))) {
        return "directory" as const;
      }

      if (files.some((existingFilePath) => samePath(existingFilePath, filePath))) {
        return "file" as const;
      }

      return undefined;
    },
  };
}

function samePath(left: string, right: string): boolean {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}
