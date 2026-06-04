import { describe, expect, it } from "vitest";

import { planProjectMappingRename } from "../src/projectMappingRename";

describe("project mapping rename planning", () => {
  it("renames a top-level project tree key", () => {
    const result = planProjectMappingRename(projectContent, {
      projectFilePath: "default.project.json",
      projectTreePath: ["ReplicatedStorage"],
      newName: "SharedStorage",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const parsed = JSON.parse(result.plan.updatedContent);
      expect(parsed.tree.ReplicatedStorage).toBeUndefined();
      expect(parsed.tree.SharedStorage).toEqual({
        $className: "ReplicatedStorage",
        $path: "src/ReplicatedStorage",
      });
      expect(Object.keys(parsed.tree)).toEqual(["$className", "SharedStorage", "StarterPlayer"]);
    }
  });

  it("renames a nested project tree key", () => {
    const result = planProjectMappingRename(projectContent, {
      projectFilePath: "default.project.json",
      projectTreePath: ["StarterPlayer", "StarterPlayerScripts"],
      newName: "StarterCharacterScripts",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const parsed = JSON.parse(result.plan.updatedContent);
      expect(parsed.tree.StarterPlayer.StarterPlayerScripts).toBeUndefined();
      expect(parsed.tree.StarterPlayer.StarterCharacterScripts).toEqual({
        $path: "src/StarterPlayerScripts",
      });
    }
  });

  it("rejects invalid and unchanged names", () => {
    for (const [newName, reason] of [
      ["", "invalidName"],
      ["Bad/Name", "invalidName"],
      ["ReplicatedStorage", "unchangedName"],
    ] as const) {
      const result = planProjectMappingRename(projectContent, {
        projectFilePath: "default.project.json",
        projectTreePath: ["ReplicatedStorage"],
        newName,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe(reason);
      }
    }
  });

  it("rejects duplicate sibling names", () => {
    const result = planProjectMappingRename(projectContent, {
      projectFilePath: "default.project.json",
      projectTreePath: ["ReplicatedStorage"],
      newName: "StarterPlayer",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("targetExists");
    }
  });

  it("rejects missing mappings, root mappings, and invalid project JSON", () => {
    expect(
      planProjectMappingRename(projectContent, {
        projectFilePath: "default.project.json",
        projectTreePath: ["Missing"],
        newName: "StillMissing",
      }),
    ).toMatchObject({ ok: false, reason: "mappingNotFound" });

    expect(
      planProjectMappingRename(projectContent, {
        projectFilePath: "default.project.json",
        projectTreePath: [],
        newName: "Root",
      }),
    ).toMatchObject({ ok: false, reason: "rootMapping" });

    expect(
      planProjectMappingRename("{", {
        projectFilePath: "default.project.json",
        projectTreePath: ["ReplicatedStorage"],
        newName: "SharedStorage",
      }),
    ).toMatchObject({ ok: false, reason: "invalidJson" });
  });
});

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
