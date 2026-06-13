# Step 7.3 — Telegram Commands

## Goal
Register /bid command and authorize user.

## File
- `src/telegram/commands.js`
- `tests/telegramCommands.test.js`

## Functions
```js
export function isAuthorizedTelegramUser(userId, config)
export function isValidBidStatus(status)
export function parseBidCommand(text)
export function registerSalesCommands(bot, deps)
```

## `parseBidCommand(text)`
Input: `/bid bidded https://...`
Output: `{ status: 'bidded', url: 'https://...' }` or `null` if invalid.

## `isValidBidStatus(status)`
Valid: `bidded`, `rejected`, `ignored`, `success`.

## `registerSalesCommands(bot, deps)`
`deps`: `{ config, dedupStore, notion, logger }`

Register `/bid` handler:
1. Check `from.id` in `config.telegramAllowedUserIds`. If not, reply unauthorized.
2. Parse `parseBidCommand(msg.text)`.
3. If invalid status, reply:
   `⚠️ Status tidak valid.
Gunakan: /bid <bidded|rejected|ignored|success> <url>`
4. If no URL, reply missing URL message.
5. Find record via `dedupStore.findByUrlOrJobId(url)`.
6. If not found, try `findJobPageByUrl(notion, config, url)` from Step 5.3.
7. If still not found, reply not found message.
8. Update SQLite bid_status.
9. Update Notion Status Bid via `updateJobStatus(notion, pageId, label)`.
10. Reply success:
    - success status => `🎉 Status updated → Success`
    - others => `✅ Status updated → {label}`

## Notion Status Bid mapping
| command input | Notion label |
|---------------|-------------|
| bidded        | Bidded      |
| rejected      | Rejected    |
| ignored       | Ignored     |
| success       | Success     |

## Tests
- `parseBidCommand('/bid bidded https://upwork.com/jobs/~123')` => `{ status: 'bidded', url: 'https://...' }`.
- `parseBidCommand('/bid wrongstatus https://...')` => null.
- `isValidBidStatus('bidded')` => true.
- `isValidBidStatus('wrong')` => false.
- Unauthorized user ID returns false.
