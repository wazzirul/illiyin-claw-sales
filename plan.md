# Illiyin Sales Upwork AI Automation — Super Detailed Implementation Plan

> Dokumen ini adalah rencana implementasi detail untuk automation workflow Upwork bidding divisi Sales Illiyin.
> Fokus utama: ambil job dari RSS Vollna, filter sesuai kriteria, generate cover letter + portfolio match, simpan ke Notion, kirim alert Telegram, lalu update status bidding via command Telegram.

---

## 1. Ringkasan Goal

Membangun sistem AI automation yang berjalan 24/7 di VPS untuk membantu divisi Sales menemukan job Upwork baru dari RSS Vollna, memfilter job yang sesuai kriteria Illiyin, membuat draft cover letter dan rekomendasi portfolio, menyimpan semua data ke Notion, serta mengirim notifikasi ke Telegram agar PM/Sales bisa segera follow up.

Workflow utama:

1. Worker berjalan berkala di VPS.
2. Worker membaca RSS Vollna:
   - `https://www.vollna.com/rss/[REDACTED]`
3. Worker parse setiap item job.
4. Worker filter job berdasarkan kriteria minimum:
   - Fixed price: minimal USD 500
   - Hourly: minimal USD 15/hour
   - Payment method: verified
5. Begitu job dinyatakan qualified, worker langsung kirim ALERT TELEGRAM TAHAP 1 (job cocok ditemukan), sebelum AI selesai.
6. Job yang lolos filter diproses AI untuk:
   - Ringkasan job
   - Analisis kecocokan
   - Draft cover letter
   - Rekomendasi portfolio dari CSV internal
   - Rekomendasi prioritas bidding
7. Worker membuat/mengupdate record di Notion database.
8. Setelah cover letter + Notion siap, worker kirim ALERT TELEGRAM TAHAP 2 (cover letter & portfolio sudah siap, link Notion aktif).
9. PM/Sales bisa update status via 1 command Telegram:
   - `/bid <status> <url_link>` dengan status: `bidded`, `rejected`, `ignored`, `success`
   - contoh: `/bid bidded https://...`, `/bid success https://...`
10. Sistem melakukan dedup agar job yang sama tidak masuk/notifikasi berulang.

Catatan penting alert 2 tahap:
- Tahap 1 (qualified found): cepat, memberi tahu Sales ada job cocok sedang diproses AI.
- Tahap 2 (draft ready): menyusul setelah cover letter + Notion page jadi, berisi ringkasan + link Notion + command bid.
- Kedua alert punya dedup key berbeda agar tidak saling menimpa, dan masing-masing hanya dikirim sekali per job.

---

## 2. Kesimpulan Teknis Penting

### 2.1 OpenClaw tidak menjadi komponen utama

Dari requirement dan hasil pengecekan awal, sumber job sudah tersedia dalam RSS Vollna. Karena itu, kita tidak perlu browser automation sebagai jalur utama.

Gunakan pendekatan ini:

- Jalur utama: RSS Vollna feed.
- Jalur optional/fallback: browser automation hanya untuk validasi manual atau enrichment tertentu jika benar-benar dibutuhkan.
- Hindari scraping langsung Upwork HTML/page karena ada risiko ToS/legal dan lebih rapuh.

Referensi yang tetap perlu disimpan:

- OpenClaw docs: untuk kemungkinan browser automation fallback.
- Upwork Legal Center / Terms / extension guidelines / prohibited data mining: untuk memastikan automation tidak melanggar aturan.

### 2.2 Polling RSS yang direkomendasikan

Feed RSS Vollna yang dicek memiliki `expireDate` sekitar 10 menit setelah `lastBuildDate`. Artinya feed tampaknya di-refresh sekitar interval 10 menit.

Rekomendasi polling:

- Production default: setiap 2 menit (mengejar job baru lebih cepat untuk kompetisi bidding).
- Minimum aman: setiap 1 menit. Boleh dipakai jika butuh reaksi paling cepat dan Vollna tidak memberi rate limit.
- Jangan terlalu cepat seperti setiap 5-30 detik karena tidak ada benefit besar (feed Vollna refresh ~10 menit), lebih boros, dan bisa dianggap aggressive polling.
- Untuk testing/dev: setiap 1 menit.
- Jika Vollna memberi rate limit / 429 atau feed update lebih lambat, naikkan ke 5 menit lalu 10 menit.

Trade-off 1 vs 2 menit:
- 1 menit: reaksi tercepat, tapi ~2x request ke Vollna, lebih rawan rate limit.
- 2 menit: tetap jauh lebih cepat dari refresh feed (10 menit), hemat request, paling aman untuk 24/7. Ini default yang direkomendasikan.

Env default:

```env
UPWORK_RSS_POLL_CRON=*/2 * * * *
UPWORK_RSS_POLL_INTERVAL_SECONDS=120
```

Jika memakai `node-cron`, pakai cron `*/2 * * * *` (atau `*/1 * * * *` untuk 1 menit) dengan timezone `Asia/Jakarta`.

---

## 3. Prinsip Legal, Compliance, dan Safety

Karena workflow terkait Upwork, sistem harus dirancang konservatif.

### 3.1 Yang boleh dilakukan

- Membaca RSS Vollna yang memang disediakan sebagai feed.
- Menyimpan metadata job yang muncul di RSS.
- Membuat draft cover letter sebagai bantuan internal.
- Mengirim alert ke Sales/PM.
- Memberi rekomendasi portfolio internal.
- PM/Sales tetap review dan submit bid secara manual di Upwork.

### 3.2 Yang sebaiknya tidak dilakukan di MVP

- Auto-submit proposal ke Upwork tanpa manusia.
- Scraping langsung halaman Upwork secara agresif.
- Bypass login/session/CAPTCHA.
- Mengambil data yang tidak tersedia di RSS/public feed.
- Menggunakan browser automation untuk tindakan yang berpotensi melanggar Terms.

### 3.3 Human-in-the-loop wajib

Sistem ini hanya menghasilkan draft dan alert. Keputusan final tetap PM/Sales.

Status flow:

```text
new_from_rss -> qualified -> drafted -> notified -> bidded -> success
                                  \-> rejected / ignored / duplicate / error
```

---

## 4. Architecture Overview

### 4.1 Komponen sistem

```text
+---------------------+
| VPS / Worker Server |
+----------+----------+
           |
           | every 2 minutes (default; 1 min optional)
           v
+---------------------+       +-------------------+
| RSS Poller          | ----> | Vollna RSS Feed   |
+----------+----------+       +-------------------+
           |
           v
+---------------------+
| RSS Parser          |
+----------+----------+
           |
           v
+---------------------+
| Job Normalizer      |
+----------+----------+
           |
           v
+---------------------+       +-------------------+
| Job Filter          | ----> | Criteria Config   |
+----------+----------+       +-------------------+
           |
           v
+---------------------+       +----------------------------+
| Dedup Store         | <---- | SQLite / JSON state / DB   |
+----------+----------+       +----------------------------+
           |
           v
+---------------------+       +-----------------------+
| Portfolio Matcher   | <---- | portfolio.csv         |
|                     | <---- | upwork-work-done.csv  |
+----------+----------+       +-----------------------+
           |
           v
+---------------------+       +-------------------+
| AI Draft Generator  | ----> | LLM Provider      |
+----------+----------+       +-------------------+
           |
           v
+---------------------+       +-------------------+
| Notion Sync         | ----> | Notion Database   |
+----------+----------+       +-------------------+
           |
           v
+---------------------+       +-------------------+
| Telegram Notifier   | ----> | Sales Telegram    |
+---------------------+       +-------------------+
```

Telegram command path:

```text
PM/Sales Telegram
      |
      | /bid <status> <url>   (status: bidded|rejected|ignored|success)
      v
Telegram Bot Command Handler
      |
      v
Find Notion record by URL / normalized job id
      |
      v
Update Status Bid = mapped status
      |
      v
Reply confirmation to Telegram
```

---

## 5. Recommended Tech Stack

Karena existing ecosystem Illiyin sudah punya `illiyin-tele-bot` dengan Node.js ESM, `node-telegram-bot-api`, `node-cron`, dan Notion API, stack paling masuk akal:

- Runtime: Node.js 20+ atau 22+
- Language: JavaScript ESM atau TypeScript
- Scheduler: `node-cron`
- RSS parser: `rss-parser`
- HTML cleanup: `html-to-text` atau utility sendiri
- CSV parser: `csv-parse`
- Notion API: `@notionhq/client`
- Telegram: `node-telegram-bot-api`
- LLM provider: OpenAI-compatible API / Claude / Gemini sesuai config
- Dedup/local state: SQLite via `better-sqlite3` atau JSON state untuk MVP
- Deployment: PM2 atau systemd di VPS
- Logging: console + file log; optional pino

### 5.1 Rekomendasi MVP storage

Untuk MVP:

- Gunakan Notion sebagai source of truth untuk job records.
- Gunakan local JSON state atau SQLite untuk dedup cepat.

