# Step 7.2 — Telegram Notifications

## Goal
Format and send the two alert messages per job.

## File
- `src/telegram/notifications.js`
- `tests/notifications.test.js`

## Functions
```js
export function buildQualifiedFoundMessage(job)
export async function notifyQualifiedFound(bot, config, job)

export function buildCoverLetterReadyMessage(job, notionPage, matches, draft)
export async function notifyCoverLetterReady(bot, config, job, notionPage, matches, draft)
```

## Alert Tahap 1 format
```
🔔 <b>Qualified Job Found</b>

<b>{jobTitle}</b>

💰 <b>Budget:</b> {budgetText}
💳 <b>Payment:</b> {paymentText}
🧩 <b>Skills:</b> {skills}
📂 <b>Category:</b> {categories}

⏳ Cover letter & portfolio sedang disiapkan AI...
🔗 <a href="{upworkOrVollnaUrl}">Open Job</a>
```

## Alert Tahap 2 format
```
✅ <b>Cover Letter Ready</b>

<b>{jobTitle}</b>

💰 <b>Budget:</b> {budgetText}
💳 <b>Payment:</b> {paymentText}
⭐ <b>Priority:</b> {priority} ({score}/100)
🧩 <b>Skills:</b> {skills}
📂 <b>Category:</b> {categories}

<b>Why match:</b>
{fitAnalysisShort}

<b>Recommended portfolio:</b>
{portfolioShortList}

<b>Red flags:</b>
{redFlagsShortList}

🔗 <a href="{url}">Open Job</a>
🗂 <a href="{notionUrl}">Open Notion</a>

Update status:
<code>/bid bidded {url}</code>
<code>/bid rejected {url}</code>
<code>/bid ignored {url}</code>
<code>/bid success {url}</code>
```

## Requirements
- Escape HTML in all dynamic fields using:
  ```js
  function escapeHtml(text) {
    return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  ```
- If `paymentVerified === 'unknown'`, append:
  `⚠️ Payment status not found in RSS. Please verify manually before bidding.`
- Keep messages under 4096 chars. Truncate fit_analysis if needed.
- `sendMessage` called with `{ parse_mode: 'HTML', disable_web_page_preview: true }`.
- Return the message object from Telegram API.

## Tests
- buildQualifiedFoundMessage: contains job title.
- buildCoverLetterReadyMessage: contains Notion URL and 4 bid commands.
- payment unknown appends warning.
- HTML special chars escaped.
