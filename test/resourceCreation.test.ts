import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { planResourceCreation } from "../src/resourceCreation";

describe("resource creation planning", () => {
  it("creates folders as directories", async () => {
    const result = await planResourceCreation(
      {
        parentDirectoryPath: root,
        resourceName: "Shared",
        kind: "Folder",
      },
      fsWithExistingDirectories([root]),
    );

    expect(result).toEqual({
      ok: true,
      plan: {
        kind: "Folder",
        resourceName: "Shared",
        targetPath: path.join(root, "Shared"),
        entryType: "directory",
      },
    });
  });

  it("creates Script, LocalScript, and ModuleScript with Rojo file suffixes", async () => {
    await expectPlannedScript("Script", "ServerMain.server.lua", "\n");
    await expectPlannedScript("LocalScript", "ClientMain.client.lua", "\n");
    await expectPlannedScript("ModuleScript", "SharedModule.lua", "return {}\n");
  });

  it("creates Models as directories with init.meta.json className", async () => {
    const result = await planResourceCreation(
      {
        parentDirectoryPath: root,
        resourceName: "Weapon",
        kind: "Model",
      },
      fsWithExistingDirectories([root]),
    );

    expect(result).toEqual({
      ok: true,
      plan: {
        kind: "Model",
        resourceName: "Weapon",
        targetPath: path.join(root, "Weapon"),
        entryType: "directory",
        additionalFiles: [
          {
            targetPath: path.join(root, "Weapon", "init.meta.json"),
            content: "{\n  \"className\": \"Model\"\n}\n",
          },
        ],
      },
    });
  });

  it("creates StringValues as text files", async () => {
    const result = await planResourceCreation(
      {
        parentDirectoryPath: root,
        resourceName: "DisplayName",
        kind: "StringValue",
      },
      fsWithExistingDirectories([root]),
    );

    expect(result).toEqual({
      ok: true,
      plan: {
        kind: "StringValue",
        resourceName: "DisplayName",
        targetPath: path.join(root, "DisplayName.txt"),
        entryType: "file",
        content: "",
      },
    });
  });

  it("creates LocalizationTables as CSV files", async () => {
    const result = await planResourceCreation(
      {
        parentDirectoryPath: root,
        resourceName: "GameText",
        kind: "LocalizationTable",
      },
      fsWithExistingDirectories([root]),
    );

    expect(result).toEqual({
      ok: true,
      plan: {
        kind: "LocalizationTable",
        resourceName: "GameText",
        targetPath: path.join(root, "GameText.csv"),
        entryType: "file",
        content: "Key,Source,Context,Example\n",
      },
    });
  });

  it("rejects empty names and names with path separators", async () => {
    for (const resourceName of ["", "  ", "Bad/Name", "Bad\\Name"]) {
      const result = await planResourceCreation(
        {
          parentDirectoryPath: root,
          resourceName,
          kind: "Folder",
        },
        fsWithExistingDirectories([root]),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("invalidName");
      }
    }
  });

  it("rejects creation under non-directory parents", async () => {
    const result = await planResourceCreation(
      {
        parentDirectoryPath: path.join(root, "Main.server.lua"),
        resourceName: "Child",
        kind: "Folder",
      },
      fsWithExistingFiles([path.join(root, "Main.server.lua")]),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("parentNotDirectory");
    }
  });

  it("rejects generated path conflicts", async () => {
    const result = await planResourceCreation(
      {
        parentDirectoryPath: root,
        resourceName: "Main",
        kind: "Script",
      },
      fsWithExistingFiles([path.join(root, "Main.server.lua")], [root]),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("targetExists");
    }
  });

  it("rejects Model directory conflicts", async () => {
    const result = await planResourceCreation(
      {
        parentDirectoryPath: root,
        resourceName: "Weapon",
        kind: "Model",
      },
      fsWithExistingDirectories([root, path.join(root, "Weapon")]),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("targetExists");
      expect(result.targetPath).toBe(path.join(root, "Weapon"));
    }
  });

  it("rejects StringValue name conflicts across different filesystem forms", async () => {
    const result = await planResourceCreation(
      {
        parentDirectoryPath: root,
        resourceName: "DisplayName",
        kind: "StringValue",
      },
      fsWithEntries([{ name: "DisplayName.lua", type: "file" }], [root]),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("targetExists");
      expect(result.targetPath).toBe(path.join(root, "DisplayName.lua"));
    }
  });

  it("rejects LocalizationTable name conflicts across different filesystem forms", async () => {
    const result = await planResourceCreation(
      {
        parentDirectoryPath: root,
        resourceName: "GameText",
        kind: "LocalizationTable",
      },
      fsWithEntries([{ name: "GameText.txt", type: "file" }], [root]),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("targetExists");
      expect(result.targetPath).toBe(path.join(root, "GameText.txt"));
    }
  });

  it("rejects Rojo resource name conflicts across different filesystem forms", async () => {
    const result = await planResourceCreation(
      {
        parentDirectoryPath: root,
        resourceName: "Shared",
        kind: "Script",
      },
      fsWithEntries([{ name: "Shared.lua", type: "file" }], [root]),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("targetExists");
      expect(result.targetPath).toBe(path.join(root, "Shared.lua"));
    }
  });
});

const root = path.resolve("project", "src");

async function expectPlannedScript(kind: "Script" | "LocalScript" | "ModuleScript", fileName: string, content: string) {
  const resourceName = fileName.split(".")[0];
  const result = await planResourceCreation(
    {
      parentDirectoryPath: root,
      resourceName,
      kind,
    },
    fsWithExistingDirectories([root]),
  );

  expect(result).toEqual({
    ok: true,
    plan: {
      kind,
      resourceName,
      targetPath: path.join(root, fileName),
      entryType: "file",
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

function fsWithExistingFiles(files: string[], directories: string[] = []) {
  return {
    async readDirectory(directoryPath: string) {
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

function fsWithEntries(entries: Array<{ name: string; type: "file" | "directory" }>, directories: string[]) {
  return {
    async readDirectory(directoryPath: string) {
      return directoryPath === root ? entries : [];
    },
    async stat(filePath: string) {
      if (directories.includes(filePath)) {
        return "directory" as const;
      }

      const entry = entries.find((item) => path.join(root, item.name) === filePath);
      return entry?.type;
    },
  };
}