Pilihan praktis:

1. MVP sederhana: `.upwork-rss-state.json`
2. Lebih robust: `data/upwork-sales.sqlite`

Rekomendasi: gunakan SQLite kalau langsung production 24/7, karena lebih aman untuk banyak status dan audit.

---

## 6. Repository Structure yang Direkomendasikan

Root repo:

```text
/Users/wazirul/Works/illiyinclaw-sales
├── plan.md
├── preplan.md
├── upwork-source.md
├── package.json
├── .env.example
├── README.md
├── data/
│   ├── portfolio.csv
│   ├── upwork-work-done.csv
│   └── upwork-sales.sqlite          # generated, gitignored
├── src/
│   ├── index.js
│   ├── config.js
│   ├── logger.js
│   ├── rss/
│   │   ├── fetchVollnaFeed.js
│   │   ├── parseVollnaItem.js
│   │   └── normalizeJob.js
│   ├── filters/
│   │   ├── jobCriteria.js
│   │   └── scoreJob.js
│   ├── portfolio/
│   │   ├── loadPortfolioCsv.js
│   │   ├── matchPortfolio.js
│   │   └── portfolioTypes.js
│   ├── ai/
│   │   ├── llmClient.js
│   │   ├── buildCoverLetterPrompt.js
│   │   └── generateBidDraft.js
│   ├── notion/
│   │   ├── notionClient.js
│   │   ├── upworkJobsDatabase.js
│   │   └── mapJobToNotionProperties.js
│   ├── telegram/
│   │   ├── telegramClient.js
│   │   ├── notifications.js
│   │   └── commands.js
│   ├── scheduler/
│   │   ├── index.js
│   │   └── upworkRssWorker.js
│   ├── state/
│   │   ├── dedupStore.js
│   │   └── sqlite.js
│   └── utils/
│       ├── dates.js
│       ├── money.js
│       ├── strings.js
│       └── urls.js
└── tests/
    ├── fixtures/
    │   ├── vollna-sample.xml
    │   ├── portfolio.sample.csv
    │   └── upwork-work-done.sample.csv
    ├── parseVollnaItem.test.js
    ├── jobCriteria.test.js
    ├── matchPortfolio.test.js
    ├── mapJobToNotionProperties.test.js
    └── telegramCommands.test.js
```

Alternative jika ingin gabung ke `illiyin-tele-bot`:

```text
/Users/wazirul/Works/illiyin-tele-bot/src/sales-upwork/...
```

Namun untuk MVP lebih bersih dibuat sebagai repo/service terpisah supaya tidak mengganggu bot internal lain.

---

## 7. Environment Variables

File: `.env.example`

```env
# App
NODE_ENV=production
TZ=Asia/Jakarta
LOG_LEVEL=info

# Vollna RSS
UPWORK_RSS_URL=https://www.vollna.com/rss/[REDACTED]
UPWORK_RSS_POLL_CRON=*/2 * * * *
UPWORK_RSS_REQUEST_TIMEOUT_MS=20000

# Job criteria
UPWORK_FIXED_MIN_BUDGET_USD=500
UPWORK_HOURLY_MIN_RATE_USD=15
UPWORK_REQUIRE_PAYMENT_VERIFIED=true
UPWORK_ALLOWED_CATEGORIES=Web, Mobile & Software Dev; Design & Creative; Sales & Marketing
UPWORK_BLOCKED_KEYWORDS=adult;casino;crypto scam;unpaid test

# AI provider, OpenAI-compatible example
LLM_PROVIDER=openai-compatible
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=replace_me
LLM_MODEL=gpt-4.1-mini
LLM_TEMPERATURE=0.4
LLM_MAX_OUTPUT_TOKENS=1800

# Notion
NOTION_API_KEY=replace_me
NOTION_UPWORK_JOBS_DATABASE_ID=replace_me
NOTION_VERSION=2025-09-03

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

Catatan:

- `TELEGRAM_ALLOWED_USER_IDS` wajib agar tidak semua orang bisa update status Notion.
- `DRY_RUN=true` untuk testing tanpa kirim Telegram / write Notion.
- `MAX_NOTIFICATIONS_PER_POLL` mencegah spam ketika feed berisi banyak job sekaligus.

---

## 8. RSS Vollna Data Contract

Dari pengecekan awal, RSS berformat valid XML dengan struktur umum:

```xml
<rss version="2.0">
  <channel>
    <title>SaaS UI/UX Design Jobs</title>
    <link>https://www.vollna.com/rss/...</link>
    <lastBuildDate>Sat, 13 Jun 2026 00:48:40 +0000</lastBuildDate>
    <pubDate>Sat, 13 Jun 2026 00:48:40 +0000</pubDate>
    <expireDate>Sat, 13 Jun 2026 00:58:39 +0000</expireDate>
    <item>
      <title>AI Automation Specialist (Claude Code) — Full-Time (Fixed Price: 1,500 USD)</title>
      <description><![CDATA[... job description ... Skills: ... Categories: ...]]></description>
      <pubDate>Sat, 13 Jun 2026 00:06:27 +0000</pubDate>
      <link>https://www.vollna.com/go?...url=https%253A%2F%2Fwww.upwork.com%2Fjobs%2F~022065...</link>
      <categories>
        <category>Web, Mobile & Software Dev</category>
        <category>Scripts & Utilities</category>
      </categories>
    </item>
  </channel>
</rss>
```

### 8.1 Fields yang perlu diambil

Dari setiap item RSS:

| Field normalized  | Source                            | Notes                                        |
| ----------------- | --------------------------------- | -------------------------------------------- |
| `source`          | constant                          | `vollna_rss`                                 |
| `rssTitle`        | `item.title`                      | title mentah dari RSS                        |
| `jobTitle`        | parsed from title                 | title tanpa budget suffix jika bisa          |
| `jobType`         | parsed from title                 | `fixed`, `hourly`, atau `unknown`            |
| `fixedBudgetUsd`  | parsed from title/description     | contoh `Fixed Price: 1,500 USD`              |
| `hourlyMinUsd`    | parsed from title/description     | contoh `Hourly: $15-$30/hr`                  |
| `hourlyMaxUsd`    | parsed from title/description     | optional                                     |
| `descriptionText` | `description` cleaned             | HTML/CDDATA jadi plain text                  |
| `skills`          | parsed from description           | setelah label `Skills:`                      |
| `categories`      | `category[]` + parsed desc        | list string                                  |
| `pubDate`         | `item.pubDate`                    | tanggal job publish                          |
| `vollnaUrl`       | `item.link`                       | redirect Vollna                              |
| `upworkUrl`       | decoded dari query `url` jika ada | canonical job URL                            |
| `externalJobId`   | parsed dari Upwork URL            | contoh `~022065586128771017469`              |
| `paymentVerified` | parsed jika muncul                | jika RSS tidak menyertakan, status `unknown` |
| `rawXmlHash`      | SHA256 of item                    | untuk debug/dedup                            |
| `contentHash`     | SHA256 normalized fields          | untuk perubahan content                      |

### 8.2 Parsing Upwork URL dari Vollna redirect

Contoh link RSS:

```text
https://www.vollna.com/go?uid=...&url=https%253A%2F%2Fwww.upwork.com%2Fjobs%2F~022065586128771017469
```

`url` double-encoded. Parsing:

1. Ambil query param `url`.
2. Decode sekali.
3. Jika masih mengandung `%2F`, decode lagi.
4. Validasi host `www.upwork.com`.
5. Extract job id dari path `/jobs/~...`.

Pseudo:

```js
export function extractUpworkUrl(vollnaUrl) {
  const parsed = new URL(vollnaUrl);
  const raw = parsed.searchParams.get("url");
  if (!raw) return null;

  let decoded = raw;
  for (let i = 0; i < 3; i += 1) {
    const next = decodeURIComponent(decoded);
    if (next === decoded) break;
    decoded = next;
  }

  try {
    const url = new URL(decoded);
    if (!url.hostname.includes("upwork.com")) return null;
    return url.toString();
  } catch {
    return null;
  }
}
```

---

## 9. Filtering Rules

### 9.1 Minimal rules dari requirement

Job lolos jika:

- Untuk fixed price:
  - `jobType = fixed`
  - `fixedBudgetUsd >= 500`
- Untuk hourly:
  - `jobType = hourly`
  - `hourlyMinUsd >= 15`
- Payment method:
  - `paymentVerified = true`

### 9.2 Masalah payment method di RSS

Belum pasti RSS Vollna selalu menyertakan `Payment Method: Verified`. Jika tidak ada field payment method di RSS, ada 3 opsi:

Opsi A — strict:

- Jika payment method tidak ditemukan, reject.
- Aman tapi bisa kehilangan banyak job bagus.

Opsi B — balanced, direkomendasikan MVP:

- Jika payment method ditemukan dan `unverified`, reject.
- Jika payment method ditemukan dan `verified`, accept.
- Jika payment method tidak ditemukan, mark `paymentVerified = unknown`, tetap masuk Notion dengan status `needs_manual_payment_check`, dan Telegram message memberi warning.

Opsi C — browser enrichment:

- Pakai browser automation/API tambahan untuk buka detail dan cek payment method.
- Tidak direkomendasikan untuk MVP karena risiko ToS dan reliability.

Rekomendasi: Opsi B.

### 9.3 Status filter detail

```text
qualified
- Budget/rate lolos
- Payment verified true atau unknown accepted by config
- Tidak duplicate
- Tidak mengandung blocked keyword

