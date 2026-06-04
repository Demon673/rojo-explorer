# Rojo Semantics

This file is the implementation contract for Rojo Explorer's Rojo project model and resource-management safety boundaries. Rules marked as implemented must be backed by official Rojo documentation or an explicitly named release note.

## Sources

- Rojo Project Format: https://rojo.space/docs/v7/project-format/
- Rojo Sync Details: https://rojo.space/docs/v7/sync-details/
- Rojo Installation and VS Code extension role: https://rojo.space/docs/v7/getting-started/installation/
- Rojo releases for version-specific behavior: https://github.com/rojo-rbx/rojo/releases
- roblox-ts Rojo workflow reference: https://roblox-ts.com/docs/guides/syncing-with-rojo/

## Model Scope

Rojo Explorer builds a Studio-style resource tree from `*.project.json` files and mapped filesystem contents. It does not start or stop Rojo servers, modify Roblox binary assets, build place files, or perform Studio sync.

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

## Resource Management Notes

- Filesystem-backed create, rename, duplicate, move, and delete commands operate only on resources discovered from mapped source folders.
- Filesystem-backed Model creation creates a directory plus `init.meta.json` with `className` set to `Model`; it does not generate `.rbxm` or `.rbxmx` assets.
- Filesystem-backed RemoteEvent creation creates a directory plus `init.meta.json` with `className` set to `RemoteEvent`; it does not generate binary Roblox assets.
- Filesystem-backed RemoteFunction creation creates a directory plus `init.meta.json` with `className` set to `RemoteFunction`; it does not generate binary Roblox assets.
- Filesystem-backed BindableEvent creation creates a directory plus `init.meta.json` with `className` set to `BindableEvent`; it does not generate binary Roblox assets.
- Filesystem-backed BindableFunction creation creates a directory plus `init.meta.json` with `className` set to `BindableFunction`; it does not generate binary Roblox assets.
- Supported meta-backed directory creation commands share one planner path so every supported class creates the same directory plus `init.meta.json` structure.
- Generic `New Instance...` creation is limited to the same supported meta-backed directory classes; v1 does not accept arbitrary className input.
- Filesystem-backed JSON Module creation creates a plain `.json` file with `{}` content; it does not create `.model.json` or `.project.json` files.
- Filesystem-backed TOML Module creation creates a plain `.toml` file, matching Rojo's TOML module sync rule.
- Filesystem-backed StringValue creation creates a `.txt` file, matching Rojo's plain text sync rule.
- Filesystem-backed LocalizationTable creation creates a `.csv` file with `Key,Source,Context,Example` headers, matching Rojo's localization table sync rule.
- Filesystem-backed meta editing opens or creates sidecar `.meta.json` files for resources discovered from mapped source folders.
- Filesystem-backed init meta editing opens or creates `init.meta.json` inside directory-backed and init-backed resources, because Rojo applies `init.meta.json` to the containing directory instance.
- Tree drag-and-drop move uses the same filesystem-backed move planner as the context-menu move command.
- Project-controlled resources are edited through `.project.json`, not through filesystem rename, move, or delete commands.
- Project mapping source path edits update the selected tree node's `$path` value. New paths are written relative to the project file when possible, matching Rojo's project format behavior.
- File-backed `$path` targets must match Rojo's supported sync rules before the extension writes the project file.

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
