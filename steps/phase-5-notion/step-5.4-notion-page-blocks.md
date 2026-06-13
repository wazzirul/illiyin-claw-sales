# Step 5.4 — Notion Page Body Blocks

## Goal
Build the Notion block children array for a job page.

## File
- `src/notion/buildJobPageBlocks.js`
- `tests/buildJobPageBlocks.test.js`

## Function
```js
export function buildJobPageBlocks(job, matches, draft)
```

Returns an array of Notion block objects.

## Sections to include (in order)
1. Heading 2: "Job Summary" — bulleted list of `draft.jobSummary`.
2. Heading 2: "Cover Letter Draft" — paragraph with `draft.coverLetter`.
3. Heading 2: "Recommended Portfolio" — numbered list of matched portfolio items.
4. Heading 2: "Recommended Upwork Work" — numbered list.
5. Heading 2: "Red Flags" — bulleted list of `draft.redFlags`.
6. Heading 2: "Questions to Ask" — numbered list of `draft.questionsToAsk`.
7. Heading 2: "Bid Strategy" — paragraph.
8. Heading 2: "Original Job Description" — paragraph with `job.descriptionText`.
9. Heading 2: "Internal Notes" — paragraph with payment warning if needed.

## Helper functions
```js
function heading2(text)
function paragraph(text)            // split if > 2000 chars
function bulletedItem(text)
function numberedItem(text)
```

## Tests
- Returns array of block objects.
- Long cover letter split into multiple paragraphs.
- Empty lists produce no items block.