rejected_budget
- Budget fixed < 500 atau hourly min < 15

rejected_payment
- Payment explicitly unverified

rejected_keyword
- Mengandung blocked keyword

duplicate
- Job id/link sudah pernah masuk

parse_error
- Field penting tidak bisa diparse
```

### 9.4 Scoring tambahan

Selain pass/fail, beri score 0-100 untuk prioritas bidding:

| Faktor                          | Bobot |
| ------------------------------- | ----: |
| Budget/rate tinggi              |    20 |
| Skill match dengan portfolio    |    25 |
| Category sesuai layanan Illiyin |    15 |
| Job description jelas           |    15 |
| Client terlihat serius          |    10 |
| Urgency / full-time / long-term |    10 |
| Red flags rendah                |     5 |

Priority label:

```text
80-100: high
60-79: medium
40-59: low
<40: reject/manual review
```

---

## 10. Deduplication Strategy

Dedup wajib supaya Telegram tidak spam dan Notion tidak penuh duplicate.

### 10.1 Primary dedup key

Gunakan urutan:

1. `externalJobId` dari Upwork URL, jika ada.
2. canonical `upworkUrl`, jika ada.
3. canonical `vollnaUrl`, jika tidak ada Upwork URL.
4. hash dari `title + pubDate + first 300 chars description` sebagai fallback.

```js
function buildDedupKey(job) {
  if (job.externalJobId) return `upwork:${job.externalJobId}`;
  if (job.upworkUrl) return `upwork-url:${normalizeUrl(job.upworkUrl)}`;
  if (job.vollnaUrl) return `vollna-url:${normalizeUrl(job.vollnaUrl)}`;
  return `hash:${sha256(`${job.rssTitle}|${job.pubDate}|${job.descriptionText.slice(0, 300)}`)}`;
}
```

### 10.2 Dedup status

SQLite table:

```sql
CREATE TABLE IF NOT EXISTS upwork_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dedup_key TEXT NOT NULL UNIQUE,
  external_job_id TEXT,
  upwork_url TEXT,
  vollna_url TEXT,
  title TEXT NOT NULL,
  job_type TEXT,
  fixed_budget_usd INTEGER,
  hourly_min_usd REAL,
  hourly_max_usd REAL,
  payment_verified TEXT,
  filter_status TEXT NOT NULL,
  score INTEGER,
  priority TEXT,
  notion_page_id TEXT,
  telegram_message_id TEXT,
  bid_status TEXT DEFAULT 'new',
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  raw_json TEXT NOT NULL
);
```

`payment_verified` values:

```text
verified
unverified
unknown
```

`bid_status` values:

```text
new
drafted
notified
bidded
success
failed
ignored
```

---

## 11. Portfolio Data Files

Dua CSV yang diminta:

1. `portfolio.csv`
2. `upwork-work-done.csv`

### 11.1 `portfolio.csv`

Tujuan: daftar portfolio umum Illiyin, baik yang dari website/Dribbble/Behance/case study internal.

File: `data/portfolio.csv`

Header rekomendasi:

```csv
id,title,service_category,industry,skills,tools,summary,case_study_url,image_url,client_name,year,team_role,proof_strength,notes
```

Contoh isi:

```csv
id,title,service_category,industry,skills,tools,summary,case_study_url,image_url,client_name,year,team_role,proof_strength,notes
PF-001,"SaaS CRM Dashboard UI/UX","UI/UX Design","SaaS","dashboard;crm;saas;figma;design system","Figma;FigJam","Designed CRM dashboard with role-based analytics, pipeline tracking, and responsive layouts.","https://example.com/case-study/crm-dashboard","https://example.com/images/crm-dashboard.png","Confidential SaaS Client",2025,"UI/UX design;design system","high","Good for SaaS dashboard, admin panel, CRM, analytics jobs"
PF-002,"E-commerce Mobile App Redesign","Mobile App Design","E-commerce","mobile app;checkout;ux audit;figma;prototype","Figma;Maze","Redesigned mobile shopping flow to improve product discovery and checkout usability.","https://example.com/case-study/ecommerce-mobile","https://example.com/images/ecommerce-mobile.png","Retail Client",2024,"UX audit;UI redesign;prototype","medium","Good for e-commerce, mobile app, checkout optimization"
PF-003,"AI Automation Internal Dashboard","AI Automation","Agency Operations","automation;api;dashboard;node.js;notion;telegram","Node.js;Notion API;Telegram Bot;PostgreSQL","Built automation dashboard connecting APIs, alerts, and workflow status for an agency team.","https://example.com/case-study/ai-automation-dashboard","","Internal",2026,"automation;backend;dashboard","high","Good for automation, API integration, dashboard, agent workflow jobs"
```

Kolom penting:

- `skills`: dipisah dengan semicolon `;` agar mudah matching.
- `proof_strength`: `high`, `medium`, `low` untuk prioritas rekomendasi.
- `notes`: informasi internal untuk AI agar tahu kapan portfolio ini cocok.

### 11.2 `upwork-work-done.csv`

Tujuan: daftar project/work yang pernah selesai di Upwork. Ini lebih kuat untuk cover letter karena proof berasal dari Upwork.

File: `data/upwork-work-done.csv`

Header rekomendasi:

```csv
id,upwork_contract_title,client_industry,service_category,skills,job_summary,result_summary,budget_or_earning,client_feedback,upwork_profile_url,portfolio_url,completed_date,permission_to_mention,notes
```

Contoh isi:

```csv
id,upwork_contract_title,client_industry,service_category,skills,job_summary,result_summary,budget_or_earning,client_feedback,upwork_profile_url,portfolio_url,completed_date,permission_to_mention,notes
UW-001,"Figma SaaS Dashboard UI/UX Design","SaaS","UI/UX Design","figma;dashboard;saas;ux research;design system","Client needed a clean dashboard for subscription analytics.","Delivered responsive dashboard, reusable components, and clickable prototype.","$2,400","Great communication and high-quality design.","https://www.upwork.com/freelancers/example","https://example.com/case-study/saas-dashboard","2025-11-10","yes","Mention only if client/project is allowed to be public"
UW-002,"Automation Script for Agency Workflow","Agency Operations","AI Automation","node.js;api;automation;notion;telegram","Client needed automation between lead source, Notion, and team notifications.","Built scheduled worker, dedup, Notion sync, and Telegram alerts.","$1,200","Saved us hours every week.","https://www.upwork.com/freelancers/example","","2026-02-14","yes","Strong match for automation/API/agent jobs"
UW-003,"Landing Page and Web App UX Improvements","Marketing","Web Design","landing page;conversion;ux audit;figma;webflow","Client wanted clearer funnel and better above-the-fold messaging.","Improved structure, hero messaging, and conversion-focused layout.","$850","Professional and fast turnaround.","https://www.upwork.com/freelancers/example","https://example.com/case-study/landing-ux","2025-08-22","no","Can use as internal matching but do not mention client name/details"
```

### 11.3 Matching logic

Untuk setiap job:

1. Extract keywords dari:
   - title
   - description
   - skills
   - categories
2. Compare ke CSV:
   - `service_category`
   - `industry`
   - `skills`
   - `summary`
   - `notes`
3. Score setiap portfolio/work:
   - exact skill match +3
   - category match +2
   - industry match +2
   - title keyword match +1
   - proof_strength high +2
   - upwork work done +3 bonus
4. Ambil top 3 portfolio dan top 2 Upwork work done.

Output yang disimpan:

```json
{
  "recommendedPortfolio": [
    {
      "id": "PF-003",
      "title": "AI Automation Internal Dashboard",
      "score": 14,
      "reason": "Matches automation, API, dashboard, Notion, Telegram"
    }
  ],
  "recommendedUpworkWork": [
    {
      "id": "UW-002",
      "title": "Automation Script for Agency Workflow",
      "score": 17,
      "reason": "Strong Upwork proof for API automation and team workflow"
    }
  ]
}
```

---

## 12. AI Cover Letter Generator

### 12.1 Output AI yang dibutuhkan

Untuk setiap qualified job, AI menghasilkan:

1. `job_summary`: ringkasan 3-5 bullet.
2. `client_need`: apa kebutuhan utama client.
3. `fit_analysis`: kenapa Illiyin cocok.
4. `red_flags`: hal yang perlu dicek PM/Sales.
5. `questions_to_ask`: 2-4 pertanyaan relevan.
6. `recommended_portfolio`: portfolio/work yang cocok.
7. `cover_letter`: draft proposal siap review.
8. `bid_strategy`: pendekatan bid, timeline, budget note.
9. `priority`: high/medium/low.

### 12.2 Prompt prinsip

AI harus:

- Tidak mengarang pengalaman/project yang tidak ada di CSV.
- Tidak menyebut client/project confidential jika `permission_to_mention = no`.
- Tidak overpromise.
- Membuat cover letter singkat, personal, dan spesifik ke job.
- Fokus ke hasil dan relevansi, bukan template generik.
- Gunakan bahasa Inggris untuk cover letter Upwork.
- Gunakan bahasa Indonesia ringkas untuk internal notes jika di Notion/Telegram.

### 12.3 Prompt template

File: `src/ai/buildCoverLetterPrompt.js`

Template:

```text
You are assisting Illiyin Studio sales team to draft an Upwork proposal.

