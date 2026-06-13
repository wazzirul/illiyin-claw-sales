# Step 4.2 — Cover Letter Prompt Builder

## Goal
Build the system + user prompt for AI cover letter generation.

## File
- `src/ai/buildCoverLetterPrompt.js`
- `tests/buildCoverLetterPrompt.test.js`

## Function
```js
export function buildCoverLetterPrompt(job, matches)
```

Returns `{ system: string, user: string }`.

## System prompt must include
- Illiyin Studio identity.
- Rules: no fabrication, no generic phrases, concise human tone.
- Respect `permission_to_mention=no` (do not mention client identity).
- Output valid JSON only.
- JSON schema as expected output.

## User prompt must include
- Job JSON (title, budget, type, description, skills, categories).
- Matched portfolio items with their details.
- Matched upwork work items — omit client_name if permission_to_mention=no.

## Tests
- permission_to_mention=no strips client_name from prompt.
- Output includes `system` and `user` strings.
- User prompt contains job title and matched IDs.
