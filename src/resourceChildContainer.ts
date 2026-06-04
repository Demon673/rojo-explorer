import * as path from "node:path";

import { RojoSourceRef } from "./domain";

export function getResourceChildContainerPath(source: RojoSourceRef | undefined): string | undefined {
  if (!source?.exists || !source.entryType) {
    return undefined;
  }

  if (source.entryType === "directory") {
    return source.fsPath;
  }

  if (source.kind === "initScript" && source.entryType === "file") {
    return path.dirname(source.fsPath);
  }

  return undefined;
}
