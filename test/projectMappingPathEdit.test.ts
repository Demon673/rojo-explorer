import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { planProjectMappingPathEdit } from "../src/projectMappingPathEdit";

describe("project mapping path edit planning", () => {
  it("changes a top-level project mapping $path to a relative Rojo path", async () => {
    const newPath = path.join(projectRoot, "src", "SharedStorage");
    const result = await planProjectMappingPathEdit(
      projectContent,
      {
        projectFilePath,
        projectTreePath: ["ReplicatedStorage"],
        newSourcePath: newPath,
      },
      fsWithExisting({ directories: [newPath] }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const parsed = JSON.parse(result.plan.updatedContent);
      expect(parsed.tree.ReplicatedStorage.$path).toBe("src/SharedStorage");
      expect(result.plan).toMatchObject({
        projectFilePath,
        mappingName: "ReplicatedStorage",
        currentPath: path.join(projectRoot, "src", "ReplicatedStorage"),
        newPath,
        pathValue: "src/SharedStorage",
        targetEntryType: "directory",
      });
    }
  });

  it("changes a nested project mapping $path", async () => {
    const newPath = path.join(projectRoot, "client", "StarterPlayerScripts");
    const result = await planProjectMappingPathEdit(
      projectContent,
      {
        projectFilePath,
        projectTreePath: ["StarterPlayer", "StarterPlayerScripts"],
        newSourcePath: newPath,
      },
      fsWithExisting({ directories: [newPath] }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const parsed = JSON.parse(result.plan.updatedContent);
      expect(parsed.tree.StarterPlayer.StarterPlayerScripts.$path).toBe("client/StarterPlayerScripts");
    }
  });

  it("allows supported file-backed Rojo resources", async () => {
    const newPath = path.join(projectRoot, "src", "ServerMain.server.lua");
    const result = await planProjectMappingPathEdit(
      projectContent,
      {
        projectFilePath,
        projectTreePath: ["ReplicatedStorage"],
        newSourcePath: newPath,
      },
      fsWithExisting({ files: [newPath] }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const parsed = JSON.parse(result.plan.updatedContent);
      expect(parsed.tree.ReplicatedStorage.$path).toBe("src/ServerMain.server.lua");
      expect(result.plan.targetEntryType).toBe("file");
    }
  });

  it("writes dot when the selected path is the project root", async () => {
    const result = await planProjectMappingPathEdit(
      projectContent,
      {
        projectFilePath,
        projectTreePath: ["ReplicatedStorage"],
        newSourcePath: projectRoot,
      },
      fsWithExisting({ directories: [projectRoot] }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const parsed = JSON.parse(result.plan.updatedContent);
      expect(parsed.tree.ReplicatedStorage.$path).toBe(".");
      expect(result.plan.pathValue).toBe(".");
    }
  });

  it("rejects invalid project JSON and missing mappings", async () => {
    await expect(
      planProjectMappingPathEdit(
        "{",
        {
          projectFilePath,
          projectTreePath: ["ReplicatedStorage"],
          newSourcePath: path.join(projectRoot, "src", "SharedStorage"),
        },
        fsWithExisting({}),
      ),
    ).resolves.toMatchObject({ ok: false, reason: "invalidJson" });

    await expect(
      planProjectMappingPathEdit(
        projectContent,
        {
          projectFilePath,
          projectTreePath: ["Missing"],
          newSourcePath: path.join(projectRoot, "src", "SharedStorage"),
        },
        fsWithExisting({}),
      ),
    ).resolves.toMatchObject({ ok: false, reason: "mappingNotFound" });
  });

  it("rejects mappings without a $path value", async () => {
    const result = await planProjectMappingPathEdit(
      projectContent,
      {
        projectFilePath,
        projectTreePath: ["StarterPlayer"],
        newSourcePath: path.join(projectRoot, "src", "StarterPlayer"),
      },
      fsWithExisting({ directories: [path.join(projectRoot, "src", "StarterPlayer")] }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("mappingHasNoPath");
    }
  });

  it("rejects missing selected source paths", async () => {
    const missingPath = path.join(projectRoot, "src", "Missing");
    const result = await planProjectMappingPathEdit(
      projectContent,
      {
        projectFilePath,
        projectTreePath: ["ReplicatedStorage"],
        newSourcePath: missingPath,
      },
      fsWithExisting({}),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("targetNotFound");
      expect(result.targetPath).toBe(missingPath);
    }
  });

  it("rejects unsupported selected source files", async () => {
    const unsupportedPath = path.join(projectRoot, "src", "Tool.meta.json");
    const result = await planProjectMappingPathEdit(
      projectContent,
      {
        projectFilePath,
        projectTreePath: ["ReplicatedStorage"],
        newSourcePath: unsupportedPath,
      },
      fsWithExisting({ files: [unsupportedPath] }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unsupportedPathType");
      expect(result.targetPath).toBe(unsupportedPath);
    }
  });

  it("rejects unchanged source paths", async () => {
    const currentPath = path.join(projectRoot, "src", "ReplicatedStorage");
    const result = await planProjectMappingPathEdit(
      projectContent,
      {
        projectFilePath,
        projectTreePath: ["ReplicatedStorage"],
        newSourcePath: currentPath,
      },
      fsWithExisting({ directories: [currentPath] }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unchangedPath");
      expect(result.targetPath).toBe(currentPath);
    }
  });
});

const projectRoot = path.resolve("project");
const projectFilePath = path.join(projectRoot, "default.project.json");
const projectContent = JSON.stringify(
  {
    name: "Game",
    tree: {
      $className: "DataModel",
      ReplicatedStorage: {
        $className: "ReplicatedStorage",
        $path: "src/ReplicatedStorage",
      },
      StarterPlayer: {
        $className: "StarterPlayer",
        StarterPlayerScripts: {
          $path: "src/StarterPlayerScripts",
        },
      },
    },
  },
  null,
  2,
);

function fsWithExisting(existing: { files?: string[]; directories?: string[] }) {
  const files = existing.files ?? [];
  const directories = existing.directories ?? [];
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
