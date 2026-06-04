import * as path from "node:path";

import { RojoFileSystem, RojoFsEntryType, RojoSourceKind } from "./domain";
import { inferFileRule } from "./domain/rojoSyncRules";
import { type ScriptResourceKind } from "./resourceCreation";

export type InitScriptResourceKind = ScriptResourceKind;

interface InitScriptDefinition {
  fileName: string;
  content: string;
}

const initScriptDefinitions = {
  Script: {
    fileName: "init.server.lua",
    content: "\n",
  },
  LocalScript: {
    fileName: "init.client.lua",
    content: "\n",
  },
  ModuleScript: {
    fileName: "init.lua",
    content: "return {}\n",
  },
} satisfies Record<InitScriptResourceKind, InitScriptDefinition>;

export interface ResourceInitScriptRequest {
  parentDirectoryPath: string;
  kind: InitScriptResourceKind;
}

export interface ResourceInitScriptPlan {
  kind: InitScriptResourceKind;
  targetPath: string;
  content: string;
}

export interface ResourceInitScriptResult {
  ok: true;
  plan: ResourceInitScriptPlan;
}

export type ResourceInitScriptFailureReason = "parentNotDirectory" | "initScriptExists" | "targetExists";

export interface ResourceInitScriptFailure {
  ok: false;
  reason: ResourceInitScriptFailureReason;
  message: string;
  targetPath?: string;
}

export interface ResourceRemoveInitScriptRequest {
  sourcePath: string;
  sourceKind: RojoSourceKind;
  entryType: RojoFsEntryType;
  currentResourceName: string;
}

export interface ResourceRemoveInitScriptPlan {
  currentResourceName: string;
  targetPath: string;
  recursive: boolean;
}

export interface ResourceRemoveInitScriptResult {
  ok: true;
  plan: ResourceRemoveInitScriptPlan;
}

export type ResourceRemoveInitScriptFailureReason = "sourceNotFound" | "unsupportedResource";

export interface ResourceRemoveInitScriptFailure {
  ok: false;
  reason: ResourceRemoveInitScriptFailureReason;
  message: string;
  targetPath?: string;
}

export async function planResourceInitScript(
  request: ResourceInitScriptRequest,
  fs: Pick<RojoFileSystem, "readDirectory" | "stat">,
): Promise<ResourceInitScriptResult | ResourceInitScriptFailure> {
  const parentType = await fs.stat(request.parentDirectoryPath);
  if (parentType !== "directory") {
    return {
      ok: false,
      reason: "parentNotDirectory",
      message: "Init scripts can only be created under filesystem-backed folders.",
    };
  }

  const existingInitScriptPath = await findExistingInitScript(request.parentDirectoryPath, fs);
  if (existingInitScriptPath) {
    return {
      ok: false,
      reason: "initScriptExists",
      message: "This folder already has an init script.",
      targetPath: existingInitScriptPath,
    };
  }

  const definition = initScriptDefinitions[request.kind];
  const targetPath = path.join(request.parentDirectoryPath, definition.fileName);
  if (await fs.stat(targetPath)) {
    return {
      ok: false,
      reason: "targetExists",
      message: "The init script target path already exists.",
      targetPath,
    };
  }

  return {
    ok: true,
    plan: {
      kind: request.kind,
      targetPath,
      content: definition.content,
    },
  };
}

export function getInitScriptResourceKinds(): InitScriptResourceKind[] {
  return Object.keys(initScriptDefinitions) as InitScriptResourceKind[];
}

export function canRemoveInitScriptSourceKind(kind: RojoSourceKind): boolean {
  return kind === "initScript";
}

export async function planResourceRemoveInitScript(
  request: ResourceRemoveInitScriptRequest,
  fs: Pick<RojoFileSystem, "stat">,
): Promise<ResourceRemoveInitScriptResult | ResourceRemoveInitScriptFailure> {
  if (!canRemoveInitScriptSourceKind(request.sourceKind) || request.entryType !== "file") {
    return {
      ok: false,
      reason: "unsupportedResource",
      message: "This resource is not backed by an init script.",
    };
  }

  const sourceType = await fs.stat(request.sourcePath);
  if (sourceType !== "file") {
    return {
      ok: false,
      reason: "sourceNotFound",
      message: "Init script source path does not exist.",
      targetPath: request.sourcePath,
    };
  }

  return {
    ok: true,
    plan: {
      currentResourceName: request.currentResourceName,
      targetPath: request.sourcePath,
      recursive: false,
    },
  };
}

async function findExistingInitScript(
  parentDirectoryPath: string,
  fs: Pick<RojoFileSystem, "readDirectory">,
): Promise<string | undefined> {
  const entries = await fs.readDirectory(parentDirectoryPath);
  const initScriptEntry = entries.find((entry) => inferFileRule(entry.name, entry.type)?.isInitScript);
  return initScriptEntry ? path.join(parentDirectoryPath, initScriptEntry.name) : undefined;
}
