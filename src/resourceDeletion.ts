import * as path from "node:path";

import { RojoFileSystem, RojoFsEntryType, RojoSourceKind } from "./domain";

export interface ResourceDeletionRequest {
  sourcePath: string;
  sourceKind: RojoSourceKind;
  entryType: RojoFsEntryType;
  currentResourceName: string;
}

export interface ResourceDeletionTarget {
  targetPath: string;
  entryType: RojoFsEntryType;
  role: "resource" | "meta";
  recursive: boolean;
}

export interface ResourceDeletionPlan {
  currentResourceName: string;
  targets: ResourceDeletionTarget[];
}

export interface ResourceDeletionResult {
  ok: true;
  plan: ResourceDeletionPlan;
}

export type ResourceDeletionFailureReason = "sourceNotFound" | "unsupportedResource";

export interface ResourceDeletionFailure {
  ok: false;
  reason: ResourceDeletionFailureReason;
  message: string;
  targetPath?: string;
}

const deletableSourceKinds = new Set<RojoSourceKind>([
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

export function canDeleteSourceKind(kind: RojoSourceKind): boolean {
  return deletableSourceKinds.has(kind);
}

export async function planResourceDeletion(
  request: ResourceDeletionRequest,
  fs: Pick<RojoFileSystem, "stat">,
): Promise<ResourceDeletionResult | ResourceDeletionFailure> {
  if (!canDeleteSourceKind(request.sourceKind)) {
    return {
      ok: false,
      reason: "unsupportedResource",
      message: "This resource cannot be deleted safely yet.",
    };
  }

  const primaryTarget = createPrimaryDeletionTarget(request);
  const primaryType = await fs.stat(primaryTarget.targetPath);
  if (primaryType !== primaryTarget.entryType) {
    return {
      ok: false,
      reason: "sourceNotFound",
      message: "Source path does not exist.",
      targetPath: primaryTarget.targetPath,
    };
  }

  const sidecarMetaTarget = await createSidecarMetaDeletionTarget(request.currentResourceName, primaryTarget, fs);

  return {
    ok: true,
    plan: {
      currentResourceName: request.currentResourceName,
      targets: [primaryTarget, ...(sidecarMetaTarget ? [sidecarMetaTarget] : [])],
    },
  };
}

function createPrimaryDeletionTarget(request: ResourceDeletionRequest): ResourceDeletionTarget {
  if (request.sourceKind === "initScript") {
    return {
      targetPath: path.dirname(request.sourcePath),
      entryType: "directory",
      role: "resource",
      recursive: true,
    };
  }

  return {
    targetPath: request.sourcePath,
    entryType: request.entryType,
    role: "resource",
    recursive: request.entryType === "directory",
  };
}

async function createSidecarMetaDeletionTarget(
  currentResourceName: string,
  primaryTarget: ResourceDeletionTarget,
  fs: Pick<RojoFileSystem, "stat">,
): Promise<ResourceDeletionTarget | undefined> {
  const targetPath = path.join(path.dirname(primaryTarget.targetPath), `${currentResourceName}.meta.json`);
  const targetType = await fs.stat(targetPath);
  if (targetType !== "file") {
    return undefined;
  }

  return {
    targetPath,
    entryType: "file",
    role: "meta",
    recursive: false,
  };
}
