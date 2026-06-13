# Step 5.3 — Notion Job Page CRUD

## Goal
Create, update, and query Notion pages in the pipeline database.

## File
- `src/notion/upworkJobsDatabase.js`
- `tests/notionJobsDatabase.test.js` (use mocked notion client)

## Functions
```js
export async function createJobPage(notion, config, job, matches, draft, filterResult)
export async function updateJobStatus(notion, pageId, statusBidLabel)
export async function findJobPageByUrl(notion, config, urlOrJobId)
export async function touchJobPage(notion, pageId)
```

## createJobPage
1. Call `mapJobToNotionProperties(...)`.
2. Call `buildJobPageBlocks(...)` from Step 5.4.
3. `notion.pages.create({ parent: { database_id }, properties, children })`.
4. Return `{ id, url }`.

## updateJobStatus
- `notion.pages.update({ page_id: pageId, properties: { 'Status Bid': selectProperty(statusBidLabel) } })`.

## findJobPageByUrl
- Query database where `Upwork URL = url` or `Vollna URL = url`.
- If not found by URL, try matching `External Job ID` rich_text.
- Return first result or null.

## touchJobPage
- Update `Last Seen At` to now.

## Tests
Mock notion client. Cover create/update/find.
