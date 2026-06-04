import { inferFileRule, isMetaFile, isProjectFile } from "./domain";

export type RojoFileSystemChangeKind = "file" | "directory" | "deleted";

const ignoredDirectoryNames = new Set([".git", ".vscode", "node_modules"]);

export function shouldRefreshForRojoFileSystemChange(
  fsPath: string,
  changeKind: RojoFileSystemChangeKind,
): boolean {
  const segments = splitPathSegments(fsPath);
  const fileName = segments.at(-1);
  if (!fileName || segments.some((segment) => ignoredDirectoryNames.has(segment))) {
    return false;
  }

  if (changeKind === "directory" || changeKind === "deleted") {
    return true;
  }

  return isRojoRelevantFileName(fileName);
}

function isRojoRelevantFileName(fileName: string): boolean {
  if (fileName.startsWith(".")) {
    return false;
  }

  if (isProjectFile(fileName) || isMetaFile(fileName)) {
    return true;
  }

  if (inferFileRule(fileName, "file")) {
    return true;
  }

  return false;
}

function splitPathSegments(fsPath: string): string[] {
  return fsPath.split(/[\\/]+/).filter(Boolean);
}
