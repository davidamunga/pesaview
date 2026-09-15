# pesaview

## 0.3.0

### Minor Changes

- [#10](https://github.com/davidamunga/pesaview/pull/10) [`f9e4e5e`](https://github.com/davidamunga/pesaview/commit/f9e4e5e16a0fb1d0b7005fd6cf583c2e7cad2c33) Thanks [@davidamunga](https://github.com/davidamunga)! - Extract several statements in one go. Pick the PDFs, pick a folder, and get one CSV or Excel per file without opening Review for each.

### Patch Changes

- [#10](https://github.com/davidamunga/pesaview/pull/10) [`f9e4e5e`](https://github.com/davidamunga/pesaview/commit/f9e4e5e16a0fb1d0b7005fd6cf583c2e7cad2c33) Thanks [@davidamunga](https://github.com/davidamunga)! - Finish decade-long statements: remembered layouts stamp every page, Tabula no longer dies at 90 seconds, and Review can scroll tens of thousands of rows.

- [#10](https://github.com/davidamunga/pesaview/pull/10) [`a39e1c4`](https://github.com/davidamunga/pesaview/commit/a39e1c4060cddef1b169de909606744a436b021e) Thanks [@davidamunga](https://github.com/davidamunga)! - Keep M-PESA receipt numbers and completion times in their own columns, and fold a wrapped time on the next page back onto that receipt.

- [#10](https://github.com/davidamunga/pesaview/pull/10) [`a39e1c4`](https://github.com/davidamunga/pesaview/commit/a39e1c4060cddef1b169de909606744a436b021e) Thanks [@davidamunga](https://github.com/davidamunga)! - Keep every M-PESA transaction on a long statement: page 1 starts after the summary, later pages start at the first receipt, and the footer is left out.

- [#10](https://github.com/davidamunga/pesaview/pull/10) [`ad6e803`](https://github.com/davidamunga/pesaview/commit/ad6e8030c65367793b8402292edbc4540205e576) Thanks [@davidamunga](https://github.com/davidamunga)! - Use the current page’s table box on every other page, and show those boxes in the sidebar before every thumbnail has finished rendering.

- [#10](https://github.com/davidamunga/pesaview/pull/10) [`a39e1c4`](https://github.com/davidamunga/pesaview/commit/a39e1c4060cddef1b169de909606744a436b021e) Thanks [@davidamunga](https://github.com/davidamunga)! - On Review, say when headers don’t match the cells, keep Export quiet until that’s checked, and make dropping a row obvious without hovering.

- [#10](https://github.com/davidamunga/pesaview/pull/10) [`a39e1c4`](https://github.com/davidamunga/pesaview/commit/a39e1c4060cddef1b169de909606744a436b021e) Thanks [@davidamunga](https://github.com/davidamunga)! - Keep Continue visible on the Tables bar, and show Review filling in while a long statement is read — with page progress instead of a blank wait.

## 0.2.2

### Patch Changes

- [#8](https://github.com/davidamunga/pesaview/pull/8) [`c2fd092`](https://github.com/davidamunga/pesaview/commit/c2fd092b1dcbca05dc2f6cf2b1f040826c5cd02e) Thanks [@davidamunga](https://github.com/davidamunga)! - Keep empty ledger columns aligned when stream extraction omits blank cells.

## 0.2.1

### Patch Changes

- [#6](https://github.com/davidamunga/pesaview/pull/6) [`8d834f7`](https://github.com/davidamunga/pesaview/commit/8d834f77479791621e7da98d9f96f400306dc4de) Thanks [@davidamunga](https://github.com/davidamunga)! - Find rows in Review from the toolbar or ⌘F. Export still writes the full statement.

- [#6](https://github.com/davidamunga/pesaview/pull/6) [`0086177`](https://github.com/davidamunga/pesaview/commit/0086177e5e722c336fbbfbe9f6d2b36d9353035e) Thanks [@davidamunga](https://github.com/davidamunga)! - Unlock password-protected statements and show when tables are being found.

- [#6](https://github.com/davidamunga/pesaview/pull/6) [`e662c5e`](https://github.com/davidamunga/pesaview/commit/e662c5ef324ce4bc7fb7e676f82de2683fce4b1c) Thanks [@davidamunga](https://github.com/davidamunga)! - Open at 960px so the review ledger can show particulars and amounts together.

## 0.2.0

### Minor Changes

- [#3](https://github.com/davidamunga/pesaview/pull/3) [`60932f7`](https://github.com/davidamunga/pesaview/commit/60932f7dc58f458c6a27e91a2d94d3e5ed79fa73) Thanks [@davidamunga](https://github.com/davidamunga)! - Fit statements to compact windows, add pinch and button zoom, and make the review grid scroll on the same green surface as the rest of the app.

## 0.1.2

### Patch Changes

- [`82e8817`](https://github.com/davidamunga/pesaview/commit/82e8817c0b9ed62aac1b5e9a74fdaaa743fcbc0b) Thanks [@davidamunga](https://github.com/davidamunga)! - Publish SHA256 checksums and MSI/RPM downloads, and fix Linux installer links on GitHub Releases.

## 0.1.1

### Patch Changes

- [`67adeea`](https://github.com/davidamunga/pesaview/commit/67adeea1b9569608f26374588d6b84d13fc56039) Thanks [@davidamunga](https://github.com/davidamunga)! - Ship signed desktop releases with Changesets, bundled Tabula JRE, and in-app auto-update.
