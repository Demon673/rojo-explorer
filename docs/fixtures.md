# Fixtures

The fixture projects under `fixtures/` are intentionally small. They exist to prove Rojo Explorer's read-only model against the documented Rojo v7 project and sync rules.

## Fixtures

- `basic-place`: DataModel project with common Roblox services and script mappings.
- `init-scripts`: directories changed into script instances by init scripts, including a duplicate init diagnostic case.
- `meta-files`: `init.meta.json` and sibling `.meta.json` files that apply properties or `ignoreUnknownInstances`.
- `models-and-data`: model files plus data files that Rojo maps into Roblox instances.
- `roblox-ts-like`: generated-output-style folders used to verify that the explorer does not assume `$path` points to hand-authored source.

## Validation

The Vitest suite builds `RojoProjectModel` values from these projects and asserts class names, Studio paths, source paths, metadata, and diagnostics.
