import * as path from "node:path";

import { RojoFileSystem, RojoFsEntryType, RojoSourceKind } from "./domain";

export interface ResourceInitMetaRequest {
  sourcePath: string;
  sourceKind: RojoSourceKind;
  entryType: RojoFsEntryType;
  currentResourceName: string;
}

export interface ResourceInitMetaPlan {
  currentResourceName: string;
  metaPath: string;
  exists: boolean;
  content?: string;
}

export interface ResourceInitMetaResult {
  ok: true;
  plan: ResourceInitMetaPlan;
}

export type ResourceInitMetaFailureReason =
  | "sourceNotFound"
  | "unsupportedResource"
  | "targetExists";

export interface ResourceInitMetaFailure {
  ok: false;
  reason: ResourceInitMetaFailureReason;
  message: string;
  targetPath?: string;
}

const initMetaEditableSourceKinds = new Set<RojoSourceKind>(["directory", "initScript"]);

export function canEditInitMetaSourceKind(kind: RojoSourceKind): boolean {
  return initMetaEditableSourceKinds.has(kind);
}

export async function planResourceInitMeta(
  request: ResourceInitMetaRequest,
  fs: Pick<RojoFileSystem, "stat">,
): Promise<ResourceInitMetaResult | ResourceInitMetaFailure> {
  if (!canEditInitMetaSourceKind(request.sourceKind)) {
    return {
      ok: false,
      reason: "unsupportedResource",
      message: "This resource init metadata cannot be edited safely yet.",
    };
  }

  if (request.sourceKind === "initScript") {
    const sourceType = await fs.stat(request.sourcePath);
    if (sourceType !== "file") {
      return {
        ok: false,
        reason: "sourceNotFound",
        message: "Source path does not exist.",
        targetPath: request.sourcePath,
      };
    }
  }

  const sourceDirectoryPath = getSourceDirectoryPath(request);
  const sourceType = await fs.stat(sourceDirectoryPath);
  if (sourceType !== "directory") {
    return {
      ok: false,
      reason: "sourceNotFound",
      message: "Source path does not exist.",
      targetPath: sourceDirectoryPath,
    };
  }

  const metaPath = path.join(sourceDirectoryPath, "init.meta.json");
  const metaType = await fs.stat(metaPath);
  if (metaType === "directory") {
    return {
      ok: false,
      reason: "targetExists",
      message: "A directory already exists where the init meta file would be created.",
      targetPath: metaPath,
    };
  }

  return {
    ok: true,
    plan: {
      currentResourceName: request.currentResourceName,
      metaPath,
      exists: metaType === "file",
      content: metaType === "file" ? undefined : "{}\n",
    },
  };
}

function getSourceDirectoryPath(request: ResourceInitMetaRequest): string {
  return request.sourceKind === "initScript"
    ? path.dirname(request.sourcePath)
    : request.sourcePath;
}
