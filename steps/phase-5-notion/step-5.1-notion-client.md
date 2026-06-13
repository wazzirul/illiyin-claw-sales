# Step 5.1 — Notion Client

## Goal
Create the Notion client instance.

## File
- `src/notion/notionClient.js`

## Function
```js
export function createNotionClient(config)
```

Requirements:
- Use `@notionhq/client`.
- Return `new Client({ auth: config.notionApiKey })`.
- Export also a `getNotionPageUrl(pageId)` helper that returns:
  `https://www.notion.so/${pageId.replace(/-/g, '')}`

## Verification
Module imports cleanly without .env.
