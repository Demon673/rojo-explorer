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
- Shows diagnostics for invalid JSON, missing mapped paths, duplicate init scripts, orphan meta files, and unsupported meta usage.
- Opens or reveals mapped source files and folders from the tree context menu.
- Copies Studio paths like `game.ReplicatedStorage.Shared.Foo`.

Rojo Explorer v1 is intentionally read-only. It does not create, rename, delete, move, build, serve, or sync resources.

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
