# PesaView

Turn bank and M-PESA statement PDFs into a spreadsheet. Open a file, mark the table, review the rows, export CSV or Excel. Nothing leaves this computer.

[Download](https://github.com/davidamunga/pesaview/releases/latest) for macOS, Windows, and Linux.

## Use

1. **Upload** a PDF. Password-protected files are fine.
2. **Tables** — draw a box around the transaction rows, or use Autodetect.
3. **Review** — fix headers and rows, then export.

You can remember a layout for the next statement of the same kind.

## Develop

```bash
pnpm install
pnpm tauri dev
```

Needs [Tauri’s OS prerequisites](https://v2.tauri.app/start/prerequisites/) and Java 8+ on your `PATH` so extraction can run.

```bash
pnpm test
```

## Release

User-facing PRs include a [changeset](.changeset/README.md). Versions and installers ship from GitHub Actions on `main`.
