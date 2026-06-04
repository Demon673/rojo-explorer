import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { canEditMetaSourceKind, planResourceMeta } from "../src/resourceMeta";

describe("resource meta planning", () => {
  it("creates sibling meta files for file-backed resources", async () => {
    const sourcePath = path.join(root, "Main.server.lua");
    const result = await planResourceMeta(
      {
        sourcePath,
        sourceKind: "script",
        entryType: "file",
        currentResourceName: "Main",
      },
      fsWithExisting({ files: [sourcePath] }),
    );

    expect(result).toEqual({
      ok: true,
      plan: {
        currentResourceName: "Main",
        metaPath: path.join(root, "Main.meta.json"),
        exists: false,
        content: "{}\n",
      },
    });
  });

  it("opens existing sibling meta files", async () => {
    const sourcePath = path.join(root, "Main.server.lua");
    const metaPath = path.join(root, "Main.meta.json");
    const result = await planResourceMeta(
      {
        sourcePath,
        sourceKind: "script",
        entryType: "file",
        currentResourceName: "Main",
      },
      fsWithExisting({ files: [sourcePath, metaPath] }),
    );

    expect(result).toEqual({
      ok: true,
      plan: {
        currentResourceName: "Main",
        metaPath,
        exists: true,
        content: undefined,
      },
    });
  });

  it("creates sibling meta files for directory-backed resources", async () => {
    const sourcePath = path.join(root, "Shared");
    const result = await planResourceMeta(
      {
        sourcePath,
        sourceKind: "directory",
        entryType: "directory",
        currentResourceName: "Shared",
      },
      fsWithExisting({ directories: [sourcePath] }),
    );

    expect(result).toMatchObject({
      ok: true,
      plan: {
        metaPath: path.join(root, "Shared.meta.json"),
        exists: false,
      },
    });
  });

  it("creates sibling meta files next to the containing directory for init script resources", async () => {
    const sourceDirectoryPath = path.join(root, "Controller");
    const sourcePath = path.join(sourceDirectoryPath, "init.lua");
    const result = await planResourceMeta(
      {
        sourcePath,
        sourceKind: "initScript",
        entryType: "file",
        currentResourceName: "Controller",
      },
      fsWithExisting({ files: [sourcePath], directories: [sourceDirectoryPath] }),
    );

    expect(result).toMatchObject({
      ok: true,
      plan: {
        metaPath: path.join(root, "Controller.meta.json"),
        exists: false,
      },
    });
  });

  it("rejects project-controlled resources", async () => {
    for (const sourceKind of ["project", "projectTree", "projectInclusion"] as const) {
      expect(canEditMetaSourceKind(sourceKind)).toBe(false);
      const result = await planResourceMeta(
        {
          sourcePath: path.join(root, "ReplicatedStorage"),
          sourceKind,
          entryType: "directory",
          currentResourceName: "ReplicatedStorage",
        },
        fsWithExisting({ directories: [path.join(root, "ReplicatedStorage")] }),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("unsupportedResource");
      }
    }
  });

  it("rejects missing source paths", async () => {
    const sourcePath = path.join(root, "Missing.lua");
    const result = await planResourceMeta(
      {
        sourcePath,
        sourceKind: "script",
        entryType: "file",
        currentResourceName: "Missing",
      },
      fsWithExisting({ files: [] }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("sourceNotFound");
      expect(result.targetPath).toBe(sourcePath);
    }
  });

  it("rejects when a directory blocks the meta file path", async () => {
    const sourcePath = path.join(root, "Main.server.lua");
    const metaPath = path.join(root, "Main.meta.json");
    const result = await planResourceMeta(
      {
        sourcePath,
        sourceKind: "script",
        entryType: "file",
        currentResourceName: "Main",
      },
      fsWithExisting({ files: [sourcePath], directories: [metaPath] }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("targetExists");
      expect(result.targetPath).toBe(metaPath);
    }
  });
});

const root = path.resolve("project", "src");

function fsWithExisting(existing: { files?: string[]; directories?: string[] }) {
  const files = existing.files ?? [];
  const directories = existing.directories ?? [root];
  return {
    async stat(filePath: string) {
      if (directories.some((item) => samePath(item, filePath))) {
        return "directory" as const;
      }

      if (files.some((item) => samePath(item, filePath))) {
        return "file" as const;
      }

      return undefined;
    },
  };
}

function samePath(left: string, right: string): boolean {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}
