# Agent Notes

This repository is a VS Code extension for Roblox Rojo workflows.

## Product Contract

- The extension should present a Roblox Studio-like resource explorer inside VS Code.
- The target users are editing Rojo workspaces or standalone folders that map source files into Roblox Studio services.
- The explorer should respect Rojo project files, especially `default.project.json` and other `*.project.json` files.
- v1 is read-only: browse, diagnose, open/reveal source, and copy Studio paths. Do not add resource creation, rename, delete, move, serve, build, or sync behavior unless explicitly requested.
- The explorer should help understand workspace files through the Studio resource model without treating generated sourcemaps or binary Roblox assets as primary editable source.
- Rojo semantics must be grounded in official Rojo docs or explicitly identified release notes. Keep `docs/rojo-semantics.md` current when adding rules.

## Engineering Conventions

- Keep the extension implementation in TypeScript under `src/`.
- Build output goes to `out/` and should not be edited by hand.
- Use Git as the rollback boundary. Start risky work from a feature branch, commit validated milestones, and prefer `git revert` for pushed history.
- Prefer VS Code APIs for workspace file reads, file watching, commands, and tree views.
- Keep Rojo parsing in the domain layer under `src/domain/`. The VS Code TreeView should consume `RojoProjectModel` instead of inferring Rojo behavior directly.
- Do not hard-code one Roblox project layout. Multiple workspace folders and multiple `*.project.json` files should remain valid.
- Do not special-case roblox-ts as a project type. Treat roblox-ts output folders as normal Rojo mapped folders unless a future feature has documented behavior to support.

## Validation

- Use `npm run test`, `npm run typecheck`, and `npm run compile` as the first local validation checks.
- `npm audit` should remain clean for committed dependencies.
- Use the Extension Development Host (`F5`) to verify tree behavior in an actual Rojo workspace.
