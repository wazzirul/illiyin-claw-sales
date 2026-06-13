# Step 7.1 — Telegram Client

## Goal
Create and export Telegram bot instance.

## File
- `src/telegram/telegramClient.js`

## Function
```js
export function createTelegramBot(config)
```

Requirements:
- Use `node-telegram-bot-api`.
- Use `{ polling: true }` for VPS polling mode.
- If `config.dryRun === true`, return a mock bot with no-op methods:
  - `sendMessage(chatId, text, opts)` => logs instead of sends, returns fake message object.
  - `on(event, handler)` => no-op.

## Verification
Module imports cleanly. DRY_RUN mock mode works without a real token.
