# Step 6.2 — Dedup Store

## Goal
CRUD interface for dedup state and bid status tracking.

## File
- `src/state/dedupStore.js`
- `tests/dedupStore.test.js`

## Function
```js
export function createDedupStore(db)
```

Returns object with:
- `findByDedupKey(key)` — returns row or null.
- `findByUrlOrJobId(urlOrId)` — searches upwork_url, vollna_url, external_job_id.
- `insertRejected(job, filterResult)` — insert with filter_status != qualified.
- `insertQualified(job, notionPageId, matches, draft)` — insert qualified.
- `touch(id, job)` — update last_seen_at.
- `wasNotified(dedupKey)` — returns bool.
- `markNotified(dedupKey, messageId)` — insert into notified_keys.
- `updateBidStatus(dedupKeyOrId, status)` — update bid_status + notion status.

## buildDedupKey (also export)
```js
export function buildDedupKey(job)
```
Priority:
1. `upwork:${job.externalJobId}` if exists.
2. `upwork-url:${normalizeUrl(job.upworkUrl)}` if exists.
3. `vollna-url:${normalizeUrl(job.vollnaUrl)}` if exists.
4. `hash:${sha256(title+pubDate+desc.slice(0,300))}`.

Use Node `crypto.createHash('sha256')`.

## Tests
Use in-memory SQLite: `openDatabase(':memory:')`.
- Insert and find by dedup key.
- Touch updates last_seen_at.
- wasNotified false before markNotified.
- wasNotified true after markNotified.
- findByUrlOrJobId matches by Upwork URL.
