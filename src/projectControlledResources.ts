import { RojoSourceKind } from "./domain";

export type ProjectControlBadge = "projectFile" | "projectMapping" | "includedProject";

export interface ProjectControlledResourceInfo {
  sourceKind?: RojoSourceKind;
  projectFilePath?: string;
  projectTreePath?: readonly string[];
}

export function getProjectControlBadgeForSourceKind(kind: RojoSourceKind | undefined): ProjectControlBadge | undefined {
  switch (kind) {
    case "project":
      return "projectFile";
    case "projectTree":
      return "projectMapping";
    case "projectInclusion":
      return "includedProject";
    default:
      return undefined;
  }
}

export function getProjectControlBadge(info: ProjectControlledResourceInfo): ProjectControlBadge | undefined {
  const sourceBadge = getProjectControlBadgeForSourceKind(info.sourceKind);
  if (sourceBadge) {
    return sourceBadge;
  }

  if (info.projectFilePath && info.projectTreePath && info.projectTreePath.length > 0) {
    return "projectMapping";
  }

  return undefined;
}

export function isProjectControlledSourceKind(kind: RojoSourceKind | undefined): boolean {
  return getProjectControlBadgeForSourceKind(kind) !== undefined;
}

export function isProjectControlledResource(info: ProjectControlledResourceInfo): boolean {
  return getProjectControlBadge(info) !== undefined;
}

export function getProjectMappingFilePath(
  kind: RojoSourceKind | undefined,
  sourcePath: string | undefined,
  projectFilePath: string | undefined,
): string | undefined {
  switch (kind) {
    case "project":
    case "projectInclusion":
      return sourcePath;
    case "projectTree":
      return projectFilePath;
    default:
      return kind === undefined ? projectFilePath : undefined;
  }
}
