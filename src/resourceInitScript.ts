import * as path from "node:path";

import { RojoFileSystem } from "./domain";
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

async function findExistingInitScript(
  parentDirectoryPath: string,
  fs: Pick<RojoFileSystem, "readDirectory">,
): Promise<string | undefined> {
  const entries = await fs.readDirectory(parentDirectoryPath);
  const initScriptEntry = entries.find((entry) => inferFileRule(entry.name, entry.type)?.isInitScript);
  return initScriptEntry ? path.join(parentDirectoryPath, initScriptEntry.name) : undefined;
}