Rules:
- Do not invent portfolio, metrics, client names, or project results.
- Only mention portfolio/work items included in the provided context.
- If a work item has permission_to_mention=no, do not mention client/project identity; only use it as internal reasoning.
- Keep the cover letter concise, specific, and human.
- Avoid generic phrases like "I hope this message finds you well".
- Do not claim we already fully understand hidden requirements.
- Include 2-3 relevant questions when useful.
- Output valid JSON only.

Illiyin positioning:
- Illiyin is a digital product/design/development team.
- We work on UI/UX, web/mobile apps, dashboards, automation, API integrations, and product workflows.
- Tone: confident, helpful, practical, not pushy.

Job:
{job_json}

Matched portfolio:
{portfolio_json}

Matched Upwork completed work:
{upwork_work_json}

Return JSON with this schema:
{
  "job_summary": ["..."],
  "client_need": "...",
  "fit_analysis": "...",
  "red_flags": ["..."],
  "questions_to_ask": ["..."],
  "recommended_portfolio_ids": ["PF-001"],
  "recommended_upwork_work_ids": ["UW-001"],
  "cover_letter": "...",
  "bid_strategy": "...",
  "priority": "high|medium|low",
  "confidence": 0.0
}
```

### 12.4 Cover letter style

Contoh style yang diinginkan:

```text
Hi, I saw that you need someone who can turn manual agency/client workflows into reliable automations using Claude Code, APIs, databases, and dashboards.

This is very close to work we have handled before: building scheduled workers, API integrations, Notion/Telegram workflow alerts, and dashboards that help non-technical teams act on operational data.

For your case, I would start by mapping the manual workflow, identifying the systems involved, then shipping a small reliable automation first before expanding it. The important parts would be error handling, auth/rate-limit handling, and clear documentation so your team can trust it in production.

A few quick questions:
1. Which tools are currently involved in the manual workflow?
2. Do you already have API access for those systems?
3. Should the first version run on a schedule, webhook, or manual trigger?

If helpful, I can share relevant examples of API automation and dashboard workflows we have built.
```

---

## 13. Notion Database Design

### 13.1 Database name

Rekomendasi:

```text
Illiyin Sales - Upwork Job Pipeline
```

### 13.2 Properties

| Property                  | Type         | Description                                                                            |
| ------------------------- | ------------ | -------------------------------------------------------------------------------------- |
| `Name`                    | Title        | Job title                                                                              |
| `Status Bid`              | Select       | New, Drafted, Notified, Bidded, Rejected, Ignored, Success, Failed                      |
| `Filter Status`           | Select       | Qualified, Rejected Budget, Rejected Payment, Rejected Keyword, Duplicate, Parse Error |
| `Priority`                | Select       | High, Medium, Low                                                                      |
| `Score`                   | Number       | 0-100                                                                                  |
| `Job Type`                | Select       | Fixed, Hourly, Unknown                                                                 |
| `Fixed Budget USD`        | Number       | Fixed budget                                                                           |
| `Hourly Min USD`          | Number       | Minimum hourly rate                                                                    |
| `Hourly Max USD`          | Number       | Maximum hourly rate                                                                    |
| `Payment Verified`        | Select       | Verified, Unverified, Unknown                                                          |
| `Upwork URL`              | URL          | Canonical Upwork job URL                                                               |
| `Vollna URL`              | URL          | Original Vollna redirect URL                                                           |
| `External Job ID`         | Rich text    | Upwork job id                                                                          |
| `Published At`            | Date         | RSS pubDate                                                                            |
| `First Seen At`           | Date         | first time worker saw job                                                              |
| `Last Seen At`            | Date         | latest seen time                                                                       |
| `Categories`              | Multi-select | Job categories                                                                         |
| `Skills`                  | Multi-select | Parsed skills                                                                          |
| `Recommended Portfolio`   | Rich text    | IDs/titles top portfolio                                                               |
| `Recommended Upwork Work` | Rich text    | IDs/titles top Upwork work                                                             |
| `Cover Letter`            | Rich text    | AI generated draft, may need chunking if long                                          |
| `Job Summary`             | Rich text    | AI summary                                                                             |
| `Fit Analysis`            | Rich text    | AI fit reason                                                                          |
| `Red Flags`               | Rich text    | AI/manual warnings                                                                     |
| `Questions`               | Rich text    | Questions to ask client                                                                |
| `Bid Strategy`            | Rich text    | Internal strategy                                                                      |
| `Raw Description`         | Rich text    | Cleaned RSS description                                                                |
| `Dedup Key`               | Rich text    | Internal dedup key                                                                     |
| `Telegram Message ID`     | Rich text    | message id if notified                                                                 |
| `Last Error`              | Rich text    | error if sync/generation failed                                                        |

### 13.3 Notion page body

Selain properties, page content bisa berisi markdown detail:

```markdown
## Job Summary

- ...

## Cover Letter Draft

...

## Recommended Portfolio

1. PF-003 — AI Automation Internal Dashboard
   Reason: Matches automation/API/dashboard.

## Recommended Upwork Work

1. UW-002 — Automation Script for Agency Workflow
   Reason: Strong Upwork proof.

## Original Job Description

...

## Internal Notes

- Payment status unknown, PM/Sales must verify before bidding.
```

### 13.4 Create vs update behavior

Jika job baru:

1. Setelah filter qualified, kirim Telegram Alert Tahap 1: `Qualified job found`.
2. Generate portfolio match + cover letter AI.
3. Create Notion page.
4. Store `notion_page_id` in SQLite.
5. Kirim Telegram Alert Tahap 2: `Cover letter ready`.
6. Update Notion `Status Bid = Draft Ready` atau `Notified` sesuai opsi select yang dipakai.

Jika job sudah ada:

1. Update `Last Seen At`.
2. Jika content berubah, optionally update description/hash.
3. Jangan kirim Telegram lagi kecuali `ALLOW_RENOTIFY_ON_UPDATE=true`.

---

## 14. Telegram Notification Design

Sistem mengirim DUA alert per job qualified:
- Alert Tahap 1: dikirim segera setelah job lolos filter (qualified found). Tujuannya memberi tahu Sales secepatnya ada job cocok yang sedang diproses AI.
- Alert Tahap 2: dikirim setelah cover letter + portfolio match + Notion page siap (draft ready). Berisi ringkasan lengkap, link Notion, dan command bid.

Kedua alert dapat dikirim ke chat yang sama. Masing-masing punya dedup key tersendiri (`stage1:<dedupKey>` dan `stage2:<dedupKey>`) sehingga hanya terkirim sekali per job.

### 14.1 Alert Tahap 1 — Qualified job found

Dikirim cepat, sebelum AI selesai. Gunakan HTML parse mode.

```text
🔔 <b>Qualified Job Found</b>

<b>{jobTitle}</b>

💰 <b>Budget:</b> {budgetText}
💳 <b>Payment:</b> {paymentText}
🧩 <b>Skills:</b> {skills}
📂 <b>Category:</b> {categories}

⏳ Cover letter & portfolio sedang disiapkan AI...
🔗 <a href="{upworkOrVollnaUrl}">Open Job</a>
```

### 14.2 Alert Tahap 2 — Cover letter ready

Dikirim setelah Notion page + cover letter siap.

```text
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

🔗 <a href="{upworkOrVollnaUrl}">Open Job</a>
🗂 <a href="{notionUrl}">Open Notion (cover letter + portfolio)</a>

