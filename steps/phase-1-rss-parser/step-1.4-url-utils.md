# Step 1.4 — URL Utilities

## Goal
Create utilities for nested Vollna URL decoding and dedup-safe normalization.

## File
- `src/utils/urls.js`
- `tests/urls.test.js`

## Functions
```js
export function extractNestedUrlParam(url, paramName = 'url')
export function extractUpworkUrl(vollnaUrl)
export function normalizeUrl(url)
export function extractUpworkJobId(url)
```

## Requirements
- Decode nested `url` param up to 3 times.
- Validate Upwork host for `extractUpworkUrl`.
- Normalize URL: lowercase host, remove trailing slash, remove tracking params (`utm_*`, `source`, `ref`).
- Extract job id from `/jobs/~...`.
- Return `null` for invalid input, do not throw for bad URLs.

## Tests
Cover double-encoded Vollna URL, invalid URL, trailing slash, tracking params, Upwork job ID.
