# Step 0.1 — Init Node Project

## Goal
Bootstrap the Node.js project with all dependencies and base config files.

## Working directory
/Users/wazirul/Works/illiyinclaw-sales

## Files to create

### package.json
```json
{
  "name": "illiyinclaw-sales",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "dev": "NODE_ENV=development node src/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src tests"
  }
}
```

### .gitignore
```
node_modules/
.env
data/upwork-sales.sqlite
data/*.sqlite
logs/
*.log
```

### .env.example
```env
# App
NODE_ENV=production
TZ=Asia/Jakarta
LOG_LEVEL=info
RUN_ON_START=false

# Vollna RSS
UPWORK_RSS_URL=https://www.vollna.com/rss/REPLACE_ME
UPWORK_RSS_POLL_CRON=*/2 * * * *
UPWORK_RSS_REQUEST_TIMEOUT_MS=20000

# Job criteria
UPWORK_FIXED_MIN_BUDGET_USD=500
UPWORK_HOURLY_MIN_RATE_USD=15
UPWORK_REQUIRE_PAYMENT_VERIFIED=true
UPWORK_ALLOW_UNKNOWN_PAYMENT=true
UPWORK_BLOCKED_KEYWORDS=adult;casino;crypto scam;unpaid test

# AI provider (OpenAI-compatible)
LLM_PROVIDER=openai-compatible
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=replace_me
LLM_MODEL=gpt-4.1-mini
LLM_TEMPERATURE=0.4
LLM_MAX_OUTPUT_TOKENS=1800

# Notion
NOTION_API_KEY=replace_me
NOTION_UPWORK_JOBS_DATABASE_ID=replace_me

# Telegram
TELEGRAM_BOT_TOKEN=replace_me
TELEGRAM_SALES_CHAT_ID=replace_me
TELEGRAM_ALLOWED_USER_IDS=123456789,987654321
TELEGRAM_PARSE_MODE=HTML

# State / DB
SQLITE_DB_PATH=./data/upwork-sales.sqlite
PORTFOLIO_CSV_PATH=./data/portfolio.csv
UPWORK_WORK_DONE_CSV_PATH=./data/upwork-work-done.csv

# Runtime safety
DRY_RUN=false
NOTIFY_ON_REJECTED=false
MAX_JOBS_PER_POLL=25
MAX_NOTIFICATIONS_PER_POLL=10
```

### README.md
```markdown
# Illiyin Sales — Upwork AI Automation

Polls Vollna RSS, filters jobs, generates cover letters via AI, syncs to Notion, sends Telegram alerts.

## Setup

1. `npm install`
2. `cp .env.example .env` and fill all values
3. Create Notion database (see plan.md section 13)
4. Fill `data/portfolio.csv` and `data/upwork-work-done.csv`
5. `npm test` to verify
6. `npm start` or use PM2

## Telegram commands

`/bid <status> <url>` — update job status
Valid statuses: bidded, rejected, ignored, success

## Deployment

See steps/phase-9-deploy/ for VPS and PM2 setup.
```

## Commands to run
```bash
cd /Users/wazirul/Works/illiyinclaw-sales
npm install rss-parser html-to-text csv-parse dotenv node-cron node-telegram-bot-api @notionhq/client better-sqlite3
npm install -D vitest eslint
mkdir -p src data logs tests/fixtures
```

## Verification
```bash
npm test
```
Expected: vitest starts, no failures (0 tests is fine at this stage).