Update status (pilih salah satu):
<code>/bid bidded {upworkOrVollnaUrl}</code>
<code>/bid rejected {upworkOrVollnaUrl}</code>
<code>/bid ignored {upworkOrVollnaUrl}</code>
<code>/bid success {upworkOrVollnaUrl}</code>
```

### 14.3 Payment unknown warning

Jika payment method tidak ada di RSS, tambahkan baris pada kedua alert:

```text
⚠️ Payment status not found in RSS. Please verify manually before bidding.
```

### 14.4 Telegram anti-spam

- Max 10 alert Tahap 2 per poll (alert Tahap 1 mengikuti job qualified yang sama).
- Jika lebih dari 10 qualified jobs dalam satu run, kirim summary tambahan:

```text
⚠️ There are 7 more qualified jobs not sent individually due to notification limit. Open Notion database to review.
```

### 14.5 Telegram command authorization

Commands hanya boleh dipakai user ID tertentu.

Jika unauthorized:

```text
Sorry, you are not allowed to update this pipeline.
```

Log unauthorized attempt.

---

## 15. Telegram Bot Commands

Satu command terpadu menggantikan `/bid` dan `/bid-success` lama.

### 15.1 `/bid <status> <url_link>`

Tujuan: update status bid di Notion berdasarkan status yang dikirim.

Status valid dan mapping ke Notion `Status Bid`:

| Input status | Notion `Status Bid` | SQLite `bid_status` |
|--------------|---------------------|---------------------|
| `bidded`     | `Bidded`            | `bidded`            |
| `rejected`   | `Rejected`          | `rejected`          |
| `ignored`    | `Ignored`           | `ignored`           |
| `success`    | `Success`           | `success`           |

Flow:

1. User mengirim `/bid <status> <url>`.
2. Bot validasi user authorized.
3. Bot parse argumen: token pertama = status, token kedua = url.
4. Validasi status ada di set `{bidded, rejected, ignored, success}`. Jika tidak, reply daftar status valid.
5. Normalize URL / extract Upwork job id.
6. Cari record di SQLite by:
   - external job id
   - upwork url
   - vollna url
7. Jika SQLite tidak menemukan, query Notion by URL/dedup key.
8. Jika record ditemukan:
   - Update SQLite `bid_status = <status>`.
   - Update Notion `Status Bid = <mapped>`.
   - Reply success.
9. Jika tidak ditemukan:
   - Reply not found dan sarankan cek URL.

Reply success (template per status):

```text
✅ Status updated → {StatusLabel}

Job: {title}
Notion: {notionUrl}
```

Contoh khusus `success` boleh pakai emoji berbeda:

```text
🎉 Status updated → Success

Job: {title}
Notion: {notionUrl}
```

Reply invalid status:

```text
⚠️ Status tidak valid.
Gunakan: /bid <bidded|rejected|ignored|success> <url>
Contoh: /bid bidded https://...
```

Reply not found:

```text
⚠️ Job not found in pipeline.
Please make sure the URL is the same Upwork/Vollna URL from the notification.
```

### 15.2 Backward compatibility (opsional)

Jika ingin tetap mendukung kebiasaan lama, alias berikut boleh ditambahkan:
- `/bid-success <url>` → diperlakukan sama dengan `/bid success <url>`.
- `/bid <url>` tanpa status → default ke `bidded` (atau reply minta status, sesuai preferensi tim).

### 15.3 Optional command fase 2

Tidak perlu MVP, tapi bisa ditambahkan setelah sistem stabil:

```text
/ignore <url> [reason]
/fail <url> [reason]
/status <url>
/list-new
/list-high
/help-sales
```

---

## 16. Scheduler / Worker Behavior

### 16.1 Startup flow

Saat app start:

1. Load config/env.
2. Validate required env.
3. Init logger.
4. Init SQLite.
5. Init Notion client.
6. Init Telegram bot.
7. Register Telegram commands.
8. Register cron worker.
9. Optionally run once on startup jika `RUN_ON_START=true`.

### 16.2 Polling flow detail

Pseudo:

```js
export async function runUpworkRssWorker() {
  const startedAt = new Date();
  logger.info("upwork rss worker started");

  const feed = await fetchVollnaFeed(config.UPWORK_RSS_URL);
  const rawItems = feed.items.slice(0, config.MAX_JOBS_PER_POLL);

  let stats = {
    seen: rawItems.length,
    new: 0,
    duplicate: 0,
    qualified: 0,
    rejected: 0,
    notifiedStage1: 0,
    notifiedStage2: 0,
    errors: 0,
  };

  for (const rawItem of rawItems) {
    try {
      const job = normalizeJob(parseVollnaItem(rawItem));
      const dedupKey = buildDedupKey(job);

      const existing = await dedupStore.findByDedupKey(dedupKey);
      if (existing) {
        await dedupStore.touch(existing.id, job);
        stats.duplicate += 1;
        continue;
      }

      stats.new += 1;

      const filterResult = evaluateJobCriteria(job, config);
      if (!filterResult.accepted) {
        await dedupStore.insertRejected(job, filterResult);
        stats.rejected += 1;
        continue;
      }

      stats.qualified += 1;

      // ALERT TAHAP 1: qualified found (kirim cepat, sebelum AI)
      if (!(await dedupStore.wasNotified(`stage1:${dedupKey}`))) {
        const msg1 = await notifyQualifiedFound(job);
        await dedupStore.markNotified(`stage1:${dedupKey}`, msg1.message_id);
        stats.notifiedStage1 += 1;
      }

      const portfolio = await loadPortfolioData();
      const matches = matchPortfolio(job, portfolio);
      const draft = await generateBidDraft(job, matches);
      const scoredJob = scoreJob(job, matches, draft);

      const notionPage = await upsertJobToNotion(scoredJob, matches, draft);
      await dedupStore.insertQualified(
        scoredJob,
        notionPage.id,
        matches,
        draft,
      );

      // ALERT TAHAP 2: cover letter ready (setelah Notion + draft siap)
      if (
        stats.notifiedStage2 < config.MAX_NOTIFICATIONS_PER_POLL &&
        !(await dedupStore.wasNotified(`stage2:${dedupKey}`))
      ) {
        const msg2 = await notifyCoverLetterReady(
          scoredJob,
          notionPage,
          matches,
          draft,
        );
        await dedupStore.markNotified(`stage2:${dedupKey}`, msg2.message_id);
        await updateNotionStatus(notionPage.id, "Notified");
        stats.notifiedStage2 += 1;
      }
    } catch (error) {
      logger.error({ error }, "failed processing rss item");
      stats.errors += 1;
    }
  }

  logger.info(
    { stats, durationMs: Date.now() - startedAt.getTime() },
    "upwork rss worker finished",
  );
}
```

### 16.3 Concurrency lock

Worker tidak boleh overlap jika run sebelumnya belum selesai.

Implement lock sederhana:

```js
let isRunning = false;

