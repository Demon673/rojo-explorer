import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { canDeleteSourceKind, planResourceDeletion } from "../src/resourceDeletion";

describe("resource deletion planning", () => {
  it("deletes file-backed resources", async () => {
    const sourcePath = path.join(root, "Main.server.lua");
    const result = await planResourceDeletion(
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
        targets: [
          {
            targetPath: sourcePath,
            entryType: "file",
            role: "resource",
            recursive: false,
          },
        ],
      },
    });
  });

  it("deletes directory-backed resources recursively", async () => {
    const sourcePath = path.join(root, "Shared");
    const result = await planResourceDeletion(
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
        targets: [
          {
            targetPath: sourcePath,
            entryType: "directory",
            role: "resource",
            recursive: true,
          },
        ],
      },
    });
  });

  it("deletes the containing directory for init script resources", async () => {
    const sourcePath = path.join(root, "Controller", "init.lua");
    const sourceDirectoryPath = path.join(root, "Controller");
    const result = await planResourceDeletion(
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
        targets: [
          {
            targetPath: sourceDirectoryPath,
            entryType: "directory",
            role: "resource",
            recursive: true,
          },
        ],
      },
    });
  });

  it("deletes sibling meta files with the resource", async () => {
    const sourcePath = path.join(root, "Tool.lua");
    const metaPath = path.join(root, "Tool.meta.json");
    const result = await planResourceDeletion(
      {
        sourcePath,
        sourceKind: "script",
        entryType: "file",
        currentResourceName: "Tool",
      },
      fsWithExisting({ files: [sourcePath, metaPath] }),
    );

    expect(result).toEqual({
      ok: true,
      plan: {
        currentResourceName: "Tool",
        targets: [
          {
            targetPath: sourcePath,
            entryType: "file",
            role: "resource",
            recursive: false,
          },
          {
            targetPath: metaPath,
            entryType: "file",
            role: "meta",
            recursive: false,
          },
        ],
      },
    });
  });

  it("rejects project-controlled resources", async () => {
    for (const sourceKind of ["project", "projectTree", "projectInclusion"] as const) {
      expect(canDeleteSourceKind(sourceKind)).toBe(false);
      const result = await planResourceDeletion(
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
    const result = await planResourceDeletion(
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
});

const root = path.resolve("project", "src");

function fsWithExisting(existing: { files?: string[]; directories?: string[] }) {
  const files = existing.files ?? [];
  const directories = existing.directories ?? [];
  return {
    async stat(filePath: string) {
      if (files.some((item) => samePath(item, filePath))) {
        return "file" as const;
      }

      if (directories.some((item) => samePath(item, filePath))) {
        return "directory" as const;
      }

      return undefined;
    },
  };
}

function samePath(left: string, right: string): boolean {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}
