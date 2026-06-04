import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { shouldRefreshForRojoFileSystemChange } from "../src/rojoFileSystemWatch";

describe("Rojo file system watch filtering", () => {
  it("refreshes for Rojo source files", () => {
    expect(shouldRefreshForRojoFileSystemChange(path.join("project", "src", "Main.server.lua"), "file")).toBe(true);
    expect(shouldRefreshForRojoFileSystemChange(path.join("project", "src", "Config.json"), "file")).toBe(true);
    expect(shouldRefreshForRojoFileSystemChange(path.join("project", "src", "Tool.meta.json"), "file")).toBe(true);
    expect(shouldRefreshForRojoFileSystemChange(path.join("project", "default.project.json"), "file")).toBe(true);
  });

  it("refreshes for directory resources, including dotted names", () => {
    expect(shouldRefreshForRojoFileSystemChange(path.join("project", "src", "Shared"), "directory")).toBe(true);
    expect(shouldRefreshForRojoFileSystemChange(path.join("project", "src", "Folder.v1"), "directory")).toBe(true);
  });

  it("refreshes for deletes because deleted directories cannot be statted", () => {
    expect(shouldRefreshForRojoFileSystemChange(path.join("project", "src", "Shared"), "deleted")).toBe(true);
    expect(shouldRefreshForRojoFileSystemChange(path.join("project", "src", "Folder.v1"), "deleted")).toBe(true);
  });

  it("ignores unrelated file changes", () => {
    expect(shouldRefreshForRojoFileSystemChange(path.join("project", "README.md"), "file")).toBe(false);
    expect(shouldRefreshForRojoFileSystemChange(path.join("project", "LICENSE"), "file")).toBe(false);
    expect(shouldRefreshForRojoFileSystemChange(path.join("project", ".luaurc"), "file")).toBe(false);
  });

  it("ignores noisy infrastructure directories", () => {
    expect(shouldRefreshForRojoFileSystemChange(path.join("project", ".git", "index"), "deleted")).toBe(false);
    expect(shouldRefreshForRojoFileSystemChange(path.join("project", "node_modules", "pkg", "index.lua"), "file")).toBe(
      false,
    );
    expect(shouldRefreshForRojoFileSystemChange(path.join("project", ".vscode", "settings.json"), "file")).toBe(false);
  });
});
