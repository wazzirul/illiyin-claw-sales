# Step 4.3 — Generate Bid Draft

## Goal
Call LLM and return structured bid draft. Fallback safely on error.

## File
- `src/ai/generateBidDraft.js`
- `tests/generateBidDraft.test.js`

## Function
```js
export async function generateBidDraft(job, matches, config)
```

## Return schema
```js
{
  jobSummary: [],
  clientNeed: '',
  fitAnalysis: '',
  redFlags: [],
  questionsToAsk: [],
  recommendedPortfolioIds: [],
  recommendedUpworkWorkIds: [],
  coverLetter: '',
  bidStrategy: '',
  priority: 'medium',
  confidence: 0.75,
}
```

## Requirements
- Call `buildCoverLetterPrompt(job, matches)`.
- Call `callLlmJson(...)`.
- Validate returned fields exist, fallback to empty string/array if missing.
- On LLM failure, return minimal draft with `coverLetter = 'AI draft failed. Please write manually.'` and `redFlags = ['AI generation error']`.
- Do NOT throw outside of logs.

## Tests (use mocked LLM)
- Valid LLM response returns mapped draft.
- LLM failure returns fallback draft without throwing.
