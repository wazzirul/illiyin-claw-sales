# Step 0.2 — Config Loader

## Goal
Create a config module that loads `.env`, parses values safely, and validates required production env.

## Files
- `src/config.js`
- `tests/config.test.js`

## Implement `src/config.js`
Export:
- `parseBoolean(value, defaultValue)`
- `parseList(value)`
- `loadConfig(env = process.env)`
- `config = loadConfig()`

Config fields:
- `nodeEnv`, `timezone`, `runOnStart`, `dryRun`
- `upworkRssUrl`, `upworkRssPollCron`, `upworkRssRequestTimeoutMs`
- `fixedMinBudgetUsd`, `hourlyMinRateUsd`, `requirePaymentVerified`, `allowUnknownPayment`, `blockedKeywords`
- `llmBaseUrl`, `llmApiKey`, `llmModel`, `llmTemperature`, `llmMaxOutputTokens`
- `notionApiKey`, `notionDatabaseId`
- `telegramBotToken`, `telegramSalesChatId`, `telegramAllowedUserIds`, `telegramParseMode`
- `sqliteDbPath`, `portfolioCsvPath`, `upworkWorkDoneCsvPath`
- `maxJobsPerPoll`, `maxNotificationsPerPoll`

Defaults:
- timezone: `Asia/Jakarta`
- cron: `*/2 * * * *`
- fixed min: `500`
- hourly min: `15`
- allow unknown payment: `true`
- sqlite path: `./data/upwork-sales.sqlite`

Validation:
- If `NODE_ENV=production` and `DRY_RUN=false`, require RSS URL, LLM key, Notion key/db, Telegram token/chat.
- Do not log secrets.

## Tests
Cover:
- boolean parsing: true/false/1/0/yes/no
- list parsing from comma and semicolon
- default cron is `*/2 * * * *`
- production missing required env throws

## Verification
`npm test`
