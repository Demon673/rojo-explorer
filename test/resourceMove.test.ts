import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { RojoFsEntry } from "../src/domain";
import { canMoveSourceKind, planResourceMove } from "../src/resourceMove";

describe("resource move planning", () => {
  it("moves file-backed resources into target directories", async () => {
    const sourcePath = path.join(root, "Main.server.lua");
    const result = await planResourceMove(
      {
        sourcePath,
        sourceKind: "script",
        entryType: "file",
        currentResourceName: "Main",
        targetDirectoryPath: targetRoot,
      },
      fsWithEntries({ [targetRoot]: [] }, [sourcePath], [root, targetRoot]),
    );

    expect(result).toEqual({
      ok: true,
      plan: {
        currentResourceName: "Main",
        targetDirectoryPath: targetRoot,
        targetPath: path.join(targetRoot, "Main.server.lua"),
        moves: [
          {
            sourcePath,
            targetPath: path.join(targetRoot, "Main.server.lua"),
            entryType: "file",
            role: "resource",
          },
        ],
      },
    });
  });

  it("moves directory-backed resources recursively by moving their directory", async () => {
    const sourcePath = path.join(root, "Shared");
    const result = await planResourceMove(
      {
        sourcePath,
        sourceKind: "directory",
        entryType: "directory",
        currentResourceName: "Shared",
        targetDirectoryPath: targetRoot,
      },
      fsWithEntries({ [targetRoot]: [] }, [], [root, sourcePath, targetRoot]),
    );

    expect(result).toEqual({
      ok: true,
      plan: {
        currentResourceName: "Shared",
        targetDirectoryPath: targetRoot,
        targetPath: path.join(targetRoot, "Shared"),
        moves: [
          {
            sourcePath,
            targetPath: path.join(targetRoot, "Shared"),
            entryType: "directory",
            role: "resource",
          },
        ],
      },
    });
  });

  it("moves the containing directory for init script resources", async () => {
    const sourceDirectoryPath = path.join(root, "Controller");
    const sourcePath = path.join(sourceDirectoryPath, "init.lua");
    const result = await planResourceMove(
      {
        sourcePath,
        sourceKind: "initScript",
        entryType: "file",
        currentResourceName: "Controller",
        targetDirectoryPath: targetRoot,
      },
      fsWithEntries({ [targetRoot]: [] }, [sourcePath], [root, sourceDirectoryPath, targetRoot]),
    );

    expect(result).toEqual({
      ok: true,
      plan: {
        currentResourceName: "Controller",
        targetDirectoryPath: targetRoot,
        targetPath: path.join(targetRoot, "Controller"),
        moves: [
          {
            sourcePath: sourceDirectoryPath,
            targetPath: path.join(targetRoot, "Controller"),
            entryType: "directory",
            role: "resource",
          },
        ],
      },
    });
  });

  it("moves sibling meta files with the resource", async () => {
    const sourcePath = path.join(root, "Tool.lua");
    const metaPath = path.join(root, "Tool.meta.json");
    const result = await planResourceMove(
      {
        sourcePath,
        sourceKind: "script",
        entryType: "file",
        currentResourceName: "Tool",
        targetDirectoryPath: targetRoot,
      },
      fsWithEntries({ [targetRoot]: [] }, [sourcePath, metaPath], [root, targetRoot]),
    );

    expect(result).toEqual({
      ok: true,
      plan: {
        currentResourceName: "Tool",
        targetDirectoryPath: targetRoot,
        targetPath: path.join(targetRoot, "Tool.lua"),
        moves: [
          {
            sourcePath,
            targetPath: path.join(targetRoot, "Tool.lua"),
            entryType: "file",
            role: "resource",
          },
          {
            sourcePath: metaPath,
            targetPath: path.join(targetRoot, "Tool.meta.json"),
            entryType: "file",
            role: "meta",
          },
        ],
      },
    });
  });

  it("rejects project-controlled resources", async () => {
    for (const sourceKind of ["project", "projectTree", "projectInclusion"] as const) {
      expect(canMoveSourceKind(sourceKind)).toBe(false);
      const result = await planResourceMove(
        {
          sourcePath: path.join(root, "ReplicatedStorage"),
          sourceKind,
          entryType: "directory",
          currentResourceName: "ReplicatedStorage",
          targetDirectoryPath: targetRoot,
        },
        fsWithEntries({ [targetRoot]: [] }, [], [root, path.join(root, "ReplicatedStorage"), targetRoot]),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("unsupportedResource");
      }
    }
  });

  it("rejects target paths that are not directories", async () => {
    const sourcePath = path.join(root, "Main.server.lua");
    const targetPath = path.join(root, "NotFolder.lua");
    const result = await planResourceMove(
      {
        sourcePath,
        sourceKind: "script",
        entryType: "file",
        currentResourceName: "Main",
        targetDirectoryPath: targetPath,
      },
      fsWithEntries({}, [sourcePath, targetPath], [root]),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("targetNotDirectory");
      expect(result.targetPath).toBe(targetPath);
    }
  });

  it("rejects missing source paths", async () => {
    const sourcePath = path.join(root, "Missing.lua");
    const result = await planResourceMove(
      {
        sourcePath,
        sourceKind: "script",
        entryType: "file",
        currentResourceName: "Missing",
        targetDirectoryPath: targetRoot,
      },
      fsWithEntries({ [targetRoot]: [] }, [], [root, targetRoot]),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("sourceNotFound");
      expect(result.targetPath).toBe(sourcePath);
    }
  });

  it("rejects generated target path conflicts", async () => {
    const sourcePath = path.join(root, "Main.server.lua");
    const targetPath = path.join(targetRoot, "Main.server.lua");
    const result = await planResourceMove(
      {
        sourcePath,
        sourceKind: "script",
        entryType: "file",
        currentResourceName: "Main",
        targetDirectoryPath: targetRoot,
      },
      fsWithEntries(
        { [targetRoot]: [{ name: "Main.server.lua", type: "file" }] },
        [sourcePath, targetPath],
        [root, targetRoot],
      ),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("targetExists");
      expect(result.targetPath).toBe(targetPath);
    }
  });

  it("rejects Rojo resource name conflicts across different filesystem forms", async () => {
    const sourcePath = path.join(root, "Shared.server.lua");
    const conflictingPath = path.join(targetRoot, "Shared.lua");
    const result = await planResourceMove(
      {
        sourcePath,
        sourceKind: "script",
        entryType: "file",
        currentResourceName: "Shared",
        targetDirectoryPath: targetRoot,
      },
      fsWithEntries(
        { [targetRoot]: [{ name: "Shared.lua", type: "file" }] },
        [sourcePath, conflictingPath],
        [root, targetRoot],
      ),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("targetExists");
      expect(result.targetPath).toBe(conflictingPath);
    }
  });

  it("rejects unchanged target directories", async () => {
    const sourcePath = path.join(root, "Main.server.lua");
    const result = await planResourceMove(
      {
        sourcePath,
        sourceKind: "script",
        entryType: "file",
        currentResourceName: "Main",
        targetDirectoryPath: root,
      },
      fsWithEntries({ [root]: [{ name: "Main.server.lua", type: "file" }] }, [sourcePath], [root]),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unchangedTarget");
      expect(result.targetPath).toBe(root);
    }
  });

  it("rejects moving directories into themselves", async () => {
    const sourcePath = path.join(root, "Shared");
    for (const targetDirectoryPath of [sourcePath, path.join(sourcePath, "Child")]) {
      const result = await planResourceMove(
        {
          sourcePath,
          sourceKind: "directory",
          entryType: "directory",
          currentResourceName: "Shared",
          targetDirectoryPath,
        },
        fsWithEntries({ [targetDirectoryPath]: [] }, [], [root, sourcePath, targetDirectoryPath]),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("targetInsideSource");
        expect(result.targetPath).toBe(targetDirectoryPath);
      }
    }
  });

  it("rejects sidecar meta target conflicts", async () => {
    const sourcePath = path.join(root, "Tool.lua");
    const metaPath = path.join(root, "Tool.meta.json");
    const targetMetaPath = path.join(targetRoot, "Tool.meta.json");
    const result = await planResourceMove(
      {
        sourcePath,
        sourceKind: "script",
        entryType: "file",
        currentResourceName: "Tool",
        targetDirectoryPath: targetRoot,
      },
      fsWithEntries({ [targetRoot]: [] }, [sourcePath, metaPath, targetMetaPath], [root, targetRoot]),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("targetExists");
      expect(result.targetPath).toBe(targetMetaPath);
    }
  });
});

const root = path.resolve("project", "src");
const targetRoot = path.resolve("project", "src", "Server");

function fsWithEntries(
  directoryEntries: Record<string, RojoFsEntry[]>,
  files: string[] = [],
  directories: string[] = [root, targetRoot],
) {
  return {
    async readDirectory(directoryPath: string) {
      return directoryEntries[normalizePath(directoryPath)] ?? directoryEntries[directoryPath] ?? [];
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

function normalizePath(filePath: string): string {
  return path.resolve(filePath).toLowerCase();
}

function samePath(left: string, right: string): boolean {
  return normalizePath(left) === normalizePath(right);
}
