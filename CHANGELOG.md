# Changelog

All notable changes to Rojo Explorer will be documented in this file.

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
