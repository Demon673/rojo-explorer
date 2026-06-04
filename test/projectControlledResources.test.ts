import { describe, expect, it } from "vitest";

import {
  getProjectControlBadge,
  getProjectControlBadgeForSourceKind,
  getProjectMappingFilePath,
  isProjectControlledResource,
  isProjectControlledSourceKind,
} from "../src/projectControlledResources";

describe("project controlled resource helpers", () => {
  it("classifies project-controlled source kinds", () => {
    expect(getProjectControlBadgeForSourceKind("project")).toBe("projectFile");
    expect(getProjectControlBadgeForSourceKind("projectTree")).toBe("projectMapping");
    expect(getProjectControlBadgeForSourceKind("projectInclusion")).toBe("includedProject");
    expect(getProjectControlBadgeForSourceKind("directory")).toBeUndefined();
    expect(getProjectControlBadgeForSourceKind("script")).toBeUndefined();
  });

  it("detects project-controlled source kinds", () => {
    expect(isProjectControlledSourceKind("project")).toBe(true);
    expect(isProjectControlledSourceKind("projectTree")).toBe(true);
    expect(isProjectControlledSourceKind("projectInclusion")).toBe(true);
    expect(isProjectControlledSourceKind("directory")).toBe(false);
  });

  it("classifies explicit project tree nodes without filesystem sources", () => {
    const info = {
      projectFilePath: "default.project.json",
      projectTreePath: ["HttpService"],
    };

    expect(getProjectControlBadge(info)).toBe("projectMapping");
    expect(isProjectControlledResource(info)).toBe(true);
  });

  it("resolves the project file that should be edited for each controlled kind", () => {
    expect(getProjectMappingFilePath("project", "default.project.json", "ignored.project.json")).toBe("default.project.json");
    expect(getProjectMappingFilePath("projectInclusion", "src/Package/default.project.json", "root.project.json")).toBe(
      "src/Package/default.project.json",
    );
    expect(getProjectMappingFilePath("projectTree", "src/ReplicatedStorage", "default.project.json")).toBe(
      "default.project.json",
    );
    expect(getProjectMappingFilePath(undefined, undefined, "default.project.json")).toBe("default.project.json");
    expect(getProjectMappingFilePath("directory", "src/Folder", "default.project.json")).toBeUndefined();
  });
});
