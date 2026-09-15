# pesaview

## 0.4.0

### Minor Changes

- Use Inter for the app chrome so labels, buttons, and headings match the site. The statement grid still uses Source Serif. ([#13](https://github.com/davidamunga/pesaview/pull/13))

### Patch Changes

- Show the version next to PesaView. Feedback is in the chrome; the Upload screen names David Amunga. ([#14](https://github.com/davidamunga/pesaview/pull/14))

## 0.3.0

### Minor Changes

- Extract several statements in one go. Pick the PDFs, pick a folder, and get one CSV or Excel per file without opening Review for each. ([#10](https://github.com/davidamunga/pesaview/pull/10))

### Patch Changes

- Finish decade-long statements: remembered layouts stamp every page, Tabula no longer dies at 90 seconds, and Review can scroll tens of thousands of rows. ([#10](https://github.com/davidamunga/pesaview/pull/10))
- Keep M-PESA receipt numbers and completion times in their own columns, and fold a wrapped time on the next page back onto that receipt. ([#10](https://github.com/davidamunga/pesaview/pull/10))
- Keep every M-PESA transaction on a long statement: page 1 starts after the summary, later pages start at the first receipt, and the footer is left out. ([#10](https://github.com/davidamunga/pesaview/pull/10))
- Use the current page’s table box on every other page, and show those boxes in the sidebar before every thumbnail has finished rendering. ([#10](https://github.com/davidamunga/pesaview/pull/10))
- On Review, say when headers don’t match the cells, keep Export quiet until that’s checked, and make dropping a row obvious without hovering. ([#10](https://github.com/davidamunga/pesaview/pull/10))
- Keep Continue visible on the Tables bar, and show Review filling in while a long statement is read — with page progress instead of a blank wait. ([#10](https://github.com/davidamunga/pesaview/pull/10))

## 0.2.2

### Patch Changes

- Keep empty ledger columns aligned when stream extraction omits blank cells. ([#8](https://github.com/davidamunga/pesaview/pull/8))

## 0.2.1

### Patch Changes

- Find rows in Review from the toolbar or ⌘F. Export still writes the full statement. ([#6](https://github.com/davidamunga/pesaview/pull/6))
- Unlock password-protected statements and show when tables are being found. ([#6](https://github.com/davidamunga/pesaview/pull/6))
- Open at 960px so the review ledger can show particulars and amounts together. ([#6](https://github.com/davidamunga/pesaview/pull/6))

## 0.2.0

### Minor Changes

- Fit statements to compact windows, add pinch and button zoom, and make the review grid scroll on the same green surface as the rest of the app. ([#3](https://github.com/davidamunga/pesaview/pull/3))

## 0.1.2

### Patch Changes

- Publish SHA256 checksums and MSI/RPM downloads, and fix Linux installer links on GitHub Releases.

## 0.1.1

### Patch Changes

- Ship signed desktop releases with Changesets, bundled Tabula JRE, and in-app auto-update.
