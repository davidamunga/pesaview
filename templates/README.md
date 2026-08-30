# Templates

JSON files here are example layouts. The extractor stays generic: these files only store where the table sits, which Tabula method to use, and optional cleanup.

Add a new file when a layout works. No code change is required.

```json
{
  "id": "kcb-current",
  "name": "KCB current account",
  "normalized": true,
  "match": ["value date", "narration"],
  "skipRows": ["Page Total", "Note:"],
  "columns": ["Date", "Narration", "Debit", "Credit", "Balance"],
  "areas": [
    { "page": 1, "top": 0.28, "left": 0.04, "bottom": 0.94, "right": 0.96, "method": "stream" },
    { "page": 0, "top": 0.14, "left": 0.04, "bottom": 0.94, "right": 0.96, "method": "stream" }
  ]
}
```

- `page: 1` is the first page (taller letterhead). `page: 0` is every other page.
- Coordinates are 0–1 fractions of the page, so A4 and taller pages share one file.
- `match` tokens, if all present in Tabula’s text, attach this template’s `skipRows` / `columns` after autodetect.
- `columns` is used only when Tabula returns that many columns.
- Wrapped lines (Details that spill onto the next PDF line) are folded into the previous row by default. Set `"mergeRows": false` to keep them separate.