export async function runSafely() {
  if (isRunning) {
    logger.warn("skip run because previous run still active");
    return;
  }
  isRunning = true;
  try {
    await runUpworkRssWorker();
  } finally {
    isRunning = false;
  }
}
```

Untuk multi-process production, gunakan SQLite lock atau file lock.

---

## 17. Error Handling

### 17.1 RSS fetch error

Jika RSS gagal di-fetch:

- Log error.
- Jangan crash app.
- Optional notify admin Telegram setelah 3 gagal berturut-turut.

### 17.2 XML parse error

- Simpan raw response ke log/debug file jika dev.
- Notify admin jika berulang.

### 17.3 AI generation error

Jika AI gagal:

- Tetap create Notion page dengan `Status Bid = New` atau `Draft Error`.
- Kirim Telegram optional:

```text
⚠️ Qualified job found but AI draft failed. Please review manually.
```

### 17.4 Notion error

Jika Notion write gagal:

- Jangan kirim Telegram sebagai normal notification karena Notion URL belum ada.
- Simpan job di SQLite dengan `last_error`.
- Retry di run berikutnya.

### 17.5 Telegram error

Jika Telegram gagal:

- Notion tetap ada.
- SQLite status `drafted`, belum `notified`.
- Retry notification di run berikutnya.

---

## 18. Implementation Plan — Bite-sized Tasks

### Phase 0 — Setup project

#### Task 0.1 Create Node project

Files:

- Create `package.json`
- Create `.gitignore`
- Create `.env.example`
- Create `README.md`

Commands:

```bash
npm init -y
npm install rss-parser html-to-text csv-parse dotenv node-cron node-telegram-bot-api @notionhq/client better-sqlite3
npm install -D vitest eslint
```

`package.json` scripts:

```json
{
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

Verification:

```bash
npm test
```

Expected: test runner starts; no tests or all tests pass.

---

#### Task 0.2 Add config loader

Files:

- Create `src/config.js`
- Test `tests/config.test.js`

Config must:

- Load `.env` via dotenv.
- Parse numbers/booleans/lists.
- Validate required env only at runtime mode production.
- Provide safe defaults for dev.

Important env:

```js
export const config = {
  timezone: process.env.TZ || "Asia/Jakarta",
  upworkRssUrl: process.env.UPWORK_RSS_URL,
  upworkRssPollCron: process.env.UPWORK_RSS_POLL_CRON || "*/2 * * * *",
  fixedMinBudgetUsd: Number(process.env.UPWORK_FIXED_MIN_BUDGET_USD || 500),
  hourlyMinRateUsd: Number(process.env.UPWORK_HOURLY_MIN_RATE_USD || 15),
  requirePaymentVerified: parseBoolean(
    process.env.UPWORK_REQUIRE_PAYMENT_VERIFIED,
    true,
  ),
  allowUnknownPayment: parseBoolean(
    process.env.UPWORK_ALLOW_UNKNOWN_PAYMENT,
    true,
  ),
  notionApiKey: process.env.NOTION_API_KEY,
  notionDatabaseId: process.env.NOTION_UPWORK_JOBS_DATABASE_ID,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramSalesChatId: process.env.TELEGRAM_SALES_CHAT_ID,
  telegramAllowedUserIds: parseList(process.env.TELEGRAM_ALLOWED_USER_IDS),
  sqliteDbPath: process.env.SQLITE_DB_PATH || "./data/upwork-sales.sqlite",
  portfolioCsvPath: process.env.PORTFOLIO_CSV_PATH || "./data/portfolio.csv",
  upworkWorkDoneCsvPath:
    process.env.UPWORK_WORK_DONE_CSV_PATH || "./data/upwork-work-done.csv",
  dryRun: parseBoolean(process.env.DRY_RUN, false),
};
```

Tests:

- boolean parsing.
- list parsing.
- default cron is 5 minutes.

---

#### Task 0.3 Add logger

Files:

- Create `src/logger.js`

MVP logger can use `console`, but structured enough:

```js
export const logger = {
  info: (meta, message) =>
    console.log(JSON.stringify({ level: "info", message, ...normalize(meta) })),
  warn: (meta, message) =>
    console.warn(
      JSON.stringify({ level: "warn", message, ...normalize(meta) }),
    ),
  error: (meta, message) =>
    console.error(
      JSON.stringify({ level: "error", message, ...normalize(meta) }),
    ),
};
```

Verification:

- Run `node -e "import('./src/logger.js').then(({logger}) => logger.info({ok:true}, 'test'))"`.

---

### Phase 1 — RSS parser

#### Task 1.1 Add RSS fetcher

Files:

- Create `src/rss/fetchVollnaFeed.js`
- Test `tests/fetchVollnaFeed.test.js` with mocked parser if possible.

Function:

```js
export async function fetchVollnaFeed(url) {
  // returns { title, lastBuildDate, pubDate, expireDate, items }
}
```

Requirements:

- Timeout request.
- Throw clear error if no items.
- Preserve raw item fields.

---

#### Task 1.2 Add sample fixture

Files:

- Create `tests/fixtures/vollna-sample.xml`

Include at least 3 items:

1. Fixed price USD 1,500.
2. Fixed price USD 300.
3. Hourly USD 15-30/hr.

Make sure fixture includes:

- title
- description with Skills/Categories
- pubDate
- link with encoded Upwork URL
- category tags

---

#### Task 1.3 Parse Vollna item

Files:

- Create `src/rss/parseVollnaItem.js`
- Test `tests/parseVollnaItem.test.js`

Function:

```js
export function parseVollnaItem(item) {
  return {
    rssTitle,
    jobTitle,
    jobType,
    fixedBudgetUsd,
    hourlyMinUsd,
    hourlyMaxUsd,
    descriptionText,
    skills,
    categories,
    pubDate,
    vollnaUrl,
    upworkUrl,
    externalJobId,
    paymentVerified,
  };
}
```

Test cases:

- Parses `Fixed Price: 1,500 USD` as `fixedBudgetUsd = 1500`.
- Parses `Fixed Price: 500 USD` as `500`.
- Parses hourly title variants.
- Extracts and double-decodes Upwork URL.
- Extracts job id `~022...`.
- Cleans CDATA/HTML description to plain text.
- Extracts skills from `Skills:` line.
- Extracts categories from both XML category tags and description.

---

#### Task 1.4 Add URL utilities

Files:

- Create `src/utils/urls.js`
- Test `tests/urls.test.js`

Functions:

```js
export function extractNestedUrlParam(url, paramName = "url") {}
export function normalizeUrl(url) {}
export function extractUpworkJobId(url) {}
```

Normalization:

- Remove tracking params if safe.
- Keep actual Upwork path.
- Lowercase hostname.
- Remove trailing slash.

---

#### Task 1.5 Add money parsing utilities

Files:

- Create `src/utils/money.js`
- Test `tests/money.test.js`

Functions:

```js
export function parseUsdAmount(text) {}
export function parseFixedBudget(text) {}
export function parseHourlyRange(text) {}
export function formatBudgetText(job) {}
```

Must handle:

```text
1,500 USD
$1,500
500 USD
Hourly: $15.00-$30.00
$15/hr
15 USD/hour
```

---

### Phase 2 — Filtering and scoring

#### Task 2.1 Implement criteria filter

Files:

- Create `src/filters/jobCriteria.js`
- Test `tests/jobCriteria.test.js`

Function:

```js
export function evaluateJobCriteria(job, config) {
  return {
    accepted: true,
    status: "qualified",
    reasons: [],
    warnings: [],
  };
}
```

Rules:

- Fixed budget >= 500.
- Hourly min >= 15.
- Reject explicit unverified payment.
- If payment unknown and `allowUnknownPayment=true`, accept with warning.
- Reject blocked keywords.

Test cases:

- Fixed 499 rejected.
- Fixed 500 accepted.
- Hourly 14 rejected.
- Hourly 15 accepted.
- Unverified rejected.
- Unknown payment accepted with warning if config allows.
- Unknown payment rejected if config disallows.

---

#### Task 2.2 Implement score job

Files:

- Create `src/filters/scoreJob.js`
- Test `tests/scoreJob.test.js`

Function:

```js
export function scoreJob(job, matches, aiDraft) {
  return {
    score: 0,
    priority: "low",
    scoreBreakdown: {},
  };
}
```

Simple MVP scoring:

- budget/rate: max 20
- portfolio match: max 25
- category match: max 15
- description quality: max 15
- client seriousness: max 10
- long-term/urgent: max 10
- low red flags: max 5

Priority:

```js
if (score >= 80) priority = "high";
else if (score >= 60) priority = "medium";
else priority = "low";
```

---

### Phase 3 — CSV portfolio matching

#### Task 3.1 Create CSV templates

Files:

- Create `data/portfolio.csv`
- Create `data/upwork-work-done.csv`
- Create sample tests fixtures.

Use headers from section 11.

Do not fill real client data yet unless PM/Sales provides it.

---

#### Task 3.2 Implement CSV loader

Files:

- Create `src/portfolio/loadPortfolioCsv.js`
- Test `tests/loadPortfolioCsv.test.js`

Functions:

```js
export async function loadPortfolioCsv(path) {}
export async function loadUpworkWorkDoneCsv(path) {}
export async function loadPortfolioData(config) {
  return { portfolioItems, upworkWorkItems };
}
```

Requirements:

- Missing CSV should not crash production; return empty array and warning.
- Validate required columns.
- Split semicolon fields into arrays.

---

#### Task 3.3 Implement portfolio matcher

Files:

- Create `src/portfolio/matchPortfolio.js`
- Test `tests/matchPortfolio.test.js`

Function:

```js
export function matchPortfolio(job, { portfolioItems, upworkWorkItems }) {
  return {
    portfolio: topPortfolio,
    upworkWork: topUpworkWork,
  };
}
```

Requirements:

- Return top 3 portfolio.
- Return top 2 Upwork works.
- Include `score` and `reason`.
- Prefer Upwork work done if skill match similar.
- Respect `permission_to_mention` later in AI prompt.

---

### Phase 4 — AI draft generation

#### Task 4.1 Implement LLM client

Files:

- Create `src/ai/llmClient.js`
- Test `tests/llmClient.test.js` with mocked fetch.

Function:

```js
export async function callLlmJson({ system, user, schema }) {}
```

Requirements:

- Uses OpenAI-compatible `/chat/completions` endpoint.
- Parses JSON response.
- Retries once on invalid JSON with repair prompt.
- Redacts API key in logs.

---

#### Task 4.2 Build cover letter prompt

Files:

- Create `src/ai/buildCoverLetterPrompt.js`
- Test `tests/buildCoverLetterPrompt.test.js`

Requirements:

- Includes job JSON.
- Includes matched portfolio JSON.
- Includes matched Upwork work JSON.
- Explicitly says no fabrication.
- Explicitly respects `permission_to_mention`.

---

#### Task 4.3 Generate bid draft

Files:

- Create `src/ai/generateBidDraft.js`
- Test `tests/generateBidDraft.test.js` with mocked LLM.

Function:

```js
export async function generateBidDraft(job, matches, config) {}
```

Output schema:

```js
{
  jobSummary: [],
  clientNeed: '',
  fitAnalysis: '',
  redFlags: [],
  questionsToAsk: [],
  recommendedPortfolioIds: [],
  recommendedUpworkWorkIds: [],
  coverLetter: '',
  bidStrategy: '',
  priority: 'medium',
  confidence: 0.75,
}
```

Fallback if LLM fails:

- Create minimal draft object with error note.
- Do not block Notion creation for qualified job.

---

### Phase 5 — Notion integration

#### Task 5.1 Create Notion client

Files:

- Create `src/notion/notionClient.js`

Function:

```js
export function createNotionClient(config) {
  return new Client({ auth: config.notionApiKey });
}
```

---

#### Task 5.2 Map job to Notion properties

Files:

- Create `src/notion/mapJobToNotionProperties.js`
- Test `tests/mapJobToNotionProperties.test.js`

Function:

```js
export function mapJobToNotionProperties(job, matches, draft) {}
```

Requirements:

- Respect Notion property types.
- Truncate rich_text fields safely if too long.
- Multi-select names under Notion limits.
- URL fields null if invalid.

Important helpers:

```js
function titleProperty(text) {}
function richTextProperty(text) {}
function selectProperty(name) {}
function multiSelectProperty(names) {}
function numberProperty(value) {}
function urlProperty(url) {}
function dateProperty(date) {}
```

---

#### Task 5.3 Create/update Notion job page

Files:

- Create `src/notion/upworkJobsDatabase.js`
- Test with mocked Notion client.

Functions:

```js
export async function createJobPage(notion, config, job, matches, draft) {}
export async function updateJobStatus(notion, pageId, status) {}
export async function findJobPageByUrl(notion, config, urlOrJobId) {}
```

MVP create page:

```js
await notion.pages.create({
  parent: { database_id: config.notionDatabaseId },
  properties: mapJobToNotionProperties(job, matches, draft),
  children: buildJobPageBlocks(job, matches, draft),
});
```

---

#### Task 5.4 Build page body blocks

Files:

- Add to `src/notion/upworkJobsDatabase.js` or create `src/notion/buildJobPageBlocks.js`
- Test block output shape.

Sections:

- Job Summary
- Cover Letter Draft
- Recommended Portfolio
- Recommended Upwork Work
- Red Flags
- Questions
- Bid Strategy
- Original Job Description

---

### Phase 6 — SQLite dedup/state

#### Task 6.1 Create SQLite connection

Files:

- Create `src/state/sqlite.js`

Function:

```js
export function openDatabase(dbPath) {}
export function migrateDatabase(db) {}
```

Migration creates `upwork_jobs` table from section 10.

---

#### Task 6.2 Implement dedup store

Files:

- Create `src/state/dedupStore.js`
- Test `tests/dedupStore.test.js`

Functions:

```js
export function createDedupStore(db) {
  return {
    findByDedupKey,
    findByUrlOrJobId,
    insertRejected,
    insertQualified,
    touch,
    wasNotified,
    markNotified,
    updateBidStatus,
  };
}
```

Requirements:

- Unique `dedup_key`.
- Store raw JSON.
- Update `last_seen_at` on duplicate.
- Query by external id or normalized URL for Telegram commands.

---

### Phase 7 — Telegram integration

#### Task 7.1 Create Telegram client

Files:

- Create `src/telegram/telegramClient.js`

Function:

```js
export function createTelegramBot(config) {
  return new TelegramBot(config.telegramBotToken, { polling: true });
}
```

If running only worker without commands, can use sendMessage HTTP. But because command `/bid` is required, use polling or webhook.

MVP VPS recommendation:

- Use polling mode for simplest deploy.
- Later can migrate to webhook.

---

#### Task 7.2 Build notification formatter

Files:

- Create `src/telegram/notifications.js`
- Test `tests/notifications.test.js`

Functions:

```js
// Alert Tahap 1 — qualified found (cepat, sebelum AI)
export function buildQualifiedFoundMessage(job) {}
export async function notifyQualifiedFound(bot, config, job) {}

// Alert Tahap 2 — cover letter ready (setelah Notion + draft)
export function buildCoverLetterReadyMessage(job, notionPage, matches, draft) {}
export async function notifyCoverLetterReady(
  bot,
  config,
  job,
  notionPage,
  matches,
  draft,
) {}
```

Requirements:

- Escape HTML dynamic text.
- Alert Tahap 2 include 4 command examples (`/bid bidded|rejected|ignored|success <url>`).
- Include payment unknown warning di kedua alert bila perlu.
- Keep message under Telegram limit 4096 chars.

---

#### Task 7.3 Implement command parser

Files:

- Create `src/telegram/commands.js`
- Test `tests/telegramCommands.test.js`

Functions:

```js
export function registerSalesCommands(bot, deps) {}
// parseBidCommand returns { status, url } where status ∈ {bidded,rejected,ignored,success}
export function parseBidCommand(text) {}
export function isValidBidStatus(status) {}
export function isAuthorizedTelegramUser(userId, config) {}
```

Commands:

- `/bid <status> <url>` dengan status: `bidded`, `rejected`, `ignored`, `success`
- (opsional alias) `/bid-success <url>` → `success`

Behavior:

- Unauthorized reply.
- Missing/invalid status reply (tampilkan daftar status valid).
- Missing URL reply.
- Invalid URL reply.
- Not found reply.
- Success reply (label sesuai status, mapping ke Notion `Status Bid`).

Test cases:

- `/bid bidded <url>` → status bidded.
- `/bid success <url>` → status success.
- `/bid rejected <url>` → status rejected.
- `/bid ignored <url>` → status ignored.
- `/bid wrongstatus <url>` → reply invalid status.
- `/bid <url>` tanpa status → reply minta status (atau default bidded sesuai konfigurasi tim).

---

### Phase 8 — Scheduler integration

#### Task 8.1 Implement worker

Files:

- Create `src/scheduler/upworkRssWorker.js`

Function:

```js
export function createUpworkRssWorker(deps) {
  return async function runUpworkRssWorker() {};
}
```

Deps:

```js
{
  config,
  logger,
  dedupStore,
  notion,
  telegramBot,
  fetchVollnaFeed,
  loadPortfolioData,
  generateBidDraft,
}
```

---

#### Task 8.2 Register cron

Files:

- Create `src/scheduler/index.js`

Function:

```js
export function startScheduler({ config, worker, logger }) {
  cron.schedule(config.upworkRssPollCron, runSafely(worker, logger), {
    timezone: config.timezone,
  });
}
```

Requirements:

- No overlapping run.
- Log next/started/finished.

---

#### Task 8.3 App entrypoint

Files:

- Create `src/index.js`

Startup:

1. Load config.
2. Open DB and migrate.
3. Create Notion client.
4. Create Telegram bot.
5. Register commands.
6. Create worker.
7. Start scheduler.
8. If `RUN_ON_START=true`, run worker once.

---

### Phase 9 — Deployment

#### Task 9.1 VPS setup

Recommended server:

- Ubuntu 22.04/24.04
- 1 vCPU minimum
- 1GB RAM minimum
- Node.js 20/22
- PM2

Commands:

```bash
sudo apt update
sudo apt install -y git curl build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

---

#### Task 9.2 Deploy app

Commands:

```bash
git clone <repo-url> illiyinclaw-sales
cd illiyinclaw-sales
npm ci
cp .env.example .env
nano .env
mkdir -p data logs
npm test
```

Fill `.env` with actual secrets.

---

#### Task 9.3 PM2 config

File: `ecosystem.config.cjs`

```js
module.exports = {
  apps: [
    {
      name: "illiyin-upwork-sales-worker",
      script: "src/index.js",
      cwd: "/home/ubuntu/illiyinclaw-sales",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        TZ: "Asia/Jakarta",
      },
    },
  ],
};
```

Commands:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
pm2 logs illiyin-upwork-sales-worker
```

