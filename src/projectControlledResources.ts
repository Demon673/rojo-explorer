import { RojoSourceKind } from "./domain";

export type ProjectControlBadge = "projectFile" | "projectMapping" | "includedProject";

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

export function isProjectControlledSourceKind(kind: RojoSourceKind | undefined): boolean {
  return getProjectControlBadgeForSourceKind(kind) !== undefined;
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
      return undefined;
  }
}
