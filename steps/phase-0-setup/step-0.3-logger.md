# Step 0.3 — Logger

## Goal
Create a small structured logger.

## File
- `src/logger.js`

## Requirements
Export `logger` with methods:
- `info(meta, message)`
- `warn(meta, message)`
- `error(meta, message)`

Behavior:
- Output JSON lines.
- Support call shapes: `logger.info('message')` and `logger.info({ ok: true }, 'message')`.
- Convert Error objects to `{ name, message, stack }`.
- Never print API keys if a meta key includes `key`, `token`, `secret`, or `auth`.

## Example output
```json
{"level":"info","message":"test","ok":true}
```

## Verification
```bash
node -e "import('./src/logger.js').then(({logger}) => logger.info({ok:true}, 'test'))"
```
