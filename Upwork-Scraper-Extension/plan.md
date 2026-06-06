# Plan: Upwork Job Review Assistant Extension

Tanggal: 2026-06-06
Folder: `Upwork-Scraper-Extension/`
Referensi halaman: `result.html`

## 1. Summary

Tujuan extension ini adalah membantu PM/Sales team menilai job Upwork yang sedang mereka buka secara manual, menerapkan default filter bisnis, mengekspor kandidat job ke CSV, dan menyiapkan data untuk proses AI scoring/proposal draft.

Catatan batas aman:

- Project folder boleh tetap bernama `Upwork-Scraper-Extension`, tetapi nama produk/user-facing sebaiknya `Upwork Job Review Assistant`.
- Extension tidak boleh dibuat sebagai crawler otomatis untuk Upwork produksi.
- Extension tidak boleh auto-refresh, auto-pagination, mengambil data massal, intercept private API, auto-login, atau auto-submit proposal.
- Extension boleh membantu di halaman yang sedang dibuka user, dengan aksi eksplisit dari user, dan menyimpan hasil lokal sebagai CSV.
- Mode bulk collection hanya boleh ditambahkan nanti jika ada izin tertulis/API resmi/authorized feed.

Use case aman untuk v1:

```text
Sales/PM buka halaman search Upwork manual
-> Sales/PM apply filter di Upwork manual
-> Sales/PM klik extension
-> Extension membaca job cards yang sedang tampil di halaman aktif
-> Extension apply default business filter lokal
-> Hasil capture ditambahkan ke data yang sudah tersimpan, bukan replace
-> Sales/PM bisa pindah halaman manual lalu klik capture lagi untuk menumpuk data
-> Extension tampilkan hasil review
-> Sales/PM export CSV scraped-jobs-list.csv
-> Data dipakai untuk AI scoring/proposal draft
```

Use case yang tidak diimplementasikan di v1:

```text
Klik scrape -> extension apply filter otomatis
Klik scrape -> set jobs per page 50 otomatis
Klik scrape -> scrape semua data
Tunggu random 1-2 menit
Pergi otomatis ke halaman berikutnya
Ulangi scrape otomatis
```

Alasan: pola tersebut tetap scraping/crawling otomatis terhadap Upwork produksi, walaupun dilakukan lewat browser extension.

## 2. Default Business Filter

Filter default dari Illiyin Sales:

- Fixed price: minimum USD 500.
- Hourly: minimum USD 15/hour.
- Payment method: verified.

Behavior:

- Job fixed di bawah USD 500 diberi `risk_flags=low_budget`.
- Job hourly di bawah USD 15/hour diberi `risk_flags=low_budget`.
- Job dengan payment unverified diberi `risk_flags=payment_unverified`.
- Job dengan payment unknown masuk `recommended_action=review`.
- Job yang gagal default filter tidak boleh otomatis masuk `draft`; status default `review` atau `reject`.
- Case khusus bisa dioverride manual oleh sales lead setelah export/review.

## 3. Extension Scope

### In Scope v1

- Manifest V3 Chrome extension.
- Content script hanya aktif di:
  - `https://www.upwork.com/nx/search/jobs/*`
  - halaman detail job Upwork jika nanti dibutuhkan.
- Popup UI untuk:
  - melihat status halaman aktif.
  - mengatur local business filter default.
  - trigger `Capture Current Page`.
  - export CSV.
  - reset semua local results saat data sudah tidak diperlukan.
- Background service worker untuk:
  - menyimpan state capture.
  - menyimpan hasil di `chrome.storage.local`.
  - membuat/download CSV.
  - memastikan proses capture tidak bergantung pada popup tetap terbuka.
- Content script parser untuk:
  - membaca job cards yang sudah tampil di DOM halaman aktif.
  - normalisasi data ke schema CSV.
  - tidak melakukan pagination otomatis.
  - tidak memanggil private API Upwork.
- Result viewer lokal extension untuk:
  - melihat daftar hasil capture.
  - filter lokal by status/risk.
  - export ulang CSV.

### Out of Scope v1

- Auto apply filter ke UI Upwork.
- Auto set jobs per page ke 50.
- Auto click next page.
- Random wait automation.
- Long-running background crawling.
- Scrape saat tab Upwork tidak dipilih oleh user.
- Bypass CAPTCHA/anti-bot/rate limit.
- Auto bid/auto submit proposal.
- Menyimpan credential Upwork.

