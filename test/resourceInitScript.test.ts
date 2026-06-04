import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { getInitScriptResourceKinds, planResourceInitScript } from "../src/resourceInitScript";

describe("resource init script planning", () => {
  it("creates init Script, LocalScript, and ModuleScript files", async () => {
    await expectPlannedInitScript("Script", "init.server.lua", "\n");
    await expectPlannedInitScript("LocalScript", "init.client.lua", "\n");
    await expectPlannedInitScript("ModuleScript", "init.lua", "return {}\n");
  });

  it("lists supported init script resource kinds", () => {
    expect(getInitScriptResourceKinds()).toEqual(["Script", "LocalScript", "ModuleScript"]);
  });

  it("rejects creation under non-directory parents", async () => {
    const result = await planResourceInitScript(
      {
        parentDirectoryPath: folderPath,
        kind: "ModuleScript",
      },
      fsWithExistingFiles([folderPath]),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("parentNotDirectory");
    }
  });

  it("rejects folders that already have an init script", async () => {
    const existingInitPath = path.join(folderPath, "init.client.luau");
    const result = await planResourceInitScript(
      {
        parentDirectoryPath: folderPath,
        kind: "ModuleScript",
      },
      fsWithExistingFiles([existingInitPath], [folderPath]),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("initScriptExists");
      expect(result.targetPath).toBe(existingInitPath);
    }
  });

  it("rejects direct target path conflicts", async () => {
    const targetPath = path.join(folderPath, "init.lua");
    const result = await planResourceInitScript(
      {
        parentDirectoryPath: folderPath,
        kind: "ModuleScript",
      },
      fsWithExistingFiles([targetPath], [folderPath], {
        hideDirectoryEntries: true,
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("targetExists");
      expect(result.targetPath).toBe(targetPath);
    }
  });
});

const folderPath = path.resolve("project", "src", "Controller");

async function expectPlannedInitScript(kind: "Script" | "LocalScript" | "ModuleScript", fileName: string, content: string) {
  const result = await planResourceInitScript(
    {
      parentDirectoryPath: folderPath,
      kind,
    },
    fsWithExistingDirectories([folderPath]),
  );

  expect(result).toEqual({
    ok: true,
    plan: {
      kind,
      targetPath: path.join(folderPath, fileName),
      content,
    },
  });
}

function fsWithExistingDirectories(directories: string[]) {
  return {
    async readDirectory() {
      return [];
    },
    async stat(filePath: string) {
      return directories.includes(filePath) ? ("directory" as const) : undefined;
    },
  };
}

function fsWithExistingFiles(
  files: string[],
  directories: string[] = [],
  options: { hideDirectoryEntries?: boolean } = {},
) {
  return {
    async readDirectory(directoryPath: string) {
      if (options.hideDirectoryEntries) {
        return [];
      }

      return files
        .filter((filePath) => path.dirname(filePath) === directoryPath)
        .map((filePath) => ({ name: path.basename(filePath), type: "file" as const }));
    },
    async stat(filePath: string) {
      if (directories.includes(filePath)) {
        return "directory" as const;
      }

      return files.includes(filePath) ? ("file" as const) : undefined;
    },
  };
}
