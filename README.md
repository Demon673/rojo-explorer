# Rojo Explorer

Rojo Explorer is a VS Code extension for Roblox Rojo workflows. It adds a Studio-like resource explorer inside VS Code so a workspace or folder can be browsed through the same mental model used in Roblox Studio.

## Project Safety

This repository uses Git as the rollback boundary for project work. Changes should happen on feature branches, with a commit after each validated milestone. See [docs/git-safety.md](docs/git-safety.md).

## Current Scope

- Adds a `Rojo Explorer` tree view in the VS Code Explorer sidebar.
- Finds `*.project.json` files, preferring `default.project.json` when multiple projects exist.
- Builds a read-only Studio-style resource tree from the Rojo `tree` object and mapped filesystem contents.
- Resolves `$path` entries relative to the project file.
- Applies Rojo v7 sync rules for scripts, init scripts, models, JSON/TOML modules, plain text, localization tables, included `default.project.json` files, and `.meta.json` files.
- Auto-refreshes when Rojo-relevant source files or directory resources change on disk.
- Shows diagnostics for invalid JSON, missing mapped paths, duplicate init scripts, orphan meta files, and unsupported meta usage.
- Shows diagnostics as expandable tree nodes, not only tooltip text.
- Opens or reveals mapped source files and folders from the tree context menu.
- Keeps expandable nodes Studio-like: clicking the label selects the node, and the disclosure arrow expands it.
- Copies Studio paths like `game.ReplicatedStorage.Shared.Foo`.
- Copies absolute and workspace-relative source filesystem paths from mapped resources and diagnostics.
- Provides Simplified Chinese localization for VS Code users running the `zh-cn` display language.
- Creates new Rojo-backed folders, scripts, local scripts, module scripts, JSON/TOML modules, models, remote events/functions, bindable events/functions, string values, and localization tables under filesystem-backed folder resources.
- Provides a `New Instance...` picker for supported directory-backed class resources that are represented through `init.meta.json`.
- Renames Rojo-backed filesystem resources while preserving file suffix semantics and sibling `.meta.json` files.
- Duplicates Rojo-backed filesystem resources while preserving file suffix semantics and sibling `.meta.json` files.
- Moves Rojo-backed filesystem resources between filesystem-backed folder resources after conflict checks.
- Moves Rojo-backed filesystem resources by dragging them onto filesystem-backed folder resources.
- Deletes Rojo-backed filesystem resources after confirmation, using the OS trash when available.
- Opens or creates sidecar `.meta.json` files for filesystem-discovered resources.
- Opens or creates `init.meta.json` files for directory-backed and init-backed filesystem resources.
- Marks project-controlled resources, such as project file mappings and included projects.
- Edits project mapping Studio names by renaming the corresponding key in `.project.json` without moving the mapped source path.
- Edits project mapping source paths by updating `$path` values in `.project.json` after validating the selected source path.

Resource management is intentionally narrow: creation works under mapped directories, filesystem rename, duplicate, move, and delete work only for filesystem-discovered resources, and project mapping edits change only Studio names or `$path` values defined in project files. These paths check for generated path, sibling mapping, selected source path, or source existence conflicts.

Rojo Explorer does not automatically edit project mappings, build, serve, or sync resources.

## Development

Install dependencies:

```bash
npm install
```

Compile:

```bash
npm run compile
```

Run tests:

```bash
npm run test
```

Run TypeScript without writing build output:

```bash
npm run typecheck
```

Run the same core checks used by CI:

```bash
npm run test
npm run typecheck
npm run compile
npm audit
```

Run the extension:

1. Open this folder in VS Code.
2. Press `F5` to start an Extension Development Host.
3. Open a Rojo project folder in that host.
4. Use the `Rojo Explorer` view in the Explorer sidebar.

## Rojo Mapping Notes

The implementation is grounded in the Rojo v7 project and sync documentation. See [docs/rojo-semantics.md](docs/rojo-semantics.md) for the exact rule list and source links.

The extension understands the common Rojo project file shape:

```json
{
  "name": "MyGame",
  "tree": {
    "$className": "DataModel",
    "ReplicatedStorage": {
      "$className": "ReplicatedStorage",
      "$path": "src/ReplicatedStorage"
    }
  }
}
```

File names are displayed with Rojo-compatible class inference:

- `*.server.lua` and `*.server.luau` as `Script`
- `*.client.lua` and `*.client.luau` as `LocalScript`
- `*.lua` and `*.luau` as `ModuleScript`
- `*.model.json`, `*.rbxm`, and `*.rbxmx` as `Model`
- other `*.json` and `*.toml` as `ModuleScript`
- `*.txt` as `StringValue`
- `*.csv` as `LocalizationTable`

This project should avoid editing binary Roblox assets directly. The extension should operate through source files and Rojo project mappings.
