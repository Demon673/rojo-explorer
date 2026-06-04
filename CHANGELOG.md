# Changelog

All notable changes to Rojo Explorer will be documented in this file.

## 0.25.0 - Unreleased

- Add a `Remove Init Script...` command for init-backed filesystem resources.
- Remove only the `init.*.lua` source file so the containing directory and children remain intact.

## 0.24.0 - Unreleased

- Add a `Create Init Script...` command for filesystem-discovered Folder resources.
- Create `init.server.lua`, `init.client.lua`, or `init.lua` through a safe planner that rejects existing init scripts.

## 0.23.0 - Unreleased

- Add a `New Instance...` picker for supported meta-backed directory resources.
- Reuse the existing safe Rojo metadata creation path and conflict checks for generic instance creation.

## 0.22.0 - Unreleased

- Centralize meta-backed directory resource creation through one className definition registry.
- Keep Model, RemoteEvent, RemoteFunction, BindableEvent, and BindableFunction creation behavior unchanged while reducing future command drift.

## 0.21.0 - Unreleased

- Add a `New BindableFunction` command that creates a Rojo directory resource with `init.meta.json` className metadata.
- Keep BindableFunction creation source-backed through Rojo metadata instead of generating binary Roblox assets.

## 0.20.0 - Unreleased

- Add a `New BindableEvent` command that creates a Rojo directory resource with `init.meta.json` className metadata.
- Keep BindableEvent creation source-backed through Rojo metadata instead of generating binary Roblox assets.

## 0.19.0 - Unreleased

- Add a `New RemoteFunction` command that creates a Rojo directory resource with `init.meta.json` className metadata.
- Keep RemoteFunction creation source-backed through Rojo metadata instead of generating binary Roblox assets.

## 0.18.0 - Unreleased

- Add a `New RemoteEvent` command that creates a Rojo directory resource with `init.meta.json` className metadata.
- Keep RemoteEvent creation source-backed through Rojo metadata instead of generating binary Roblox assets.

## 0.17.0 - Unreleased

- Refresh the tree when external filesystem changes create, change, or delete Rojo-relevant source files and directory resources.
- Filter broad filesystem watcher events so unrelated files and common infrastructure folders do not rebuild the tree.

## 0.16.0 - Unreleased

- Add a command to copy workspace-relative source paths from Rojo Explorer nodes.

## 0.15.0 - Unreleased

- Add a `New TOML Module` command that creates Rojo `.toml` ModuleScript resources under filesystem-backed folders.
- Create empty TOML modules as valid empty TOML documents.

## 0.14.0 - Unreleased

- Add a `New JSON Module` command that creates Rojo `.json` ModuleScript resources under filesystem-backed folders.
- Seed new JSON modules with an empty object so the created resource is valid JSON immediately.

## 0.13.0 - Unreleased

- Add a `New LocalizationTable` command that creates Rojo `.csv` resources under filesystem-backed folders.
- Seed new localization tables with the standard CSV header columns used by Rojo's documented example.

## 0.12.0 - Unreleased

- Add a `New StringValue` command that creates Rojo `.txt` resources under filesystem-backed folders.
- Keep StringValue creation source-backed by Rojo plain text files.

## 0.11.0 - Unreleased

- Add a `New Model` command that creates a Rojo directory resource with `init.meta.json` className metadata.
- Keep Model creation source-backed by Rojo metadata instead of generating binary Roblox model assets.

## 0.10.0 - Unreleased

- Add an action to open or create `init.meta.json` files for directory-backed and init-backed filesystem resources.
- Keep `init.meta.json` editing separate from sidecar `.meta.json` editing because Rojo applies those files to different resource scopes.

## 0.9.0 - Unreleased

- Add an action to open or create sidecar `.meta.json` files for filesystem-discovered resources.
- Keep project-controlled resources out of filesystem meta file creation.

## 0.8.0 - Unreleased

- Add a safe duplicate command for filesystem-discovered Rojo resources.
- Preserve Rojo file suffixes and sibling `.meta.json` files during duplicate planning.
- Keep project-controlled resources out of filesystem duplicate operations.

## 0.7.0 - Unreleased

- Add tree drag-and-drop support for moving filesystem-discovered Rojo resources onto filesystem-backed folder resources.
- Reuse the safe move planner for drag-and-drop moves so project-controlled resources and conflicts remain blocked.

## 0.6.0 - Unreleased

- Add a project mapping source path edit action that updates `$path` values in `.project.json`.
- Validate selected source paths before writing project mapping changes.
- Keep `$path` edits separate from filesystem move operations.

## 0.5.0 - Unreleased

- Add a safe move command for filesystem-discovered Rojo resources.
- Move sibling `.meta.json` files with the resource to avoid orphan meta diagnostics.
- Reject target folders that already contain the same Rojo resource name, including different filesystem forms.
- Keep project-controlled resources out of filesystem move operations.

## 0.4.0 - Unreleased

- Add a safe delete command for filesystem-discovered Rojo resources.
- Delete sibling `.meta.json` files with the resource to avoid orphan meta diagnostics.
- Keep project-controlled resources out of filesystem delete operations.

## 0.3.0 - Unreleased

- Add a resource rename command for filesystem-discovered Rojo resources.
- Preserve Rojo file suffixes and sibling `.meta.json` files during rename planning.
- Keep explicit project `$path` mappings out of rename until project JSON edits are supported.
- Mark project-controlled resources in the tree and add an entry to open the owning project file.
- Allow project mapping Studio names to be renamed by updating the corresponding `.project.json` key.
- Keep expandable tree nodes selected on label click so expansion stays on the disclosure arrow.

## 0.2.0 - Unreleased

- Add resource creation commands for Folder, Script, LocalScript, and ModuleScript.
- Create resources only under filesystem-backed folder nodes, with generated path conflict checks.

## 0.1.4 - Unreleased

- Fix folder-backed Explorer nodes opening source directories on normal click.
- Keep normal click-to-open behavior only for file-backed leaf resources.

## 0.1.3 - Unreleased

- Add Simplified Chinese localization for extension manifest text and runtime messages.
- Add localization key coverage tests for manifest and runtime bundles.

## 0.1.2 - Unreleased

- Show Rojo diagnostics as expandable Explorer nodes.
- Add commands to copy source paths and reveal resources in the VS Code Explorer.
- Handle missing source paths without throwing command errors.

## 0.1.1 - Unreleased

- Add GitHub Actions CI for tests, type checking, compilation, and dependency audit.
- Add public repository metadata and project safety workflow documentation.

## 0.0.1 - 2026-06-04

- Initial read-only Rojo Explorer extension.
- Add a Studio-style Tree View for Rojo project files.
- Add Rojo v7-backed domain model, fixtures, and tests.
