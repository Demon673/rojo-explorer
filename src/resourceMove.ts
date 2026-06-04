import * as path from "node:path";

import { RojoFileSystem, RojoFsEntryType, RojoSourceKind } from "./domain";
import { inferFileRule } from "./domain/rojoSyncRules";

export interface ResourceMoveRequest {
  sourcePath: string;
  sourceKind: RojoSourceKind;
  entryType: RojoFsEntryType;
  currentResourceName: string;
  targetDirectoryPath: string;
}

export interface ResourceMoveOperation {
  sourcePath: string;
  targetPath: string;
  entryType: RojoFsEntryType;
  role: "resource" | "meta";
}

export interface ResourceMovePlan {
  currentResourceName: string;
  targetDirectoryPath: string;
  targetPath: string;
  moves: ResourceMoveOperation[];
}

export interface ResourceMoveResult {
  ok: true;
  plan: ResourceMovePlan;
}

export type ResourceMoveFailureReason =
  | "sourceNotFound"
  | "targetNotDirectory"
  | "targetExists"
  | "targetInsideSource"
  | "unchangedTarget"
  | "unsupportedResource";

export interface ResourceMoveFailure {
  ok: false;
  reason: ResourceMoveFailureReason;
  message: string;
  targetPath?: string;
}

const movableSourceKinds = new Set<RojoSourceKind>([
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

export function canMoveSourceKind(kind: RojoSourceKind): boolean {
  return movableSourceKinds.has(kind);
}

export async function planResourceMove(
  request: ResourceMoveRequest,
  fs: Pick<RojoFileSystem, "readDirectory" | "stat">,
): Promise<ResourceMoveResult | ResourceMoveFailure> {
  if (!canMoveSourceKind(request.sourceKind)) {
    return {
      ok: false,
      reason: "unsupportedResource",
      message: "This resource cannot be moved safely yet.",
    };
  }

  const targetType = await fs.stat(request.targetDirectoryPath);
  if (targetType !== "directory") {
    return {
      ok: false,
      reason: "targetNotDirectory",
      message: "Target path is not a directory.",
      targetPath: request.targetDirectoryPath,
    };
  }

  const primaryMove = createPrimaryMove(request);
  const sourceType = await fs.stat(primaryMove.sourcePath);
  if (sourceType !== primaryMove.entryType) {
    return {
      ok: false,
      reason: "sourceNotFound",
      message: "Source path does not exist.",
      targetPath: primaryMove.sourcePath,
    };
  }

  if (isSamePath(path.dirname(primaryMove.sourcePath), request.targetDirectoryPath)) {
    return {
      ok: false,
      reason: "unchangedTarget",
      message: "Resource is already in that directory.",
      targetPath: request.targetDirectoryPath,
    };
  }

  if (
    primaryMove.entryType === "directory"
    && (isSamePath(primaryMove.sourcePath, request.targetDirectoryPath)
      || isPathInside(primaryMove.sourcePath, request.targetDirectoryPath))
  ) {
    return {
      ok: false,
      reason: "targetInsideSource",
      message: "A resource cannot be moved inside itself.",
      targetPath: request.targetDirectoryPath,
    };
  }

  const conflictPath = await findTargetConflict(request.currentResourceName, primaryMove, request.targetDirectoryPath, fs);
  if (conflictPath) {
    return {
      ok: false,
      reason: "targetExists",
      message: "A resource with that Rojo name already exists in the target directory.",
      targetPath: conflictPath,
    };
  }

  const sidecarMetaMove = await createSidecarMetaMove(request.currentResourceName, primaryMove, request.targetDirectoryPath, fs);
  if (sidecarMetaMove) {
    const targetMetaType = await fs.stat(sidecarMetaMove.targetPath);
    if (targetMetaType && !isSamePath(sidecarMetaMove.sourcePath, sidecarMetaMove.targetPath)) {
      return {
        ok: false,
        reason: "targetExists",
        message: "A resource meta file with that Rojo name already exists in the target directory.",
        targetPath: sidecarMetaMove.targetPath,
      };
    }
  }

  return {
    ok: true,
    plan: {
      currentResourceName: request.currentResourceName,
      targetDirectoryPath: request.targetDirectoryPath,
      targetPath: primaryMove.targetPath,
      moves: [primaryMove, ...(sidecarMetaMove ? [sidecarMetaMove] : [])],
    },
  };
}

function createPrimaryMove(request: ResourceMoveRequest): ResourceMoveOperation {
  if (request.sourceKind === "initScript") {
    const sourceDirectoryPath = path.dirname(request.sourcePath);
    return {
      sourcePath: sourceDirectoryPath,
      targetPath: path.join(request.targetDirectoryPath, path.basename(sourceDirectoryPath)),
      entryType: "directory",
      role: "resource",
    };
  }

  return {
    sourcePath: request.sourcePath,
    targetPath: path.join(request.targetDirectoryPath, path.basename(request.sourcePath)),
    entryType: request.entryType,
    role: "resource",
  };
}

async function findTargetConflict(
  resourceName: string,
  primaryMove: ResourceMoveOperation,
  targetDirectoryPath: string,
  fs: Pick<RojoFileSystem, "readDirectory" | "stat">,
): Promise<string | undefined> {
  const targetType = await fs.stat(primaryMove.targetPath);
  if (targetType && !isSamePath(primaryMove.sourcePath, primaryMove.targetPath)) {
    return primaryMove.targetPath;
  }

  const entries = await fs.readDirectory(targetDirectoryPath);
  const plannedName = resourceName.toLowerCase();
  for (const entry of entries) {
    const entryPath = path.join(targetDirectoryPath, entry.name);
    if (isSamePath(entryPath, primaryMove.sourcePath)) {
      continue;
    }

    const rule = inferFileRule(entry.name, entry.type);
    if (rule?.name.toLowerCase() === plannedName) {
      return entryPath;
    }
  }

  return undefined;
}

async function createSidecarMetaMove(
  currentResourceName: string,
  primaryMove: ResourceMoveOperation,
  targetDirectoryPath: string,
  fs: Pick<RojoFileSystem, "stat">,
): Promise<ResourceMoveOperation | undefined> {
  const sourcePath = path.join(path.dirname(primaryMove.sourcePath), `${currentResourceName}.meta.json`);
  const targetPath = path.join(targetDirectoryPath, `${currentResourceName}.meta.json`);
  if (isSamePath(sourcePath, targetPath)) {
    return undefined;
  }

  const sourceType = await fs.stat(sourcePath);
  if (sourceType !== "file") {
    return undefined;
  }

  return {
    sourcePath,
    targetPath,
    entryType: "file",
    role: "meta",
  };
}

function isPathInside(parentPath: string, candidatePath: string): boolean {
  const relativePath = path.relative(path.resolve(parentPath), path.resolve(candidatePath));
  return relativePath.length > 0 && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function isSamePath(left: string, right: string): boolean {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}
