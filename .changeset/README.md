# Changesets

This project uses [Changesets](https://github.com/changesets/changesets) for versioning and changelog generation. Packages are not published to npm (`private: true`); a GitHub Release is created by the Main Release workflow instead.

## Adding a changeset

When a change is user-facing, run:

```bash
pnpm changeset
```

Follow the prompts, then commit the new file under `.changeset/` with your PR.

## Releasing

1. Merge feature PRs (with changesets) to `main`.
2. In GitHub Actions, run **Changeset Release**. That opens a `chore: release version packages` PR which bumps versions and updates `CHANGELOG.md`.
3. Merge the version PR.
4. Run **Main Release**. That tags `vX.Y.Z`, builds desktop installers (with the bundled Tabula JAR and JRE), creates the GitHub Release, and uploads `latest.json` for the in-app updater.

The first public tag can skip steps 2–3 and dispatch **Main Release** on the current `package.json` version (`0.1.0`).

## Release types

- **patch**: Bug fixes and minor improvements
- **minor**: New features (backward compatible)
- **major**: Breaking changes
