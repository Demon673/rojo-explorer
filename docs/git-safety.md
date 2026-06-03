# Git Safety Workflow

This project uses Git as the rollback boundary for every meaningful change.

## Default Workflow

1. Start by checking `git status --short --branch`.
2. Work from a feature branch named for the task, for example `feature/resource-create`.
3. Keep `main` deployable and backed by CI.
4. Commit after each validated milestone.
5. Push the feature branch after a stable commit.
6. Merge to `main` only after tests, typecheck, compile, and audit pass.

## Checkpoints

Create a checkpoint commit before:

- Large refactors.
- Moving or deleting files.
- Changing the Rojo domain model.
- Changing resource creation, rename, delete, or move behavior.
- Updating dependencies in a way that changes the lockfile substantially.

## Rollback Rules

- Prefer `git revert` for commits that have already been pushed.
- Avoid `git reset --hard`, `git clean`, force-push, and destructive branch deletion unless explicitly requested.
- Use tags for stable milestones, for example `v0.1-readonly-explorer`.

## Verification Commands

Run these before committing meaningful changes:

```bash
npm run test
npm run typecheck
npm run compile
npm audit
```
