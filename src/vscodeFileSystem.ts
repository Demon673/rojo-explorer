import { TextDecoder } from "node:util";

import * as vscode from "vscode";

import { RojoFileSystem, RojoFsEntry, RojoFsEntryType } from "./domain";

export class VscodeRojoFileSystem implements RojoFileSystem {
  async readFile(filePath: string): Promise<string> {
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
    return new TextDecoder("utf-8").decode(bytes);
  }

  async readDirectory(directoryPath: string): Promise<RojoFsEntry[]> {
    const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(directoryPath));
    return entries
      .map(([name, type]) => {
        const entryType = toEntryType(type);
        return entryType ? { name, type: entryType } : undefined;
      })
      .filter((entry): entry is RojoFsEntry => entry !== undefined);
  }

  async stat(filePath: string): Promise<RojoFsEntryType | undefined> {
    try {
      const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
      return toEntryType(stat.type);
    } catch {
      return undefined;
    }
  }
}

function toEntryType(type: vscode.FileType): RojoFsEntryType | undefined {
  if (type === vscode.FileType.File) {
    return "file";
  }

  if (type === vscode.FileType.Directory) {
    return "directory";
  }

  return undefined;
}
