import * as path from "node:path";

import { RojoFileSystem, RojoFsEntryType } from "./domain";
import { inferFileRule } from "./domain/rojoSyncRules";

export type CreatableResourceKind =
  | "Folder"
  | "Script"
  | "LocalScript"
  | "ModuleScript"
  | "Model"
  | "StringValue"
  | "LocalizationTable";

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
  switch (kind) {
    case "Folder":
      return {
        kind,
        resourceName,
        targetPath: path.join(parentDirectoryPath, resourceName),
        entryType: "directory",
      };
    case "Model": {
      const targetPath = path.join(parentDirectoryPath, resourceName);
      return {
        kind,
        resourceName,
        targetPath,
        entryType: "directory",
        additionalFiles: [
          {
            targetPath: path.join(targetPath, "init.meta.json"),
            content: JSON.stringify({ className: "Model" }, null, 2) + "\n",
          },
        ],
      };
    }
    case "StringValue":
      return {
        kind,
        resourceName,
        targetPath: path.join(parentDirectoryPath, `${resourceName}.txt`),
        entryType: "file",
        content: "",
      };
    case "LocalizationTable":
      return {
        kind,
        resourceName,
        targetPath: path.join(parentDirectoryPath, `${resourceName}.csv`),
        entryType: "file",
        content: "Key,Source,Context,Example\n",
      };
    case "Script":
      return scriptPlan(parentDirectoryPath, resourceName, kind, ".server.lua");
    case "LocalScript":
      return scriptPlan(parentDirectoryPath, resourceName, kind, ".client.lua");
    case "ModuleScript":
      return scriptPlan(parentDirectoryPath, resourceName, kind, ".lua");
  }
}

function scriptPlan(
  parentDirectoryPath: string,
  resourceName: string,
  kind: Exclude<CreatableResourceKind, "Folder" | "Model" | "StringValue" | "LocalizationTable">,
  suffix: string,
): ResourceCreationPlan {
  return {
    kind,
    resourceName,
    targetPath: path.join(parentDirectoryPath, `${resourceName}${suffix}`),
    entryType: "file",
    content: defaultScriptContent(kind),
  };
}

function defaultScriptContent(kind: Exclude<CreatableResourceKind, "Folder" | "Model" | "StringValue" | "LocalizationTable">): string {
  if (kind === "ModuleScript") {
    return "return {}\n";
  }

  return "\n";
}

function isValidResourceName(name: string): boolean {
  return name.length > 0 && !name.includes("/") && !name.includes("\\");
}
