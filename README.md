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

Java 8+ is required for extraction (`java` on PATH, or the bundled JRE).

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
