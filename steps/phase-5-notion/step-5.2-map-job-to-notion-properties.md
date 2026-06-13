# Step 5.2 — Map Job to Notion Properties

## Goal
Convert a job+draft+matches into the Notion API properties object.

## File
- `src/notion/mapJobToNotionProperties.js`
- `tests/mapJobToNotionProperties.test.js`

## Function
```js
export function mapJobToNotionProperties(job, matches, draft)
```

## Required property helpers (local functions)
```js
function titleProperty(text)
function richTextProperty(text)     // truncate to 2000 chars
function selectProperty(name)
function multiSelectProperty(names) // each name max 100 chars
function numberProperty(value)
function urlProperty(url)           // null if falsy
function dateProperty(date)         // ISO string or null
```

## Properties to map
See plan.md section 13.2 full list.
Key ones:
- Name (title) => job.jobTitle
- Status Bid (select) => "New"
- Filter Status (select) => filterResult.status capitalized
- Priority (select) => draft.priority capitalized
- Score (number) => scoredJob.score
- Job Type (select) => job.jobType capitalized
- Fixed Budget USD / Hourly Min USD / Max USD (number)
- Payment Verified (select) => "Verified" | "Unverified" | "Unknown"
- Upwork URL (url) / Vollna URL (url)
- External Job ID (rich_text)
- Published At / First Seen At / Last Seen At (date)
- Categories / Skills (multi_select)
- Recommended Portfolio / Recommended Upwork Work (rich_text)
- Cover Letter (rich_text, truncate)
- Job Summary / Fit Analysis / Red Flags / Questions / Bid Strategy (rich_text)
- Raw Description (rich_text, truncate)
- Dedup Key (rich_text)

## Tests
- Verify cover letter truncated at 2000 chars.
- Verify multi_select names capped at 100 chars.
- Null url property for empty strings.