---

## 19. Testing Plan

### 19.1 Unit tests

Run:

```bash
npm test
```

Must cover:

- RSS item parsing.
- URL decoding.
- Budget parsing.
- Payment filter.
- Dedup key.
- Portfolio matching.
- AI prompt generation.
- Notion property mapping.
- Telegram command parsing.

### 19.2 Integration tests with dry run

Run local:

```bash
DRY_RUN=true RUN_ON_START=true npm start
```

Expected:

- Fetch RSS.
- Parse items.
- Filter jobs.
- Generate dry-run logs for Notion/Telegram without real write.

### 19.3 Notion sandbox test

Create a test Notion database first.

Env:

```env
NOTION_UPWORK_JOBS_DATABASE_ID=<sandbox_db_id>
DRY_RUN=false
TELEGRAM_SALES_CHAT_ID=<private_test_chat_id>
```

Run:

```bash
RUN_ON_START=true npm start
```

Verify:

- A qualified job creates Notion page.
- Properties are filled correctly.
- Page body includes cover letter.
- Telegram message links to Notion.

### 19.4 Telegram command test

In test chat:

```text
/bid bidded <url_from_notification>
```

Expected:

- Bot replies success.
- Notion `Status Bid` changes to `Bidded`.
- SQLite `bid_status` changes to `bidded`.

Then test other statuses:

```text
/bid rejected <url_from_notification>
/bid ignored <url_from_notification>
/bid success <url_from_notification>
```

Expected:

- Bot replies success for each valid status.
- Notion `Status Bid` changes to `Rejected`, `Ignored`, and `Success` respectively.
- SQLite `bid_status` changes accordingly.

Also test invalid status:

```text
/bid wrongstatus <url_from_notification>
```

Expected:

- Bot replies usage help and does NOT update Notion/SQLite.

### 19.5 Failure tests

Manually test:

- Invalid RSS URL.
- Invalid Notion token.
- Invalid Telegram token.
- Missing CSV.
- Empty CSV.
- Unauthorized Telegram user.
- Duplicate job.
- LLM API failure.

