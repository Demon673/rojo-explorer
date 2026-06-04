import * as path from "node:path";

import { RojoFileSystem, RojoFsEntry, RojoFsEntryType, RojoSourceKind } from "./domain";
import { inferFileRule } from "./domain/rojoSyncRules";

export interface ResourceDuplicateRequest {
  sourcePath: string;
  sourceKind: RojoSourceKind;
  entryType: RojoFsEntryType;
  currentResourceName: string;
}

export interface ResourceDuplicateOperation {
  sourcePath: string;
  targetPath: string;
  entryType: RojoFsEntryType;
  role: "resource" | "meta";
}

export interface ResourceDuplicatePlan {
  currentResourceName: string;
  newResourceName: string;
  targetPath: string;
  copies: ResourceDuplicateOperation[];
}

export interface ResourceDuplicateResult {
  ok: true;
  plan: ResourceDuplicatePlan;
}

export type ResourceDuplicateFailureReason =
  | "sourceNotFound"
  | "unsupportedResource"
  | "targetExists"
  | "noAvailableName";

export interface ResourceDuplicateFailure {
  ok: false;
  reason: ResourceDuplicateFailureReason;
  message: string;
  targetPath?: string;
}

const duplicateableSourceKinds = new Set<RojoSourceKind>([
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

export function canDuplicateSourceKind(kind: RojoSourceKind): boolean {
  return duplicateableSourceKinds.has(kind);
}

export async function planResourceDuplicate(
  request: ResourceDuplicateRequest,
  fs: Pick<RojoFileSystem, "readDirectory" | "stat">,
): Promise<ResourceDuplicateResult | ResourceDuplicateFailure> {
  if (!canDuplicateSourceKind(request.sourceKind)) {
    return {
      ok: false,
      reason: "unsupportedResource",
      message: "This resource cannot be duplicated safely yet.",
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

  const parentDirectoryPath = path.dirname(primarySource.sourcePath);
  const entries = await fs.readDirectory(parentDirectoryPath);
  const generatedPlan = await generateAvailableDuplicatePlan(request, primarySource, parentDirectoryPath, entries, fs);
  if (!generatedPlan.ok) {
    return generatedPlan;
  }

  return {
    ok: true,
    plan: {
      currentResourceName: request.currentResourceName,
      newResourceName: generatedPlan.plan.newResourceName,
      targetPath: generatedPlan.plan.targetPath,
      copies: generatedPlan.plan.copies,
    },
  };
}

interface PrimaryDuplicateSource {
  sourcePath: string;
  entryType: RojoFsEntryType;
}

interface CandidateDuplicatePlan {
  newResourceName: string;
  targetPath: string;
  copies: ResourceDuplicateOperation[];
}

async function generateAvailableDuplicatePlan(
  request: ResourceDuplicateRequest,
  primarySource: PrimaryDuplicateSource,
  parentDirectoryPath: string,
  entries: RojoFsEntry[],
  fs: Pick<RojoFileSystem, "stat">,
): Promise<{ ok: true; plan: CandidateDuplicatePlan } | ResourceDuplicateFailure> {
  let lastConflictPath: string | undefined;
  for (let index = 1; index <= 100; index += 1) {
    const newResourceName = createDuplicateName(request.currentResourceName, index);
    const primaryCopy = createPrimaryCopy(request, primarySource, parentDirectoryPath, newResourceName);
    if (!primaryCopy) {
      return {
        ok: false,
        reason: "unsupportedResource",
        message: "This resource cannot be duplicated safely yet.",
      };
    }

    const conflictPath = await findTargetConflict(newResourceName, primaryCopy, entries, fs);
    if (conflictPath) {
      lastConflictPath = conflictPath;
      continue;
    }

    const sidecarMetaCopy = await createSidecarMetaCopy(request.currentResourceName, newResourceName, primarySource, fs);
    if (sidecarMetaCopy) {
      const targetMetaType = await fs.stat(sidecarMetaCopy.targetPath);
      if (targetMetaType) {
        lastConflictPath = sidecarMetaCopy.targetPath;
        continue;
      }
    }

    return {
      ok: true,
      plan: {
        newResourceName,
        targetPath: primaryCopy.targetPath,
        copies: [primaryCopy, ...(sidecarMetaCopy ? [sidecarMetaCopy] : [])],
      },
    };
  }

  return {
    ok: false,
    reason: "noAvailableName",
    message: "No available duplicate resource name was found.",
    targetPath: lastConflictPath,
  };
}

function createPrimarySource(request: ResourceDuplicateRequest): PrimaryDuplicateSource {
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

function createPrimaryCopy(
  request: ResourceDuplicateRequest,
  primarySource: PrimaryDuplicateSource,
  parentDirectoryPath: string,
  newResourceName: string,
): ResourceDuplicateOperation | undefined {
  if (request.sourceKind === "initScript" || primarySource.entryType === "directory") {
    return {
      sourcePath: primarySource.sourcePath,
      targetPath: path.join(parentDirectoryPath, newResourceName),
      entryType: "directory",
      role: "resource",
    };
  }

  const suffix = getPreservedFileSuffix(request.sourcePath);
  if (!suffix) {
    return undefined;
  }

  return {
    sourcePath: primarySource.sourcePath,
    targetPath: path.join(parentDirectoryPath, `${newResourceName}${suffix}`),
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

async function findTargetConflict(
  newResourceName: string,
  primaryCopy: ResourceDuplicateOperation,
  entries: RojoFsEntry[],
  fs: Pick<RojoFileSystem, "stat">,
): Promise<string | undefined> {
  const targetType = await fs.stat(primaryCopy.targetPath);
  if (targetType) {
    return primaryCopy.targetPath;
  }

  const plannedName = newResourceName.toLowerCase();
  const parentDirectoryPath = path.dirname(primaryCopy.targetPath);
  for (const entry of entries) {
    const entryPath = path.join(parentDirectoryPath, entry.name);
    const rule = inferFileRule(entry.name, entry.type);
    if (rule?.name.toLowerCase() === plannedName) {
      return entryPath;
    }
  }

  return undefined;
}

async function createSidecarMetaCopy(
  currentResourceName: string,
  newResourceName: string,
  primarySource: PrimaryDuplicateSource,
  fs: Pick<RojoFileSystem, "stat">,
): Promise<ResourceDuplicateOperation | undefined> {
  const parentDirectoryPath = path.dirname(primarySource.sourcePath);
  const sourcePath = path.join(parentDirectoryPath, `${currentResourceName}.meta.json`);
  const targetPath = path.join(parentDirectoryPath, `${newResourceName}.meta.json`);
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

function createDuplicateName(currentResourceName: string, index: number): string {
  return index === 1
    ? `${currentResourceName} Copy`
    : `${currentResourceName} Copy ${index}`;
}
