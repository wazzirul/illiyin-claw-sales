# Step 1.1 — RSS Fetcher

## Goal
Fetch and parse Vollna RSS feed.

## File
- `src/rss/fetchVollnaFeed.js`
- `tests/fetchVollnaFeed.test.js`

## Function
```js
export async function fetchVollnaFeed(url, options = {})
```

## Requirements
- Use `rss-parser`.
- Accept timeout via `options.timeoutMs`.
- Throw clear error if URL missing.
- Throw clear error if feed has no items.
- Return object with: `title`, `link`, `lastBuildDate`, `pubDate`, `expireDate`, `items`.
- Preserve raw item fields.

## Tests
Mock parser or use fixture XML from Step 1.2 after created.

## Verification
`npm test`
