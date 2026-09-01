# PesaView

Desktop app for turning statement PDFs into tables. Draw or autodetect table regions, preview the grid, then export CSV or Excel. Everything runs locally.

The extractor is generic. Bank and year differences live in JSON templates, not in code.

## Stack

- Tauri v2, React 19, TypeScript, Vite 7
- Tailwind 4 + shadcn (Base UI / New York)
- Bundled Tabula JAR + optional jlink JRE

## Develop

```bash
pnpm install
# Optional: bundle a JRE. System Java is used if this is skipped.
pnpm setup-jre
pnpm tauri dev
```

Java 8+ is required for extraction (`java` on PATH, or the bundled JRE). Release installers bundle a JRE, so end users do not need Java installed.

## Use

1. Open a statement PDF.
2. Autodetect finds the ledger, or draw a box. Apply a template if the box needs a nudge.
3. **Preview & Export** → CSV or Excel.
4. **Save current selections…** to reuse a layout.

## Templates

Example layouts live in [`templates/`](templates/). Add a JSON file there when a new statement works — no TypeScript change. See [`templates/README.md`](templates/README.md).

## Tests

```bash
pnpm test
cargo test --manifest-path src-tauri/Cargo.toml
```

## Release

Versioning uses [Changesets](https://github.com/changesets/changesets). Packages are not published to npm. GitHub Actions builds signed desktop installers (macOS, Windows, Linux) with the Tabula JAR and a jlink JRE, then publishes a GitHub Release and `latest.json` for the in-app updater.

1. On a user-facing PR, run `pnpm changeset` and commit the file under `.changeset/`.
2. After merge to `main`, run **Changeset Release** in GitHub Actions. Merge the `chore: release version packages` PR it opens (this bumps `package.json`, `Cargo.toml`, `tauri.conf.json`, and `CHANGELOG.md`).
3. Run **Main Release** to tag `vX.Y.Z`, build all platforms, and publish the GitHub Release.

The first public tag can skip steps 1–2: dispatch **Main Release** on the current `0.1.0`.

### GitHub secrets

Copy the Apple notarization secrets from the mpesa2csv repo. Generate a **new** Tauri updater keypair for this app (`pnpm tauri signer generate -w ~/.tauri/pesaview.key`). The public half is already in `src-tauri/tauri.conf.json`. Add:

| Secret | Purpose |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | Contents of `~/.tauri/pesaview.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Key password (empty if none) |
| `APPLE_CERTIFICATE` | Base64-encoded Developer ID `.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the `.p12` |
| `KEYCHAIN_PASSWORD` | Temporary keychain used during CI signing |
| `APPLE_SIGNING_IDENTITY` | Developer ID Application identity string |
| `APPLE_ID` | Apple ID used for notarization |
| `APPLE_PASSWORD` | App-specific Apple password |
| `APPLE_TEAM_ID` | Apple Developer Team ID |
