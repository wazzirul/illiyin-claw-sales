# Step 8.3 — App Entrypoint

## Goal
Wire all modules together at startup.

## File
- `src/index.js`

## Startup steps
1. Import `config`, `logger`.
2. Open SQLite DB and run migration.
3. Create `dedupStore`.
4. Create Notion client.
5. Create Telegram bot.
6. Register Telegram commands.
7. Create RSS worker via `createUpworkRssWorker`.
8. Start scheduler.
9. If `config.runOnStart === true`, run worker once.
10. Handle SIGINT/SIGTERM gracefully: close DB and stop bot polling if available.

## Dependencies to inject
```js
const worker = createUpworkRssWorker({
  config,
  logger,
  dedupStore,
  notion,
  telegramBot,
  fetchVollnaFeed,
  loadPortfolioData,
  generateBidDraft,
});
```

## Verification
Run dry mode:
```bash
DRY_RUN=true RUN_ON_START=false npm start
```
Expected: app starts, scheduler registered, no crash.

Run once dry mode after RSS URL configured:
```bash
DRY_RUN=true RUN_ON_START=true npm start
```
Expected: fetch/parse/filter logs.
