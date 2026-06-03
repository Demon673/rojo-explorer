# Rojo Semantics

This file is the implementation contract for Rojo Explorer's read-only v1 model. Rules marked as implemented must be backed by official Rojo documentation or an explicitly named release note.

## Sources

- Rojo Project Format: https://rojo.space/docs/v7/project-format/
- Rojo Sync Details: https://rojo.space/docs/v7/sync-details/
- Rojo Installation and VS Code extension role: https://rojo.space/docs/v7/getting-started/installation/
- Rojo releases for version-specific behavior: https://github.com/rojo-rbx/rojo/releases
- roblox-ts Rojo workflow reference: https://roblox-ts.com/docs/guides/syncing-with-rojo/

## v1 Scope

Rojo Explorer v1 is read-only. It builds a Studio-style resource tree from `*.project.json` files and mapped filesystem contents. It does not start or stop Rojo servers, modify Roblox assets, create resources, rename resources, delete resources, or perform Studio sync.

## Implemented Rules

| Rule | Status | Basis |
| --- | --- | --- |
| Project files use the `.project.json` extension and contain a `tree` instance description. | implemented | Rojo Project Format |
| Project `name` is used as the display fallback when present. | implemented | Rojo Project Format |
| `$className` sets the class name for an instance description. | implemented | Rojo Project Format |
| `$path` resolves relative to the containing project file. | implemented | Rojo Project Format |
| `$properties` are preserved on model nodes for display and future operations. | implemented | Rojo Project Format |
| `$ignoreUnknownInstances` is preserved on model nodes. | implemented | Rojo Project Format |
| Any directory becomes a `Folder` unless changed by init files, `init.meta.json`, or included projects. | implemented | Rojo Sync Details |
| `*.server.lua` maps to `Script`. | implemented | Rojo Sync Details |
| `*.client.lua` maps to `LocalScript`. | implemented | Rojo Sync Details |
| Other `*.lua` maps to `ModuleScript`. | implemented | Rojo Sync Details |
| `init.server.lua`, `init.client.lua`, and `init.lua` change the containing directory into a script instance. | implemented | Rojo Sync Details |
| Only one init script may be present in one directory. | implemented with diagnostic | Rojo Sync Details |
| `.rbxm` and `.rbxmx` files are model resources and are only displayed/located by v1. | implemented | Rojo Sync Details |
| `.model.json` maps to a JSON model resource. | implemented | Rojo Sync Details |
| Non-model `.json` files map to `ModuleScript`. | implemented | Rojo Sync Details |
| `.toml` files map to `ModuleScript`. | implemented | Rojo Sync Details |
| `.txt` files map to `StringValue`. | implemented | Rojo Sync Details |
| `.csv` files map to `LocalizationTable`. | implemented | Rojo Sync Details |
| `.meta.json` files modify target resources and are not shown as normal tree nodes. | implemented | Rojo Sync Details |
| `init.meta.json` may change a containing directory's className. | implemented | Rojo Sync Details |
| A directory containing `default.project.json` uses that project instead of normal directory contents. | implemented | Rojo Sync Details |
| `globIgnorePaths` hides matching filesystem paths from scanned mapped folders. | implemented | Rojo Project Format |

## Version-Specific Rules

| Rule | Status | Basis |
| --- | --- | --- |
| `.luau`, `.server.luau`, `.client.luau`, and init `.luau` variants are accepted using the same mapping as `.lua`. | implemented | Rojo v7.4 release-family notes and current Rojo project defaults |
| `syncRules` behavior is deferred. | deferred | Rojo release notes |
| `syncback` behavior is deferred. | deferred | Rojo release notes |
| Detailed `emitLegacyScripts = false` RunContext modeling is deferred. | deferred | Rojo Project Format |

## Known v1 Limits

- v1 does not parse the internals of `.rbxm`, `.rbxmx`, or `.model.json`; those files are represented as single source-backed resources.
- v1 preserves properties but does not validate them against Roblox API metadata.
- v1 does not treat roblox-ts as a special project type. roblox-ts output folders are ordinary Rojo mapped folders.
