import * as path from "node:path";

export function toRojoPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

export function resolveRojoPath(projectRootPath: string, rawPath: string): string {
  if (path.isAbsolute(rawPath)) {
    return path.normalize(rawPath);
  }

  if (rawPath === "" || rawPath === ".") {
    return path.normalize(projectRootPath);
  }

  return path.normalize(path.join(projectRootPath, rawPath));
}

export function projectRootFromFile(projectFilePath: string): string {
  return path.dirname(projectFilePath);
}

export function relativeRojoPath(rootPath: string, targetPath: string): string {
  return toRojoPath(path.relative(rootPath, targetPath));
}

export function formatStudioPath(studioPath: string[]): string {
  return studioPath.join(".");
}

export function basenameWithoutSuffix(fileName: string, suffix: string): string {
  return fileName.slice(0, fileName.length - suffix.length);
}
