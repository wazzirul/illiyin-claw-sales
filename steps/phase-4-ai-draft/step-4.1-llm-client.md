# Step 4.1 — LLM Client

## Goal
HTTP client for OpenAI-compatible chat completions API that returns parsed JSON.

## File
- `src/ai/llmClient.js`
- `tests/llmClient.test.js`

## Function
```js
export async function callLlmJson({ system, user, config })
```

## Requirements
- POST to `config.llmBaseUrl + '/chat/completions'`.
- Authorization header: `Bearer config.llmApiKey`.
- Body: model, temperature, max_tokens, messages.
- Parse response: `choices[0].message.content`.
- Try `JSON.parse(content)`. If fails, try extracting JSON from markdown code block.
- On invalid JSON, retry once with a repair prompt appended.
- Throw on 2nd failure.
- Redact API key in any error logs.

## Tests
Mock `fetch`. Cover:
- Valid JSON response parsed correctly.
- Markdown-wrapped JSON extracted.
- Invalid JSON retry logic (mock second attempt returns valid).
- 2nd failure throws.