### Future Scope Setelah Ada Izin/API Resmi

- Authorized bulk collection mode.
- Scheduled collection dari API/feed resmi.
- Pagination hanya lewat endpoint/flow yang diizinkan.
- Rate limit mengikuti dokumentasi/izin resmi, bukan random wait.
- Audit log lengkap untuk compliance.

## 4. Proposed Files

Struktur implementasi yang disarankan:

```text
Upwork-Scraper-Extension/
  manifest.json
  popup.html
  popup.css
  popup.js
  background.js
  content.js
  result.html
  result.js
  result.css
  README.md
  plan.md
```

Notes:

- `result.html` yang ada sekarang dipakai sebagai referensi DOM snapshot Upwork, bukan sebagai file UI extension final.
- Jika `result.html` ingin dipertahankan sebagai fixture, pindahkan nanti ke `fixtures/upwork-search-result.html`.
- Jangan hardcode selector yang rapuh tanpa fallback; Upwork DOM bisa berubah.

## 5. Data Model

CSV output: `scraped-jobs-list.csv`.

Schema dibuat mirip `data/sample-jobs-template.csv`, ditambah field yang berguna untuk extension capture.

```csv
job_id,source,source_url,title,description,budget_type,budget_min,budget_max,payment_method_verified,client_country,posted_at,required_skills,fit_score,risk_flags,recommended_action,captured_at,captured_by,manual_notes
```

Field rules:

- `job_id`: stable local ID. Prefer URL/job UID if visible; fallback hash dari `source_url + title + captured_at_date`.
- `source`: default `upwork_visible_page`.
- `source_url`: job detail URL jika tersedia.
- `title`: text title dari card.
- `description`: visible snippet atau detail text jika halaman detail dibuka manual.
- `budget_type`: `fixed`, `hourly`, atau `unknown`.
- `budget_min`: angka minimum dari budget/rate jika bisa diparse.
- `budget_max`: angka maksimum dari budget/rate jika bisa diparse.
- `payment_method_verified`: `verified`, `unverified`, atau `unknown`.
- `client_country`: negara client jika terlihat.
- `posted_at`: waktu post jika terlihat; simpan raw/normalized jika memungkinkan.
- `required_skills`: semicolon-separated skills jika terlihat.
- `fit_score`: kosong di extension v1, diisi nanti oleh AI workflow.
- `risk_flags`: semicolon-separated hasil default filter lokal.
- `recommended_action`: `review` atau `reject` dari default filter lokal.
- `captured_at`: timestamp Asia/Jakarta saat capture.
- `captured_by`: optional nama/user local yang diisi di settings.
- `manual_notes`: optional.

## 6. UX Flow

### Popup

Controls:

- `Capture Current Page`
- `Open Results`
- `Export CSV`
- `Reset All Data`

Filter settings:

- Fixed min input, default `500`.
- Hourly min input, default `15`.
- Payment method required toggle, default `on`.

Status:

- Current tab supported/unsupported.
- Last capture count.
- Total saved jobs.
- Last CSV export time.
- Last reset time.
- Warning that extension does not auto-crawl or auto-submit.

### Capture Flow

```text
User opens Upwork search page manually
-> User applies Upwork filters manually if desired
-> User clicks Capture Current Page
-> popup sends START_CAPTURE to background
-> background targets active Upwork tab
-> background sends CAPTURE_VISIBLE_JOBS to content script
-> content script parses visible job cards
-> content script returns normalized rows
-> background dedupes by job_id/source_url
-> background applies default business filter
-> background appends new unique rows to chrome.storage.local
-> popup/result page shows count and export option
```

Manual pagination behavior:

- Data capture bersifat append-only per session storage.
- Klik `Capture Current Page` berikutnya tidak boleh replace data lama.
- Sales/PM boleh pindah halaman Upwork secara manual, lalu klik `Capture Current Page` lagi untuk menambah rows dari halaman baru.
- Duplicate detection tetap berjalan supaya job yang sama tidak muncul dua kali.
- Data lama hanya hilang jika user klik `Reset All Data`.
- `Reset All Data` harus meminta konfirmasi sebelum menghapus semua rows lokal.

Popup independence:

- Capture state lives in background/storage, not popup runtime memory.
- Closing popup after starting capture must not lose captured rows.
- If the Upwork tab is closed before capture finishes, background marks capture as failed and stores an error.
- Stop/reset/export commands target stored state, not whichever tab is active.

