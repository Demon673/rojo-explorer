import * as path from "node:path";

import { RojoFileSystem, RojoFsEntryType, RojoSourceKind } from "./domain";

export interface ResourceMetaRequest {
  sourcePath: string;
  sourceKind: RojoSourceKind;
  entryType: RojoFsEntryType;
  currentResourceName: string;
}

export interface ResourceMetaPlan {
  currentResourceName: string;
  metaPath: string;
  exists: boolean;
  content?: string;
}

export interface ResourceMetaResult {
  ok: true;
  plan: ResourceMetaPlan;
}

export type ResourceMetaFailureReason =
  | "sourceNotFound"
  | "unsupportedResource"
  | "targetExists";

export interface ResourceMetaFailure {
  ok: false;
  reason: ResourceMetaFailureReason;
  message: string;
  targetPath?: string;
}

const metaEditableSourceKinds = new Set<RojoSourceKind>([
  "directory",
  "script",
  "initScript",
  "model",
  "jsonModel",
  "jsonModule",
  "tomlModule",
  "text",
  "csv",
]);

export function canEditMetaSourceKind(kind: RojoSourceKind): boolean {
  return metaEditableSourceKinds.has(kind);
}

export async function planResourceMeta(
  request: ResourceMetaRequest,
  fs: Pick<RojoFileSystem, "stat">,
): Promise<ResourceMetaResult | ResourceMetaFailure> {
  if (!canEditMetaSourceKind(request.sourceKind)) {
    return {
      ok: false,
      reason: "unsupportedResource",
      message: "This resource metadata cannot be edited safely yet.",
    };
  }

  const primarySource = createPrimarySource(request);
  const sourceType = await fs.stat(primarySource.sourcePath);
  if (sourceType !== primarySource.entryType) {
    return {
      ok: false,
      reason: "sourceNotFound",
      message: "Source path does not exist.",
      targetPath: primarySource.sourcePath,
    };
  }

  const metaPath = path.join(path.dirname(primarySource.sourcePath), `${request.currentResourceName}.meta.json`);
  const metaType = await fs.stat(metaPath);
  if (metaType === "directory") {
    return {
      ok: false,
      reason: "targetExists",
      message: "A directory already exists where the meta file would be created.",
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

function createPrimarySource(request: ResourceMetaRequest): { sourcePath: string; entryType: RojoFsEntryType } {
  if (request.sourceKind === "initScript") {
    return {
      sourcePath: path.dirname(request.sourcePath),
      entryType: "directory",
    };
  }

  return {
    sourcePath: request.sourcePath,
    entryType: request.entryType,
  };
}
