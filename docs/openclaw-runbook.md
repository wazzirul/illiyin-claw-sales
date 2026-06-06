# OpenClaw Runbook

This runbook covers what can be prepared now and what to do after API keys/server are available.

## Phase 0: No Server and No API Key

Do now:

1. Review `plan.md`.
2. Copy `.env.example` to a private `.env` only when real credentials exist.
3. Create Notion databases manually from `docs/notion-schema.md`.
4. Add portfolio rows to `data/portfolio-catalog-template.csv`.
5. Collect 20-50 manual sample jobs in `data/sample-jobs-template.csv`.
6. Review prompts in `docs/agent-prompts.md`.

Do not do now:

- Do not put real secrets in this repo.
- Do not scrape Upwork production.
- Do not automate Upwork login or proposal submission.

## Phase 1: Local OpenClaw Setup After Model API Key Exists

Prerequisites:

- Node 24 recommended, or Node 22.19+.
- Model provider API key.
- Optional: Telegram bot token.
- Optional: Notion token and sandbox database IDs.

Install:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

Onboard:

```bash
openclaw onboard --install-daemon
```

Verify:

```bash
openclaw gateway status
openclaw dashboard
```

Expected:

- Gateway listens locally.
- Dashboard opens.
- One test chat works.

Local safety config baseline:

```json5
{
  gateway: {
    mode: "local",
    bind: "loopback",
    port: 18789,
    auth: {
      mode: "token",
      token: "replace-with-long-random-token"
    }
  },
  agents: {
    list: [
      {
        id: "job-radar",
        name: "Job Radar",
        workspace: "~/.openclaw/workspace-job-radar"
      },
      {
        id: "proposal-drafter",
        name: "Proposal Drafter",
        workspace: "~/.openclaw/workspace-proposal-drafter"
      },
      {
        id: "bid-logger",
        name: "Bid Logger",
        workspace: "~/.openclaw/workspace-bid-logger"
      }
    ]
  },
  channels: {
    telegram: {
      enabled: true,
      botToken: "replace-with-telegram-bot-token",
      dmPolicy: "allowlist",
      allowFrom: ["replace-with-numeric-telegram-user-id"],
      groups: {
        "*": {
          requireMention: true
        }
      }
    }
  },
  browser: {
    enabled: true,
    defaultProfile: "openclaw"
  }
}
```

Notes:

- Keep `gateway.bind` on loopback for local testing.
- Use Telegram allowlist for one-owner pilot.
- Browser exists for authorized/internal testing only, not for Upwork production automation.

## Telegram Setup

1. Open Telegram and message `@BotFather`.
2. Run `/newbot`.
3. Save the token outside the repo.
4. Start OpenClaw gateway.
5. DM the bot once.
6. Find your numeric Telegram user ID from logs or Telegram Bot API `getUpdates`.
7. Add the numeric user ID to allowlist.

Validation:

```bash
openclaw logs --follow
openclaw pairing list telegram
```

DM policy:

- Pilot default: `allowlist`.
- Alternative: `pairing` for initial setup, then move to `allowlist`.
- Avoid `open` unless the bot is intentionally public and tools are heavily restricted.

## Notion Setup

1. Create a Notion integration.
2. Store token outside repo.
3. Create `Upwork Bidding Pipeline` database from `docs/notion-schema.md`.
4. Create `Portfolio Catalog` database from `docs/notion-schema.md`.
5. Share both databases with the integration.
6. Store database IDs in private env:

```bash
NOTION_TOKEN=
NOTION_UPWORK_PIPELINE_DATABASE_ID=
NOTION_PORTFOLIO_CATALOG_DATABASE_ID=
```

Validation:

- Create one test page in sandbox.
- Update status from `New` to `Need Review`.
- Confirm duplicate key lookup before creating another page.

## Phase 2: VPS Setup

Recommended pilot server:

- Ubuntu LTS.
- 2 vCPU minimum.
- 4 GB RAM minimum.
- 40 GB disk minimum.
- 4 vCPU/8 GB RAM if running Chromium/browser tasks.

Server hardening checklist:

- Create non-root deploy user.
- Disable password SSH login.
- Use SSH key only.
- Enable firewall.
- Keep dashboard private via loopback, SSH tunnel, or Tailscale.
- Do not expose OpenClaw dashboard directly to the public internet.

Install Node and OpenClaw:

```bash
node --version
curl -fsSL https://openclaw.ai/install.sh | bash
openclaw onboard --install-daemon
openclaw gateway status
```

Operational checks:

```bash
openclaw doctor
openclaw logs --follow
openclaw gateway status
openclaw cron list
```

## Cron Jobs

Use cron only for internal checks or authorized sources.

Example daily review prompt:

```bash
openclaw cron add \
  --name "Daily sales pipeline review" \
  --cron "0 9 * * *" \
  --tz "Asia/Jakarta" \
  --session isolated \
  --message "Review pending Notion Upwork Bidding Pipeline items and summarize what needs human action."
```

Do not use cron to refresh or scrape Upwork production pages.

## Backup

Back up:

- `~/.openclaw/openclaw.json`
- `~/.openclaw/cron/`
- `~/.openclaw/workspace-*`
- relevant state files

Suggested backup cadence:

- Daily config/state backup.
- Weekly restore test on sandbox.
- Manual backup before config migration.

Restore acceptance:

- Gateway starts.
- Config validates.
- Telegram allowlist still works.
- Cron jobs are listed.
- Agent workspaces are readable.

## Incident Response

If OpenClaw fails to start:

```bash
openclaw doctor
openclaw logs --follow
```

If Telegram is open to the wrong users:

1. Stop gateway.
2. Change `dmPolicy` to `allowlist`.
3. Add only approved numeric user IDs.
4. Restart gateway.

If a secret is committed by mistake:

1. Rotate the secret immediately.
2. Remove it from the repo.
3. Audit logs for use.
4. Do not rely only on deleting the line from the latest commit.

If an agent attempts disallowed Upwork automation:

1. Stop the run.
2. Save transcript for audit.
3. Update prompt guardrail.
4. Confirm the workflow remains human-in-loop.
