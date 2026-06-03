import { basenameWithoutSuffix } from "./pathUtils";
import { RojoFsEntryType, RojoSourceKind } from "./rojoTypes";

export interface RojoFileRuleResult {
  name: string;
  className: string;
  sourceKind: RojoSourceKind;
  isInitScript: boolean;
  isModelLike: boolean;
}

export const knownServiceClassNames = new Set([
  "Workspace",
  "ReplicatedStorage",
  "ServerScriptService",
  "ServerStorage",
  "StarterGui",
  "StarterPack",
  "StarterPlayer",
  "Lighting",
  "SoundService",
  "Teams",
  "Chat",
  "TextChatService",
  "Players",
  "MaterialService",
  "LocalizationService",
  "TestService",
  "HttpService",
  "CollectionService",
  "RunService",
]);

const orderedSuffixes = [
  { suffix: ".server.luau", className: "Script", sourceKind: "script" as const },
  { suffix: ".server.lua", className: "Script", sourceKind: "script" as const },
  { suffix: ".client.luau", className: "LocalScript", sourceKind: "script" as const },
  { suffix: ".client.lua", className: "LocalScript", sourceKind: "script" as const },
  { suffix: ".model.json", className: "Model", sourceKind: "jsonModel" as const, isModelLike: true },
  { suffix: ".luau", className: "ModuleScript", sourceKind: "script" as const },
  { suffix: ".lua", className: "ModuleScript", sourceKind: "script" as const },
  { suffix: ".rbxmx", className: "Model", sourceKind: "model" as const, isModelLike: true },
  { suffix: ".rbxm", className: "Model", sourceKind: "model" as const, isModelLike: true },
  { suffix: ".json", className: "ModuleScript", sourceKind: "jsonModule" as const },
  { suffix: ".toml", className: "ModuleScript", sourceKind: "tomlModule" as const },
  { suffix: ".txt", className: "StringValue", sourceKind: "text" as const },
  { suffix: ".csv", className: "LocalizationTable", sourceKind: "csv" as const },
];

const initScriptRules = [
  { fileName: "init.server.luau", className: "Script" },
  { fileName: "init.server.lua", className: "Script" },
  { fileName: "init.client.luau", className: "LocalScript" },
  { fileName: "init.client.lua", className: "LocalScript" },
  { fileName: "init.luau", className: "ModuleScript" },
  { fileName: "init.lua", className: "ModuleScript" },
];

export function inferFileRule(fileName: string, entryType: RojoFsEntryType): RojoFileRuleResult | undefined {
  if (entryType === "directory") {
    return {
      name: fileName,
      className: "Folder",
      sourceKind: "directory",
      isInitScript: false,
      isModelLike: false,
    };
  }

  const lowerName = fileName.toLowerCase();
  for (const initRule of initScriptRules) {
    if (lowerName === initRule.fileName) {
      return {
        name: "init",
        className: initRule.className,
        sourceKind: "initScript",
        isInitScript: true,
        isModelLike: false,
      };
    }
  }

  if (isMetaFile(fileName) || isProjectFile(fileName)) {
    return undefined;
  }

  for (const rule of orderedSuffixes) {
    if (lowerName.endsWith(rule.suffix)) {
      return {
        name: basenameWithoutSuffix(fileName, rule.suffix),
        className: rule.className,
        sourceKind: rule.sourceKind,
        isInitScript: false,
        isModelLike: Boolean(rule.isModelLike),
      };
    }
  }

  return undefined;
}

export function isMetaFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".meta.json");
}

export function isInitMetaFile(fileName: string): boolean {
  return fileName.toLowerCase() === "init.meta.json";
}

export function isProjectFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".project.json");
}

export function isDefaultProjectFile(fileName: string): boolean {
  return fileName.toLowerCase() === "default.project.json";
}

export function getMetaTargetName(fileName: string): string | undefined {
  if (!isMetaFile(fileName) || isInitMetaFile(fileName)) {
    return undefined;
  }

  return fileName.slice(0, fileName.length - ".meta.json".length);
}