### Result Page

Columns:

- Title
- Budget
- Payment
- Client Country
- Risk Flags
- Recommended Action
- Source URL
- Captured At

Actions:

- Export CSV.
- Copy selected row JSON.
- Remove row.
- Reset all data.

## 7. DOM Parsing Plan

Use `result.html` to identify stable candidate selectors, but implement fallbacks:

- Search page root:
  - `[data-test="JobsPage"]`
  - fallback: `main`
- Job card candidates:
  - elements containing job title links.
  - elements with repeated card-like structure under jobs page.
- Title:
  - job title anchor text.
- URL:
  - anchor `href` for job detail.
- Description:
  - visible snippet text near the card.
- Budget/rate:
  - parse text containing `$`, `Fixed-price`, `Hourly`, `/hr`.
- Payment verification:
  - parse visible text containing `Payment verified` or `Payment unverified`.
- Client country:
  - parse visible location text if available.
- Skills:
  - parse visible skill badges/tags if available.

Parser rules:

- Only read DOM text already loaded in the current tab.
- Do not call Upwork API endpoints.
- Do not scroll to force lazy loading in v1.
- Do not click filters, pagination, or job cards automatically in v1.
- Fail softly if selector changes; return `unknown` fields instead of throwing.

## 8. Compliance Guardrails

Hard blocks:

- No automatic pagination.
- No auto setting jobs per page.
- No random-delay crawl loop.
- No hidden background harvesting.
- No API interception.
- No credential handling.
- No proposal submission.

In-app copy:

```text
This extension captures only visible jobs from the page you opened manually. It does not crawl Upwork, submit proposals, or bypass platform controls.
```

Before export:

```text
Confirm that this data was collected from pages you opened manually and will be used only for internal review.
```

## 9. Test Plan

### Static Fixture Test

- Load `result.html` as fixture.
- Run parser against fixture DOM.
- Assert at least one row can be extracted if job cards are present.
- Assert missing fields become `unknown`/empty, not crash.

### Filter Test

- Fixed USD 499 -> `low_budget`, `recommended_action=reject`.
- Fixed USD 500 -> no `low_budget`.
- Hourly USD 14 -> `low_budget`, `recommended_action=reject`.
- Hourly USD 15 -> no `low_budget`.
- Payment unverified -> `payment_unverified`, `recommended_action=reject` or `review`.
- Payment unknown -> `recommended_action=review`.

### Storage Test

- Capture current page twice.
- Duplicate jobs are not duplicated.
- Existing rows keep original `captured_at`.
- Capture page 1, navigate manually to page 2, capture again, and verify rows are appended.
- Capture page 2 must not replace page 1 rows.
- `Reset All Data` clears all stored rows only after confirmation.
- Export CSV includes all required columns.

### Popup Independence Test

- Start capture.
- Close popup immediately.
- Reopen popup.
- Captured rows and status are still available.

### Browser Manual Test

- Open `https://www.upwork.com/nx/search/jobs/?q=designer` manually.
- Apply Upwork filters manually:
  - fixed/hourly budget preference.
  - payment verified.
- Click `Capture Current Page`.
- Move to the next page manually if needed.
- Click `Capture Current Page` again.
- Verify second capture appends new rows to existing results.
- Verify rows appear in result page.
- Export `scraped-jobs-list.csv`.
- Confirm CSV shape matches schema.

## 10. Acceptance Criteria

- Extension installs in Chrome unpacked mode.
- Popup detects supported Upwork search page.
- Capture works for currently visible jobs only.
- Repeated capture appends new unique jobs and does not replace existing results.
- Manual pagination is supported by user navigation plus repeated `Capture Current Page`.
- `Reset All Data` removes all stored rows only after explicit confirmation.
- Popup can be closed without losing state.
- CSV export creates `scraped-jobs-list.csv`.
- CSV schema matches this plan.
- Default filters are applied locally.
- No auto-pagination, auto-refresh, random wait crawler, API interception, or auto-submit behavior exists.

## 11. References

- Upwork Chrome extension guidelines: https://support.upwork.com/hc/en-us/articles/17652357074451-Guidelines-for-using-Google-Chrome-extensions
- Upwork Terms of Service: https://support.upwork.com/hc/en-us/articles/17995731752851
- Upwork prohibited jobs/data mining note: https://support.upwork.com/hc/en-us/articles/17995622011667--What-kind-of-jobs-aren-t-allowed-on-Upwork
