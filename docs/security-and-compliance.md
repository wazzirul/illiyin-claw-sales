# Security and Compliance Notes

## Upwork Boundary

This pilot must stay human-in-loop.

Allowed:

- Analyze manually provided job text.
- Use manually collected CSV samples.
- Use authorized APIs or feeds if approved later.
- Draft proposal text for human review.
- Log manual bid outcomes to Notion.

Not allowed:

- Automated Upwork scraping.
- Automated Upwork login.
- Automated proposal submission.
- Bypassing anti-bot, CAPTCHA, rate limits, or access controls.
- Storing Upwork credentials in OpenClaw, Notion, Telegram, or this repo.

## Secret Handling

Never commit:

- Model provider API keys.
- Telegram bot token.
- Notion token.
- Gateway token/password.
- Upwork credentials.

Use `.env.example` for placeholders only.

Recommended production handling:

- Store secrets in server environment variables or a secret manager.
- Restrict file permissions for env files.
- Rotate secrets after team/member changes.
- Audit logs after suspicious activity.

## OpenClaw Access Control

Recommended defaults:

- Gateway dashboard bound to loopback.
- Remote access via Tailscale or SSH tunnel.
- Telegram `dmPolicy: "allowlist"` for pilot.
- Group messages require mention.
- Browser automation limited to authorized/internal sources.

## Human Review Checklist

Before a bid is submitted manually:

- Confirm the job is a legitimate fit for Illiyin.
- Confirm proposal draft has no fake claims.
- Confirm selected portfolio proof exists and is relevant.
- Confirm budget/connects are acceptable.
- Confirm no off-platform contact is requested before allowed by Upwork.
- Confirm the proposal is submitted manually by an authorized person.

After manual submission:

- Mark Notion status as `Bid Sent`.
- Record connects used.
- Store final proposal text.
- Add follow-up date if needed.
