import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { RojoFsEntry } from "../src/domain";
import { canDuplicateSourceKind, planResourceDuplicate } from "../src/resourceDuplicate";

describe("resource duplicate planning", () => {
  it("duplicates script files while preserving their Rojo suffix", async () => {
    const sourcePath = path.join(root, "Main.server.lua");
    const result = await planResourceDuplicate(
      {
        sourcePath,
        sourceKind: "script",
        entryType: "file",
        currentResourceName: "Main",
      },
      fsWithEntries([{ name: "Main.server.lua", type: "file" }], [sourcePath]),
    );

    expect(result).toEqual({
      ok: true,
      plan: {
        currentResourceName: "Main",
        newResourceName: "Main Copy",
        targetPath: path.join(root, "Main Copy.server.lua"),
        copies: [
          {
            sourcePath,
            targetPath: path.join(root, "Main Copy.server.lua"),
            entryType: "file",
            role: "resource",
          },
        ],
      },
    });
  });

  it("uses the next available copy name when the first copy name already exists", async () => {
    const sourcePath = path.join(root, "Main.server.lua");
    const result = await planResourceDuplicate(
      {
        sourcePath,
        sourceKind: "script",
        entryType: "file",
        currentResourceName: "Main",
      },
      fsWithEntries(
        [
          { name: "Main.server.lua", type: "file" },
          { name: "Main Copy.server.lua", type: "file" },
        ],
        [sourcePath, path.join(root, "Main Copy.server.lua")],
      ),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.newResourceName).toBe("Main Copy 2");
      expect(result.plan.targetPath).toBe(path.join(root, "Main Copy 2.server.lua"));
    }
  });

  it("duplicates directory-backed resources as directories", async () => {
    const sourcePath = path.join(root, "Shared");
    const result = await planResourceDuplicate(
      {
        sourcePath,
        sourceKind: "directory",
        entryType: "directory",
        currentResourceName: "Shared",
      },
      fsWithEntries([{ name: "Shared", type: "directory" }], [], [root, sourcePath]),
    );

    expect(result).toEqual({
      ok: true,
      plan: {
        currentResourceName: "Shared",
        newResourceName: "Shared Copy",
        targetPath: path.join(root, "Shared Copy"),
        copies: [
          {
            sourcePath,
            targetPath: path.join(root, "Shared Copy"),
            entryType: "directory",
            role: "resource",
          },
        ],
      },
    });
  });

  it("duplicates the containing directory for init script resources", async () => {
    const sourceDirectoryPath = path.join(root, "Controller");
    const sourcePath = path.join(sourceDirectoryPath, "init.lua");
    const result = await planResourceDuplicate(
      {
        sourcePath,
        sourceKind: "initScript",
        entryType: "file",
        currentResourceName: "Controller",
      },
      fsWithEntries([{ name: "Controller", type: "directory" }], [sourcePath], [root, sourceDirectoryPath]),
    );

    expect(result).toEqual({
      ok: true,
      plan: {
        currentResourceName: "Controller",
        newResourceName: "Controller Copy",
        targetPath: path.join(root, "Controller Copy"),
        copies: [
          {
            sourcePath: sourceDirectoryPath,
            targetPath: path.join(root, "Controller Copy"),
            entryType: "directory",
            role: "resource",
          },
        ],
      },
    });
  });

  it("duplicates sibling meta files with the resource", async () => {
    const sourcePath = path.join(root, "Tool.lua");
    const metaPath = path.join(root, "Tool.meta.json");
    const result = await planResourceDuplicate(
      {
        sourcePath,
        sourceKind: "script",
        entryType: "file",
        currentResourceName: "Tool",
      },
      fsWithEntries(
        [
          { name: "Tool.lua", type: "file" },
          { name: "Tool.meta.json", type: "file" },
        ],
        [sourcePath, metaPath],
      ),
    );

    expect(result).toEqual({
      ok: true,
      plan: {
        currentResourceName: "Tool",
        newResourceName: "Tool Copy",
        targetPath: path.join(root, "Tool Copy.lua"),
        copies: [
          {
            sourcePath,
            targetPath: path.join(root, "Tool Copy.lua"),
            entryType: "file",
            role: "resource",
          },
          {
            sourcePath: metaPath,
            targetPath: path.join(root, "Tool Copy.meta.json"),
            entryType: "file",
            role: "meta",
          },
        ],
      },
    });
  });

  it("uses the next copy name when a sidecar meta target already exists", async () => {
    const sourcePath = path.join(root, "Tool.lua");
    const metaPath = path.join(root, "Tool.meta.json");
    const firstCopyMetaPath = path.join(root, "Tool Copy.meta.json");
    const result = await planResourceDuplicate(
      {
        sourcePath,
        sourceKind: "script",
        entryType: "file",
        currentResourceName: "Tool",
      },
      fsWithEntries(
        [
          { name: "Tool.lua", type: "file" },
          { name: "Tool.meta.json", type: "file" },
          { name: "Tool Copy.meta.json", type: "file" },
        ],
        [sourcePath, metaPath, firstCopyMetaPath],
      ),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.newResourceName).toBe("Tool Copy 2");
      expect(result.plan.copies.at(1)?.targetPath).toBe(path.join(root, "Tool Copy 2.meta.json"));
    }
  });

  it("rejects project-controlled resources", async () => {
    for (const sourceKind of ["project", "projectTree", "projectInclusion"] as const) {
      expect(canDuplicateSourceKind(sourceKind)).toBe(false);
      const result = await planResourceDuplicate(
        {
          sourcePath: path.join(root, "ReplicatedStorage"),
          sourceKind,
          entryType: "directory",
          currentResourceName: "ReplicatedStorage",
        },
        fsWithEntries([{ name: "ReplicatedStorage", type: "directory" }], [], [root, path.join(root, "ReplicatedStorage")]),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("unsupportedResource");
      }
    }
  });

  it("rejects missing source paths", async () => {
    const sourcePath = path.join(root, "Missing.lua");
    const result = await planResourceDuplicate(
      {
        sourcePath,
        sourceKind: "script",
        entryType: "file",
        currentResourceName: "Missing",
      },
      fsWithEntries([], []),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("sourceNotFound");
      expect(result.targetPath).toBe(sourcePath);
    }
  });

  it("rejects unsupported file-backed resources", async () => {
    const sourcePath = path.join(root, "Unknown.bin");
    const result = await planResourceDuplicate(
      {
        sourcePath,
        sourceKind: "script",
        entryType: "file",
        currentResourceName: "Unknown",
      },
      fsWithEntries([{ name: "Unknown.bin", type: "file" }], [sourcePath]),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unsupportedResource");
    }
  });

  it("rejects when no generated copy name is available", async () => {
    const sourcePath = path.join(root, "Main.server.lua");
    const entries = [
      { name: "Main.server.lua", type: "file" as const },
      ...Array.from({ length: 100 }, (_, index) => ({
        name: `${index === 0 ? "Main Copy" : `Main Copy ${index + 1}`}.server.lua`,
        type: "file" as const,
      })),
    ];
    const result = await planResourceDuplicate(
      {
        sourcePath,
        sourceKind: "script",
        entryType: "file",
        currentResourceName: "Main",
      },
      fsWithEntries(entries, [sourcePath, ...entries.slice(1).map((entry) => path.join(root, entry.name))]),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("noAvailableName");
      expect(result.targetPath).toBe(path.join(root, "Main Copy 100.server.lua"));
    }
  });
});

const root = path.resolve("project", "src");

function fsWithEntries(entries: RojoFsEntry[], files: string[] = [], directories: string[] = [root]) {
  return {
    async readDirectory(directoryPath: string) {
      return samePath(directoryPath, root) ? entries : [];
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
