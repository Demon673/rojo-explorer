import * as path from "node:path";

import * as vscode from "vscode";

export async function findRojoProjectFiles(): Promise<vscode.Uri[]> {
  const files = await vscode.workspace.findFiles(
    "**/*.project.json",
    "**/{.git,node_modules,out,dist,build}/**",
  );

  return files.sort((left, right) => compareProjectPaths(left.fsPath, right.fsPath));
}

function compareProjectPaths(leftPath: string, rightPath: string): number {
  const leftName = path.basename(leftPath);
  const rightName = path.basename(rightPath);

  if (leftName === "default.project.json" && rightName !== "default.project.json") {
    return -1;
  }

  if (rightName === "default.project.json" && leftName !== "default.project.json") {
    return 1;
  }

  return leftPath.localeCompare(rightPath);
}
