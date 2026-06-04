import * as path from "node:path";
import { describe, expect, it } from "vitest";

import {
  getMetaBackedDirectoryResourceKinds,
  planResourceCreation,
  type MetaBackedDirectoryResourceKind,
} from "../src/resourceCreation";

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

  it("creates meta-backed directory resources with init.meta.json className", async () => {
    const cases: Array<{
      kind: MetaBackedDirectoryResourceKind;
      resourceName: string;
      className: string;
    }> = [
      { kind: "Model", resourceName: "Weapon", className: "Model" },
      { kind: "RemoteEvent", resourceName: "RoundStarted", className: "RemoteEvent" },
      { kind: "RemoteFunction", resourceName: "GetRoundState", className: "RemoteFunction" },
      { kind: "BindableEvent", resourceName: "RoundChanged", className: "BindableEvent" },
      { kind: "BindableFunction", resourceName: "GetLocalRoundState", className: "BindableFunction" },
      { kind: "BoolValue", resourceName: "IsRoundActive", className: "BoolValue" },
      { kind: "IntValue", resourceName: "RoundCount", className: "IntValue" },
      { kind: "NumberValue", resourceName: "RoundTime", className: "NumberValue" },
      { kind: "ObjectValue", resourceName: "RoundOwner", className: "ObjectValue" },
      { kind: "Vector3Value", resourceName: "SpawnPosition", className: "Vector3Value" },
      { kind: "CFrameValue", resourceName: "SpawnPivot", className: "CFrameValue" },
      { kind: "Color3Value", resourceName: "TeamColor", className: "Color3Value" },
      { kind: "BrickColorValue", resourceName: "SpawnBrickColor", className: "BrickColorValue" },
      { kind: "Configuration", resourceName: "WeaponConfig", className: "Configuration" },
      { kind: "Attachment", resourceName: "GripAttachment", className: "Attachment" },
    ];

    for (const { kind, resourceName, className } of cases) {
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
          targetPath: path.join(root, resourceName),
          entryType: "directory",
          additionalFiles: [
            {
              targetPath: path.join(root, resourceName, "init.meta.json"),
              content: `{\n  "className": "${className}"\n}\n`,
            },
          ],
        },
      });
    }
  });

  it("lists supported meta-backed directory resources for generic instance creation", () => {
    expect(getMetaBackedDirectoryResourceKinds()).toEqual([
      "Model",
      "RemoteEvent",
      "RemoteFunction",
      "BindableEvent",
      "BindableFunction",
      "BoolValue",
      "IntValue",
      "NumberValue",
      "ObjectValue",
      "Vector3Value",
      "CFrameValue",
      "Color3Value",
      "BrickColorValue",
      "Configuration",
      "Attachment",
    ]);
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

  it("creates JSON Modules as JSON files", async () => {
    const result = await planResourceCreation(
      {
        parentDirectoryPath: root,
        resourceName: "Config",
        kind: "JSONModule",
      },
      fsWithExistingDirectories([root]),
    );

    expect(result).toEqual({
      ok: true,
      plan: {
        kind: "JSONModule",
        resourceName: "Config",
        targetPath: path.join(root, "Config.json"),
        entryType: "file",
        content: "{}\n",
      },
    });
  });

  it("creates TOML Modules as TOML files", async () => {
    const result = await planResourceCreation(
      {
        parentDirectoryPath: root,
        resourceName: "Settings",
        kind: "TOMLModule",
      },
      fsWithExistingDirectories([root]),
    );

    expect(result).toEqual({
      ok: true,
      plan: {
        kind: "TOMLModule",
        resourceName: "Settings",
        targetPath: path.join(root, "Settings.toml"),
        entryType: "file",
        content: "",
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

  it("rejects JSON Module name conflicts across different filesystem forms", async () => {
    const result = await planResourceCreation(
      {
        parentDirectoryPath: root,
        resourceName: "Config",
        kind: "JSONModule",
      },
      fsWithEntries([{ name: "Config.lua", type: "file" }], [root]),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("targetExists");
      expect(result.targetPath).toBe(path.join(root, "Config.lua"));
    }
  });

  it("rejects TOML Module name conflicts across different filesystem forms", async () => {
    const result = await planResourceCreation(
      {
        parentDirectoryPath: root,
        resourceName: "Settings",
        kind: "TOMLModule",
      },
      fsWithEntries([{ name: "Settings.json", type: "file" }], [root]),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("targetExists");
      expect(result.targetPath).toBe(path.join(root, "Settings.json"));
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
