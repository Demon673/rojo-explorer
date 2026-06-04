import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { canEditInitMetaSourceKind, planResourceInitMeta } from "../src/resourceInitMeta";

describe("resource init meta planning", () => {
  it("creates init.meta.json inside directory-backed resources", async () => {
    const sourcePath = path.join(root, "Shared");
    const result = await planResourceInitMeta(
      {
        sourcePath,
        sourceKind: "directory",
        entryType: "directory",
        currentResourceName: "Shared",
      },
      fsWithExisting({ directories: [sourcePath] }),
    );

    expect(result).toEqual({
      ok: true,
      plan: {
        currentResourceName: "Shared",
        metaPath: path.join(sourcePath, "init.meta.json"),
        exists: false,
        content: "{}\n",
      },
    });
  });

  it("opens existing init.meta.json files", async () => {
    const sourcePath = path.join(root, "Shared");
    const metaPath = path.join(sourcePath, "init.meta.json");
    const result = await planResourceInitMeta(
      {
        sourcePath,
        sourceKind: "directory",
        entryType: "directory",
        currentResourceName: "Shared",
      },
      fsWithExisting({ files: [metaPath], directories: [sourcePath] }),
    );

    expect(result).toEqual({
      ok: true,
      plan: {
        currentResourceName: "Shared",
        metaPath,
        exists: true,
        content: undefined,
      },
    });
  });

  it("creates init.meta.json next to init scripts", async () => {
    const sourceDirectoryPath = path.join(root, "Controller");
    const sourcePath = path.join(sourceDirectoryPath, "init.lua");
    const result = await planResourceInitMeta(
      {
        sourcePath,
        sourceKind: "initScript",
        entryType: "file",
        currentResourceName: "Controller",
      },
      fsWithExisting({ files: [sourcePath], directories: [sourceDirectoryPath] }),
    );

    expect(result).toEqual({
      ok: true,
      plan: {
        currentResourceName: "Controller",
        metaPath: path.join(sourceDirectoryPath, "init.meta.json"),
        exists: false,
        content: "{}\n",
      },
    });
  });

  it("rejects non-directory filesystem resources", async () => {
    const sourcePath = path.join(root, "Main.server.lua");
    expect(canEditInitMetaSourceKind("script")).toBe(false);

    const result = await planResourceInitMeta(
      {
        sourcePath,
        sourceKind: "script",
        entryType: "file",
        currentResourceName: "Main",
      },
      fsWithExisting({ files: [sourcePath] }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unsupportedResource");
    }
  });

  it("rejects project-controlled resources", async () => {
    for (const sourceKind of ["project", "projectTree", "projectInclusion"] as const) {
      expect(canEditInitMetaSourceKind(sourceKind)).toBe(false);

      const result = await planResourceInitMeta(
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

  it("rejects missing source directories", async () => {
    const sourcePath = path.join(root, "Missing");
    const result = await planResourceInitMeta(
      {
        sourcePath,
        sourceKind: "directory",
        entryType: "directory",
        currentResourceName: "Missing",
      },
      fsWithExisting({ directories: [] }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("sourceNotFound");
      expect(result.targetPath).toBe(sourcePath);
    }
  });

  it("rejects init scripts with missing containing directories", async () => {
    const sourceDirectoryPath = path.join(root, "Controller");
    const sourcePath = path.join(sourceDirectoryPath, "init.lua");
    const result = await planResourceInitMeta(
      {
        sourcePath,
        sourceKind: "initScript",
        entryType: "file",
        currentResourceName: "Controller",
      },
      fsWithExisting({ files: [sourcePath], directories: [] }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("sourceNotFound");
      expect(result.targetPath).toBe(sourceDirectoryPath);
    }
  });

  it("rejects missing init script source files", async () => {
    const sourceDirectoryPath = path.join(root, "Controller");
    const sourcePath = path.join(sourceDirectoryPath, "init.lua");
    const result = await planResourceInitMeta(
      {
        sourcePath,
        sourceKind: "initScript",
        entryType: "file",
        currentResourceName: "Controller",
      },
      fsWithExisting({ directories: [sourceDirectoryPath] }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("sourceNotFound");
      expect(result.targetPath).toBe(sourcePath);
    }
  });

  it("rejects when a directory blocks the init meta file path", async () => {
    const sourcePath = path.join(root, "Shared");
    const metaPath = path.join(sourcePath, "init.meta.json");
    const result = await planResourceInitMeta(
      {
        sourcePath,
        sourceKind: "directory",
        entryType: "directory",
        currentResourceName: "Shared",
      },
      fsWithExisting({ directories: [sourcePath, metaPath] }),
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
