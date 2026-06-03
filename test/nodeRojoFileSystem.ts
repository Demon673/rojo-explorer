import { promises as fs } from "node:fs";

import { RojoFileSystem, RojoFsEntry, RojoFsEntryType } from "../src/domain";

export class NodeRojoFileSystem implements RojoFileSystem {
  async readFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, "utf8");
  }

  async readDirectory(directoryPath: string): Promise<RojoFsEntry[]> {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    return entries
      .map((entry) => {
        if (entry.isFile()) {
          return { name: entry.name, type: "file" as const };
        }

        if (entry.isDirectory()) {
          return { name: entry.name, type: "directory" as const };
        }

        return undefined;
      })
      .filter((entry): entry is RojoFsEntry => entry !== undefined);
  }

  async stat(filePath: string): Promise<RojoFsEntryType | undefined> {
    try {
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        return "file";
      }

      if (stat.isDirectory()) {
        return "directory";
      }

      return undefined;
    } catch {
      return undefined;
    }
  }
}
