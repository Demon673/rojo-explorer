import * as path from "node:path";

import { RojoFileSystem, RojoFsEntryType } from "./domain";
import { inferFileRule } from "./domain/rojoSyncRules";

export type CreatableResourceKind =
  | "Folder"
  | ScriptResourceKind
  | MetaBackedDirectoryResourceKind
  | FileBackedResourceKind;

export type ScriptResourceKind = "Script" | "LocalScript" | "ModuleScript";

export type MetaBackedDirectoryResourceKind =
  | "Model"
  | "RemoteEvent"
  | "RemoteFunction"
  | "BindableEvent"
  | "BindableFunction"
  | "BoolValue"
  | "IntValue"
  | "NumberValue"
  | "ObjectValue"
  | "Vector3Value"
  | "CFrameValue";

export type FileBackedResourceKind = "StringValue" | "LocalizationTable" | "JSONModule" | "TOMLModule";

interface FileResourceDefinition {
  suffix: string;
  content: string;
}

const scriptResourceDefinitions = {
  Script: {
    suffix: ".server.lua",
    content: "\n",
  },
  LocalScript: {
    suffix: ".client.lua",
    content: "\n",
  },
  ModuleScript: {
    suffix: ".lua",
    content: "return {}\n",
  },
} satisfies Record<ScriptResourceKind, FileResourceDefinition>;

const metaBackedDirectoryResourceClassNames = {
  Model: "Model",
  RemoteEvent: "RemoteEvent",
  RemoteFunction: "RemoteFunction",
  BindableEvent: "BindableEvent",
  BindableFunction: "BindableFunction",
  BoolValue: "BoolValue",
  IntValue: "IntValue",
  NumberValue: "NumberValue",
  ObjectValue: "ObjectValue",
  Vector3Value: "Vector3Value",
  CFrameValue: "CFrameValue",
} satisfies Record<MetaBackedDirectoryResourceKind, string>;

const fileBackedResourceDefinitions = {
  StringValue: {
    suffix: ".txt",
    content: "",
  },
  LocalizationTable: {
    suffix: ".csv",
    content: "Key,Source,Context,Example\n",
  },
  JSONModule: {
    suffix: ".json",
    content: "{}\n",
  },
  TOMLModule: {
    suffix: ".toml",
    content: "",
  },
} satisfies Record<FileBackedResourceKind, FileResourceDefinition>;

export function getMetaBackedDirectoryResourceKinds(): MetaBackedDirectoryResourceKind[] {
  return Object.keys(metaBackedDirectoryResourceClassNames) as MetaBackedDirectoryResourceKind[];
}

export interface ResourceCreationRequest {
  parentDirectoryPath: string;
  resourceName: string;
  kind: CreatableResourceKind;
}

export interface ResourceCreationPlan {
  kind: CreatableResourceKind;
  resourceName: string;
  targetPath: string;
  entryType: RojoFsEntryType;
  content?: string;
  additionalFiles?: ResourceCreationFile[];
}

export interface ResourceCreationFile {
  targetPath: string;
  content: string;
}

export interface ResourceCreationResult {
  ok: true;
  plan: ResourceCreationPlan;
}

export interface ResourceCreationFailure {
  ok: false;
  reason: "invalidName" | "parentNotDirectory" | "targetExists";
  message: string;
  targetPath?: string;
}

export async function planResourceCreation(
  request: ResourceCreationRequest,
  fs: Pick<RojoFileSystem, "readDirectory" | "stat">,
): Promise<ResourceCreationResult | ResourceCreationFailure> {
  const normalizedName = request.resourceName.trim();
  if (!isValidResourceName(normalizedName)) {
    return {
      ok: false,
      reason: "invalidName",
      message: "Resource names cannot be empty or contain path separators.",
    };
  }

  const parentType = await fs.stat(request.parentDirectoryPath);
  if (parentType !== "directory") {
    return {
      ok: false,
      reason: "parentNotDirectory",
      message: "Resources can only be created under filesystem-backed directories.",
    };
  }

  const plan = createPlan(request.parentDirectoryPath, normalizedName, request.kind);
  const conflictPath = await findRojoNameConflict(plan, fs);
  if (conflictPath) {
    return {
      ok: false,
      reason: "targetExists",
      message: "A resource with that Rojo name already exists.",
      targetPath: conflictPath,
    };
  }

  return {
    ok: true,
    plan,
  };
}

async function findRojoNameConflict(
  plan: ResourceCreationPlan,
  fs: Pick<RojoFileSystem, "readDirectory" | "stat">,
): Promise<string | undefined> {
  if (await fs.stat(plan.targetPath)) {
    return plan.targetPath;
  }

  const parentDirectoryPath = path.dirname(plan.targetPath);
  const entries = await fs.readDirectory(parentDirectoryPath);
  const plannedName = plan.resourceName.toLowerCase();

  for (const entry of entries) {
    const rule = inferFileRule(entry.name, entry.type);
    if (rule?.name.toLowerCase() === plannedName) {
      return path.join(parentDirectoryPath, entry.name);
    }
  }

  return undefined;
}

export function createPlan(parentDirectoryPath: string, resourceName: string, kind: CreatableResourceKind): ResourceCreationPlan {
  if (kind === "Folder") {
    return {
      kind,
      resourceName,
      targetPath: path.join(parentDirectoryPath, resourceName),
      entryType: "directory",
    };
  }

  if (isMetaBackedDirectoryResourceKind(kind)) {
    return metaBackedDirectoryPlan(parentDirectoryPath, resourceName, kind, metaBackedDirectoryResourceClassNames[kind]);
  }

  if (isScriptResourceKind(kind)) {
    const definition = scriptResourceDefinitions[kind];
    return filePlan(parentDirectoryPath, resourceName, kind, definition);
  }

  const definition = fileBackedResourceDefinitions[kind];
  return filePlan(parentDirectoryPath, resourceName, kind, definition);
}

function filePlan(
  parentDirectoryPath: string,
  resourceName: string,
  kind: ScriptResourceKind | FileBackedResourceKind,
  definition: FileResourceDefinition,
): ResourceCreationPlan {
  return {
    kind,
    resourceName,
    targetPath: path.join(parentDirectoryPath, `${resourceName}${definition.suffix}`),
    entryType: "file",
    content: definition.content,
  };
}

function metaBackedDirectoryPlan(
  parentDirectoryPath: string,
  resourceName: string,
  kind: MetaBackedDirectoryResourceKind,
  className: string,
): ResourceCreationPlan {
  const targetPath = path.join(parentDirectoryPath, resourceName);
  return {
    kind,
    resourceName,
    targetPath,
    entryType: "directory",
    additionalFiles: [
      {
        targetPath: path.join(targetPath, "init.meta.json"),
        content: JSON.stringify({ className }, null, 2) + "\n",
      },
    ],
  };
}

function isValidResourceName(name: string): boolean {
  return name.length > 0 && !name.includes("/") && !name.includes("\\");
}

function isScriptResourceKind(kind: CreatableResourceKind): kind is ScriptResourceKind {
  return kind in scriptResourceDefinitions;
}

function isMetaBackedDirectoryResourceKind(kind: CreatableResourceKind): kind is MetaBackedDirectoryResourceKind {
  return kind in metaBackedDirectoryResourceClassNames;
}
