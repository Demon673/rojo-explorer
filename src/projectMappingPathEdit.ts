import * as path from "node:path";

import { RojoFileSystem, RojoFsEntryType } from "./domain";
import { relativeRojoPath, resolveRojoPath, toRojoPath } from "./domain/pathUtils";
import { inferFileRule } from "./domain/rojoSyncRules";

export interface ProjectMappingPathEditRequest {
  projectFilePath: string;
  projectTreePath: readonly string[];
  newSourcePath: string;
}

export interface ProjectMappingPathEditPlan {
  projectFilePath: string;
  mappingName: string;
  currentPath: string;
  newPath: string;
  pathValue: string;
  targetEntryType: RojoFsEntryType;
  updatedContent: string;
}

export interface ProjectMappingPathEditResult {
  ok: true;
  plan: ProjectMappingPathEditPlan;
}

export type ProjectMappingPathEditFailureReason =
  | "invalidJson"
  | "mappingNotFound"
  | "mappingHasNoPath"
  | "targetNotFound"
  | "unsupportedPathType"
  | "unchangedPath";

export interface ProjectMappingPathEditFailure {
  ok: false;
  reason: ProjectMappingPathEditFailureReason;
  message: string;
  targetPath?: string;
}

interface ProjectDocument {
  tree?: unknown;
}

export async function planProjectMappingPathEdit(
  projectContent: string,
  request: ProjectMappingPathEditRequest,
  fs: Pick<RojoFileSystem, "stat">,
): Promise<ProjectMappingPathEditResult | ProjectMappingPathEditFailure> {
  let document: ProjectDocument;
  try {
    document = JSON.parse(projectContent) as ProjectDocument;
  } catch (error) {
    return {
      ok: false,
      reason: "invalidJson",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  if (!isRecord(document.tree)) {
    return {
      ok: false,
      reason: "mappingNotFound",
      message: "Project file is missing a valid tree object.",
    };
  }

  const mapping = getProjectTreeMapping(document.tree, request.projectTreePath);
  if (!mapping) {
    return {
      ok: false,
      reason: "mappingNotFound",
      message: "Project mapping was not found in the project file.",
    };
  }

  const currentRawPath = mapping.$path;
  if (typeof currentRawPath !== "string") {
    return {
      ok: false,
      reason: "mappingHasNoPath",
      message: "Project mapping is missing a $path value.",
    };
  }

  const projectRootPath = path.dirname(path.normalize(request.projectFilePath));
  const normalizedNewPath = path.normalize(request.newSourcePath);
  const targetEntryType = await fs.stat(normalizedNewPath);
  if (!targetEntryType) {
    return {
      ok: false,
      reason: "targetNotFound",
      message: "Selected source path does not exist.",
      targetPath: normalizedNewPath,
    };
  }

  if (targetEntryType === "file" && !inferFileRule(path.basename(normalizedNewPath), "file")) {
    return {
      ok: false,
      reason: "unsupportedPathType",
      message: "Selected source file is not a supported Rojo resource.",
      targetPath: normalizedNewPath,
    };
  }

  const currentPath = resolveRojoPath(projectRootPath, currentRawPath);
  if (isSamePath(currentPath, normalizedNewPath)) {
    return {
      ok: false,
      reason: "unchangedPath",
      message: "Project mapping source path is unchanged.",
      targetPath: normalizedNewPath,
    };
  }

  const pathValue = createProjectPathValue(projectRootPath, normalizedNewPath);
  mapping.$path = pathValue;

  return {
    ok: true,
    plan: {
      projectFilePath: request.projectFilePath,
      mappingName: request.projectTreePath[request.projectTreePath.length - 1] ?? "tree",
      currentPath,
      newPath: normalizedNewPath,
      pathValue,
      targetEntryType,
      updatedContent: `${JSON.stringify(document, null, 2)}\n`,
    },
  };
}

function getProjectTreeMapping(
  tree: Record<string, unknown>,
  projectTreePath: readonly string[],
): Record<string, unknown> | undefined {
  let current: Record<string, unknown> = tree;
  for (const segment of projectTreePath) {
    const child = current[segment];
    if (!isRecord(child)) {
      return undefined;
    }

    current = child;
  }

  return current;
}

function createProjectPathValue(projectRootPath: string, targetPath: string): string {
  const relativePath = relativeRojoPath(projectRootPath, targetPath);
  if (relativePath === "") {
    return ".";
  }

  if (path.isAbsolute(relativePath)) {
    return toRojoPath(path.normalize(targetPath));
  }

  return relativePath;
}

function isSamePath(left: string, right: string): boolean {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
