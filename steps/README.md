# Implementation Steps — Illiyin Sales Upwork Automation

Each step is a self-contained markdown file with goal, files to create, exact function signatures, rules, and test cases.

Feed these to AI one step at a time. Complete each step, verify (npm test / manual check), then proceed.

---

## Build Order

### Phase 0 — Setup
- step-0.1-init-project.md
- step-0.2-config-loader.md
- step-0.3-logger.md

### Phase 1 — RSS Parser
- step-1.1-rss-fetcher.md
- step-1.2-fixture-sample-xml.md
- step-1.3-parse-vollna-item.md
- step-1.4-url-utils.md
- step-1.5-money-utils.md

### Phase 2 — Filter and Score
- step-2.1-job-criteria-filter.md
- step-2.2-score-job.md

### Phase 3 — Portfolio CSV
- step-3.1-csv-templates.md
- step-3.2-csv-loader.md
- step-3.3-portfolio-matcher.md

### Phase 4 — AI Draft
- step-4.1-llm-client.md
- step-4.2-cover-letter-prompt.md
- step-4.3-generate-bid-draft.md

### Phase 5 — Notion
- step-5.1-notion-client.md
- step-5.2-map-job-to-notion-properties.md
- step-5.3-notion-job-page-crud.md
- step-5.4-notion-page-blocks.md

### Phase 6 — SQLite State
- step-6.1-sqlite-connection.md
- step-6.2-dedup-store.md

### Phase 7 — Telegram
- step-7.1-telegram-client.md
- step-7.2-telegram-notifications.md
- step-7.3-telegram-commands.md

### Phase 8 — Scheduler
- step-8.1-worker.md
- step-8.2-cron-scheduler.md
- step-8.3-app-entrypoint.md

### Phase 9 — Deploy
- step-9.1-vps-setup.md
- step-9.2-deploy-app.md
- step-9.3-pm2-config.md

---

## Dependency rules
- Phase 0 has no deps.
- Phase 1 requires Phase 0.
- Phase 2 requires Phase 1.
- Phase 3 has no deps on Phase 2 (can run in parallel).
- Phase 4 requires Phase 3.
- Phase 5 has no deps on Phase 4 (can be stubbed first).
- Phase 6 has no deps.
- Phase 7 requires Phase 5 and 6.
- Phase 8 requires Phases 1–7.
- Phase 9 requires Phase 8.

## Prompt to use for each step
"Read steps/{phase-folder}/{step-file}.md and implement exactly what is described. Follow the function signatures and test cases. Do not add features not listed."
