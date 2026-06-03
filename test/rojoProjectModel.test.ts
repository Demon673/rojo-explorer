import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { buildRojoProjectModel, formatNodeStudioPath, RojoInstanceNode } from "../src/domain";
import { NodeRojoFileSystem } from "./nodeRojoFileSystem";

const repoRoot = path.resolve(__dirname, "..");
const fs = new NodeRojoFileSystem();

describe("Rojo project model", () => {
  it("builds a DataModel tree from project tree and mapped folders", async () => {
    const model = await fixtureModel("basic-place");

    expect(model.config.name).toBe("BasicPlace");
    expect(model.root.className).toBe("DataModel");
    expect(formatNodeStudioPath(model.root)).toBe("game");

    const replicatedStorage = child(model.root, "ReplicatedStorage");
    expect(replicatedStorage.className).toBe("ReplicatedStorage");
    expect(formatNodeStudioPath(child(child(replicatedStorage, "Shared"), "Util"))).toBe(
      "game.ReplicatedStorage.Shared.Util",
    );
    expect(child(child(replicatedStorage, "Shared"), "Util").className).toBe("ModuleScript");
    expect(child(replicatedStorage, "Config").className).toBe("ModuleScript");
    expect(child(replicatedStorage, "Remotes").className).toBe("Model");

    expect(child(model.root, "ServerScriptService").children[0].className).toBe("Script");
    expect(child(child(model.root, "StarterPlayer"), "StarterPlayerScripts").children[0].className).toBe("LocalScript");
  });

  it("models init scripts as the containing directory instance", async () => {
    const model = await fixtureModel("init-scripts");
    const replicatedStorage = child(model.root, "ReplicatedStorage");

    expect(child(replicatedStorage, "Module").className).toBe("ModuleScript");
    expect(child(child(replicatedStorage, "Module"), "Child").className).toBe("ModuleScript");
    expect(child(replicatedStorage, "ServerScript").className).toBe("Script");
    expect(child(replicatedStorage, "ClientScript").className).toBe("LocalScript");
    expect(child(replicatedStorage, "Duplicate").diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "duplicateInitScript",
    );
  });

  it("applies init and sibling meta files without displaying meta nodes", async () => {
    const model = await fixtureModel("meta-files");
    const replicatedStorage = child(model.root, "ReplicatedStorage");
    const tool = child(replicatedStorage, "Tool");
    const disabled = child(replicatedStorage, "Disabled");

    expect(tool.className).toBe("Tool");
    expect(tool.properties?.RequiresHandle).toBe(false);
    expect(tool.ignoreUnknownInstances).toBe(true);
    expect(disabled.properties?.Disabled).toBe(true);
    expect(replicatedStorage.children.some((node) => node.name.endsWith(".meta"))).toBe(false);
    expect(model.diagnostics.map((diagnostic) => diagnostic.code)).toContain("orphanMetaFile");
  });

  it("maps model and data file extensions according to Rojo sync rules", async () => {
    const model = await fixtureModel("models-and-data");
    const replicatedStorage = child(model.root, "ReplicatedStorage");

    expect(child(replicatedStorage, "Asset").className).toBe("Model");
    expect(child(replicatedStorage, "XmlAsset").className).toBe("Model");
    expect(child(replicatedStorage, "Event").className).toBe("Model");
    expect(child(replicatedStorage, "Data").className).toBe("ModuleScript");
    expect(child(replicatedStorage, "Settings").className).toBe("ModuleScript");
    expect(child(replicatedStorage, "Message").className).toBe("StringValue");
    expect(child(replicatedStorage, "Localization").className).toBe("LocalizationTable");
  });

  it("treats roblox-ts output as ordinary Rojo mapped folders", async () => {
    const model = await fixtureModel("roblox-ts-like");

    expect(child(child(model.root, "ReplicatedStorage"), "SharedModule").className).toBe("ModuleScript");
    expect(child(child(model.root, "ServerScriptService"), "main").className).toBe("Script");
    expect(child(child(child(model.root, "StarterPlayer"), "StarterPlayerScripts"), "main").className).toBe(
      "LocalScript",
    );
  });

  it("preserves project properties, applies globIgnorePaths, and includes default.project.json directories", async () => {
    const model = await fixtureModel("project-rules");
    const replicatedStorage = child(model.root, "ReplicatedStorage");

    expect(replicatedStorage.properties?.Archivable).toBe(true);
    expect(replicatedStorage.ignoreUnknownInstances).toBe(true);
    expect(child(replicatedStorage, "ExplicitPart").properties?.Anchored).toBe(true);
    expect(child(replicatedStorage, "Kept").className).toBe("ModuleScript");
    expect(replicatedStorage.children.some((node) => node.name === "Ignored")).toBe(false);
    expect(replicatedStorage.children.some((node) => node.name === "Example.spec")).toBe(false);
    expect(child(child(replicatedStorage, "Included"), "Child").className).toBe("Folder");
    expect(child(model.root, "ServerStorage").diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "pathNotFound",
    );
  });
});

async function fixtureModel(name: string) {
  return buildRojoProjectModel(path.join(repoRoot, "fixtures", name, "default.project.json"), fs);
}

function child(parent: RojoInstanceNode, name: string): RojoInstanceNode {
  const found = parent.children.find((node) => node.name === name);
  if (!found) {
    throw new Error(`Missing child ${name} under ${formatNodeStudioPath(parent)}`);
  }

  return found;
}
