# Step 8.1 — Upwork RSS Worker

## Goal
Integrate RSS fetch, parsing, filtering, dedup, notifications, AI, Notion, and state.

## File
- `src/scheduler/upworkRssWorker.js`

## Function
```js
export function createUpworkRssWorker(deps)
```
Returns async function `runUpworkRssWorker()`.

## Deps
```js
{
  config,
  logger,
  dedupStore,
  notion,
  telegramBot,
  fetchVollnaFeed,
  loadPortfolioData,
  generateBidDraft
}
```

Also import:
- `parseVollnaItem`
- `evaluateJobCriteria`
- `scoreJob`
- `matchPortfolio`
- Notion create/update functions
- Telegram notification functions
- `buildDedupKey`

## Flow
For each feed item:
1. Fetch feed via `fetchVollnaFeed(config.upworkRssUrl)`.
2. Limit items to `config.maxJobsPerPoll`.
3. Parse item => job.
4. Build dedup key and attach to job: `job.dedupKey`.
5. If existing dedup row: `touch`, count duplicate, continue.
6. Run criteria filter.
7. If rejected: `insertRejected`, count rejected, continue.
8. Send stage 1 Telegram alert if `!wasNotified('stage1:' + dedupKey)`.
9. Load portfolio data.
10. Match portfolio.
11. Generate AI draft.
12. Score job and merge `score`, `priority` into job.
13. If `config.dryRun`, log instead of real Notion write.
14. Else create Notion page.
15. Insert qualified into SQLite with notion page id.
16. Send stage 2 Telegram alert if under `maxNotificationsPerPoll` and not notified.
17. Update Notion status to `Notified` after alert 2.
18. Catch per-item errors; continue next item.

## Stats to log
`seen`, `new`, `duplicate`, `qualified`, `rejected`, `notifiedStage1`, `notifiedStage2`, `errors`, `durationMs`.

## Important
- Do not crash whole worker on one bad item.
- Do not send stage 2 if Notion creation failed.
- Stage 1 is sent before AI/Notion.
