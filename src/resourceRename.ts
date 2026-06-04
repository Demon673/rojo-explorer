import * as path from "node:path";

import { RojoFileSystem, RojoFsEntryType, RojoSourceKind } from "./domain";
import { inferFileRule } from "./domain/rojoSyncRules";

export interface ResourceRenameRequest {
  sourcePath: string;
  sourceKind: RojoSourceKind;
  entryType: RojoFsEntryType;
  currentResourceName: string;
  newResourceName: string;
}

export interface ResourceRenameMove {
  sourcePath: string;
  targetPath: string;
  entryType: RojoFsEntryType;
  role: "resource" | "meta";
}

export interface ResourceRenamePlan {
  currentResourceName: string;
  newResourceName: string;
  targetPath: string;
  moves: ResourceRenameMove[];
}

export interface ResourceRenameResult {
  ok: true;
  plan: ResourceRenamePlan;
}

export type ResourceRenameFailureReason =
  | "invalidName"
  | "sourceNotFound"
  | "unsupportedResource"
  | "targetExists"
  | "unchangedName";

export interface ResourceRenameFailure {
  ok: false;
  reason: ResourceRenameFailureReason;
  message: string;
  targetPath?: string;
}

const renameableSourceKinds = new Set<RojoSourceKind>([
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

export function canRenameSourceKind(kind: RojoSourceKind): boolean {
  return renameableSourceKinds.has(kind);
}

export async function planResourceRename(
  request: ResourceRenameRequest,
  fs: Pick<RojoFileSystem, "readDirectory" | "stat">,
): Promise<ResourceRenameResult | ResourceRenameFailure> {
  const normalizedName = request.newResourceName.trim();
  if (!isValidResourceName(normalizedName)) {
    return {
      ok: false,
      reason: "invalidName",
      message: "Resource names cannot be empty or contain path separators.",
    };
  }

  if (normalizedName === request.currentResourceName) {
    return {
      ok: false,
      reason: "unchangedName",
      message: "Resource name is unchanged.",
    };
  }

  if (!canRenameSourceKind(request.sourceKind)) {
    return {
      ok: false,
      reason: "unsupportedResource",
      message: "This resource cannot be renamed safely yet.",
    };
  }

  const sourceEntryType = await fs.stat(request.sourcePath);
  if (sourceEntryType !== request.entryType) {
    return {
      ok: false,
      reason: "sourceNotFound",
      message: "Source path does not exist.",
      targetPath: request.sourcePath,
    };
  }

  const primaryMove = createPrimaryMove(request, normalizedName);
  if (!primaryMove) {
    return {
      ok: false,
      reason: "unsupportedResource",
      message: "This resource cannot be renamed safely yet.",
    };
  }

  const primarySourceType = await fs.stat(primaryMove.sourcePath);
  if (primarySourceType !== primaryMove.entryType) {
    return {
      ok: false,
      reason: "sourceNotFound",
      message: "Source path does not exist.",
      targetPath: primaryMove.sourcePath,
    };
  }

  const conflictPath = await findRojoNameConflict(normalizedName, primaryMove, fs);
  if (conflictPath) {
    return {
      ok: false,
      reason: "targetExists",
      message: "A resource with that Rojo name already exists.",
      targetPath: conflictPath,
    };
  }

  const sidecarMetaMove = await createSidecarMetaMove(request.currentResourceName, normalizedName, primaryMove, fs);
  if (sidecarMetaMove) {
    const targetType = await fs.stat(sidecarMetaMove.targetPath);
    if (targetType && !isSamePath(sidecarMetaMove.sourcePath, sidecarMetaMove.targetPath)) {
      return {
        ok: false,
        reason: "targetExists",
        message: "A resource meta file with that Rojo name already exists.",
        targetPath: sidecarMetaMove.targetPath,
      };
    }
  }

  return {
    ok: true,
    plan: {
      currentResourceName: request.currentResourceName,
      newResourceName: normalizedName,
      targetPath: primaryMove.targetPath,
      moves: [primaryMove, ...(sidecarMetaMove ? [sidecarMetaMove] : [])],
    },
  };
}

function createPrimaryMove(request: ResourceRenameRequest, newResourceName: string): ResourceRenameMove | undefined {
  if (request.sourceKind === "initScript") {
    const sourceDirectoryPath = path.dirname(request.sourcePath);
    return {
      sourcePath: sourceDirectoryPath,
      targetPath: path.join(path.dirname(sourceDirectoryPath), newResourceName),
      entryType: "directory",
      role: "resource",
    };
  }

  if (request.entryType === "directory") {
    return {
      sourcePath: request.sourcePath,
      targetPath: path.join(path.dirname(request.sourcePath), newResourceName),
      entryType: "directory",
      role: "resource",
    };
  }

  const suffix = getPreservedFileSuffix(request.sourcePath);
  if (!suffix) {
    return undefined;
  }

  return {
    sourcePath: request.sourcePath,
    targetPath: path.join(path.dirname(request.sourcePath), `${newResourceName}${suffix}`),
    entryType: "file",
    role: "resource",
  };
}

function getPreservedFileSuffix(sourcePath: string): string | undefined {
  const fileName = path.basename(sourcePath);
  const rule = inferFileRule(fileName, "file");
  if (!rule || rule.isInitScript) {
    return undefined;
  }

  return fileName.slice(rule.name.length);
}

async function findRojoNameConflict(
  newResourceName: string,
  primaryMove: ResourceRenameMove,
  fs: Pick<RojoFileSystem, "readDirectory" | "stat">,
): Promise<string | undefined> {
  const targetType = await fs.stat(primaryMove.targetPath);
  if (targetType && !isSamePath(primaryMove.sourcePath, primaryMove.targetPath)) {
    return primaryMove.targetPath;
  }

  const parentDirectoryPath = path.dirname(primaryMove.targetPath);
  const entries = await fs.readDirectory(parentDirectoryPath);
  const plannedName = newResourceName.toLowerCase();

  for (const entry of entries) {
    const entryPath = path.join(parentDirectoryPath, entry.name);
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
  newResourceName: string,
  primaryMove: ResourceRenameMove,
  fs: Pick<RojoFileSystem, "stat">,
): Promise<ResourceRenameMove | undefined> {
  const parentDirectoryPath = path.dirname(primaryMove.sourcePath);
  const sourcePath = path.join(parentDirectoryPath, `${currentResourceName}.meta.json`);
  const targetPath = path.join(parentDirectoryPath, `${newResourceName}.meta.json`);
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

function isValidResourceName(name: string): boolean {
  return name.length > 0 && !name.includes("/") && !name.includes("\\");
}

function isSamePath(left: string, right: string): boolean {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}
