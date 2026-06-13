# Step 3.3 — Portfolio Matcher

## Goal
Score and rank portfolio items against a job.

## File
- `src/portfolio/matchPortfolio.js`
- `tests/matchPortfolio.test.js`

## Function
```js
export function matchPortfolio(job, { portfolioItems, upworkWorkItems })
```

## Return
```js
{
  portfolio: [{ id, title, score, reason }],  // top 3
  upworkWork: [{ id, title, score, reason }]  // top 2
}
```

## Scoring per item
- exact skill match between item.skills and job.skills/keywords: +3 per match
- category match: +2
- industry match: +2
- title keyword match: +1
- proof_strength = 'high': +2
- upwork work items get +3 bonus

## Job keywords
Extract from: `job.jobTitle`, `job.skills`, `job.categories`, `job.descriptionText` (first 500 chars).

## Rules
- Items with `permission_to_mention = 'no'` are still scored/included BUT do NOT include client_name in the reason string.
- Return arrays sorted by score descending.
- Return empty arrays if no items loaded.

## Tests
- Automation job matches PF-003 and UW-002 over PF-001.
- Empty CSV returns empty result.
- permission_to_mention=no does not expose client name.
