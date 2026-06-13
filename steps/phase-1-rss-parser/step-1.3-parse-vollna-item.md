# Step 1.3 — Parse Vollna Item

## Goal
Normalize one RSS item into a job object.

## File
- `src/rss/parseVollnaItem.js`
- `tests/parseVollnaItem.test.js`

## Function
```js
export function parseVollnaItem(item)
```

## Output fields
`source`, `rssTitle`, `jobTitle`, `jobType`, `fixedBudgetUsd`, `hourlyMinUsd`, `hourlyMaxUsd`, `descriptionText`, `skills`, `categories`, `pubDate`, `vollnaUrl`, `upworkUrl`, `externalJobId`, `paymentVerified`.

## Rules
- `source` is `vollna_rss`.
- Strip budget suffix from `jobTitle` where possible.
- Detect `fixed`, `hourly`, or `unknown`.
- Clean HTML/CDTA description to plain text.
- Extract `Skills:` as array split by comma/semicolon.
- Merge XML categories and description categories, remove duplicates.
- Payment values: `verified`, `unverified`, `unknown`.
- Use URL/money utilities from Steps 1.4 and 1.5.

## Tests
- Fixed `1,500 USD` => `1500`.
- Fixed `500 USD` => `500`.
- Hourly variants parsed.
- Double-encoded Upwork URL decoded.
- Job ID extracted.
- Skills/categories extracted.
