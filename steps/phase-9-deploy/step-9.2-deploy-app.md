# Step 9.2 — Deploy App

## Goal
Clone repo, install deps, configure env, run tests.

## Commands
```bash
git clone <repo-url> illiyinclaw-sales
cd illiyinclaw-sales
npm ci
cp .env.example .env
nano .env
mkdir -p data logs
npm test
```

## Required .env values
- `UPWORK_RSS_URL`
- `LLM_BASE_URL`
- `LLM_API_KEY`
- `LLM_MODEL`
- `NOTION_API_KEY`
- `NOTION_UPWORK_JOBS_DATABASE_ID`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_SALES_CHAT_ID`
- `TELEGRAM_ALLOWED_USER_IDS`

## Manual data setup
Fill:
- `data/portfolio.csv`
- `data/upwork-work-done.csv`

## Dry-run verification
```bash
DRY_RUN=true RUN_ON_START=true npm start
```
Expected:
- Worker fetches RSS.
- Logs parsed/filtered jobs.
- No real Telegram/Notion writes.