Expected:

- App logs error.
- App does not crash permanently.
- No duplicate spam.

---

## 20. Monitoring and Operations

### 20.1 Logs to watch

Important log events:

```text
upwork rss worker started
upwork rss worker finished
job rejected
job qualified
notion page created
telegram notification sent
telegram command received
telegram command unauthorized
bid status updated
worker error
```

### 20.2 Daily health summary optional

Fase 2 bisa tambah daily Telegram summary jam 17:00 WIB:

```text
📊 Upwork Pipeline Daily Summary

Seen: 120
New: 34
Qualified: 8
Notified: 8
Bidded: 3
Success: 0
Errors: 1

Top categories:
- Web, Mobile & Software Dev: 5
- Design & Creative: 3
```

### 20.3 Admin error alert

Jika worker gagal 3 kali berturut-turut:

```text
⚠️ Upwork RSS worker error

RSS fetch failed 3 times consecutively.
Last error: timeout after 20000ms
```

---

## 21. Security Checklist

- `.env` masuk `.gitignore`.
- SQLite DB masuk `.gitignore` jika mengandung job/client data.
- Telegram command dibatasi by user ID.
- Jangan log API keys.
- Jangan kirim full raw description terlalu panjang ke Telegram.
- Jangan mention confidential portfolio jika `permission_to_mention=no`.
- Jangan auto-submit Upwork proposal.
- Jangan browser scrape Upwork untuk MVP.
- Backup Notion/CSV secara berkala.

---

## 22. Risks and Mitigations

### Risk 1 — RSS tidak mengandung payment verified

Impact:

- Bisa miss requirement payment method verified.

Mitigation:

- Mark `paymentVerified=unknown`.
- Telegram warning manual check.
- Notion status `needs_manual_payment_check` atau warning in red flags.

### Risk 2 — Vollna RSS berubah format

Impact:

- Parser gagal.

Mitigation:

- Unit tests with fixture.
- Parser defensive.
- Log parse error.
- Keep raw item JSON.

### Risk 3 — Duplicate notification

Impact:

- Spam Telegram.

Mitigation:

- Dedup by Upwork job id.
- Store notification state in SQLite.
- No re-notify unless explicit config.

### Risk 4 — AI hallucination

Impact:

- Cover letter menyebut pengalaman yang tidak benar.

Mitigation:

- Prompt strict no fabrication.
- AI only receives allowed portfolio/work context.
- PM/Sales review before bidding.
- Add validation: cover letter should not contain portfolio not in matched IDs.

### Risk 5 — Notion API rate limit

Impact:

- Write fails.

Mitigation:

- Process sequentially.
- Limit jobs per poll.
- Retry with backoff.

### Risk 6 — Telegram group command abuse

Impact:

- Unauthorized status update.

Mitigation:

- Check `from.id` in allowlist.
- Log attempts.

### Risk 7 — Terms/legal issue if expanding to direct Upwork scraping

Impact:

- Account/platform risk.

Mitigation:

- Keep RSS-only MVP.
- Human manually opens Upwork and bids.
- Review Upwork Terms before adding browser automation.

---

## 23. MVP Scope vs Later Scope

### MVP must have

- RSS polling every 2 minutes by default (`*/2 * * * *`), configurable to 1 minute if Vollna remains stable.
- Parse job title, budget/rate, description, skills, categories, date, link.
- Filter by fixed/hourly/payment status where available.
- Dedup.
- CSV portfolio templates.
- Portfolio matching.
- AI cover letter draft.
- Notion create page.
- Telegram Alert Tahap 1 when qualified job is found.
- Telegram Alert Tahap 2 when cover letter + Notion page are ready.
- Telegram `/bid <status> <url>` updates Notion/SQLite status for `bidded`, `rejected`, `ignored`, and `success`.
- PM2 deployment on VPS.

### Later / Phase 2

- Daily summary report.
- More Telegram commands.
- Admin dashboard.
- Better semantic search/vector matching for portfolio.
- Notion relation database for portfolio items.
- Browser fallback for enrichment only after legal review.
- Multi-RSS feed support.
- Auto-labeling by service line.
- A/B testing cover letter templates.
- Slack/Discord integration if needed.

---

## 24. Acceptance Criteria

System dianggap selesai MVP jika:

1. Worker bisa berjalan 24/7 di VPS via PM2.
2. RSS Vollna dibaca otomatis setiap 2 menit (configurable 1 menit).
3. Job duplicate tidak membuat Notion page/notifikasi berulang.
4. Fixed price job di bawah $500 ditolak.
5. Hourly job di bawah $15/hour ditolak.
6. Payment unverified ditolak jika field tersedia.
7. Payment unknown diberi warning manual check.
8. Job qualified langsung memicu Telegram Alert Tahap 1 (qualified found).
9. Job qualified dibuatkan Notion page.
10. Setelah cover letter + Notion siap, Telegram Alert Tahap 2 (cover letter ready) terkirim dengan link Notion.
11. Notion page berisi minimal:
   - title
   - budget/rate
   - job link
   - date
   - status bid
   - cover letter
   - portfolio recommendation
12. `/bid bidded <url>` mengubah Notion `Status Bid` menjadi `Bidded`.
13. `/bid rejected <url>` mengubah Notion `Status Bid` menjadi `Rejected`.
14. `/bid ignored <url>` mengubah Notion `Status Bid` menjadi `Ignored`.
15. `/bid success <url>` mengubah Notion `Status Bid` menjadi `Success`.
16. `/bid <status>` dengan status tidak valid ditolak dengan pesan bantuan.
17. Unauthorized Telegram user tidak bisa update status.
18. Test suite untuk parser/filter/matcher/commands passing.
19. README menjelaskan setup `.env`, Notion database, Telegram bot, dan deploy VPS.

---

## 25. Recommended Build Order

Urutan implementasi paling aman:

1. Setup Node project.
2. Buat CSV templates.
3. Implement RSS parser + tests.
4. Implement filter + tests.
5. Implement SQLite dedup + tests.
6. Implement portfolio matching + tests.
7. Implement AI prompt + mocked generation tests.
8. Implement Notion mapping + mocked tests.
9. Implement Telegram formatter + command parser tests.
10. Integrate worker with `DRY_RUN=true`.
11. Test against real RSS but no Notion/Telegram write.
12. Setup Notion sandbox database.
13. Test Notion write.
14. Test Telegram private chat.
15. Enable production group/chat.
16. Deploy VPS with PM2.
17. Monitor logs for 24-48 hours.
18. Tune filters and portfolio CSV based on Sales feedback.

---

## 26. Manual Setup Checklist for PM/Sales

Sebelum production, PM/Sales perlu isi:

### 26.1 Portfolio CSV

File:

```text
data/portfolio.csv
```

Minimal isi 10-20 portfolio terbaik.

Wajib lengkap:

- `id`
- `title`
- `service_category`
- `industry`
- `skills`
- `summary`
- `case_study_url` jika ada
- `proof_strength`

### 26.2 Upwork work done CSV

File:

```text
data/upwork-work-done.csv
```

Minimal isi 5-15 project Upwork paling relevan.

Wajib cek:

- Apakah boleh disebut ke client baru?
- Kalau tidak boleh, set `permission_to_mention=no`.

### 26.3 Telegram IDs

Ambil:

- Bot token dari BotFather.
- Chat ID grup Sales.
- User ID PM/Sales yang boleh update status.

### 26.4 Notion integration

Langkah:

1. Buat Notion integration.
2. Copy API key.
3. Buat database `Illiyin Sales - Upwork Job Pipeline`.
4. Share database/page ke integration.
5. Copy database ID ke `.env`.

---

## 27. Notes for Future Browser Automation / OpenClaw

OpenClaw tidak perlu untuk MVP. Jika nanti ingin dipakai, batasi untuk:

- Internal QA flow.
- Membuka link untuk manusia, bukan scraping massal.
- Screenshot/manual review assistance.
- Tidak untuk bypass login/CAPTCHA.
- Tidak untuk auto-submit bid.

Sebelum implement OpenClaw/Browser automation untuk Upwork:

1. Review ulang Upwork Terms.
2. Pastikan tidak melanggar prohibited data mining/scraping.
3. Pastikan ada human action untuk submit proposal.
4. Simpan audit log.

---

## 28. Final Recommendation

Bangun MVP sebagai RSS-first automation service.

Keputusan teknis utama:

- Poll Vollna RSS setiap 2 menit (configurable 1 menit).
- Jangan scrape langsung Upwork untuk MVP.
- Notion menjadi pipeline database utama.
- SQLite menjadi dedup/local state.
- Telegram menjadi alert dan status update interface.
- AI hanya membuat draft, bukan melakukan bid otomatis.
- PM/Sales tetap review dan submit manual.

Dengan scope ini, sistem cukup aman, cepat dibuat, mudah diuji, dan langsung berguna untuk divisi Sales tanpa bergantung pada browser automation yang rapuh.
