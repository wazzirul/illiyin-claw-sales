Testing AI Automation untuk Illiyin. Setup multiple AI agent, yang bisa jalan 24 jam pakai VPS (Bisa pakai Openclaw, dll)

Studi kasus, divisi Sales. Workflow : Upwork bidding.

1. **Step 1 :** Crawl/Scrap data Job upwork terbaru dan filter berdasarkan kriteria kita tiap

Crawl / Scrape data job upwork from >> https://www.vollna.com/rss/mP3LGsgh5PdMu5UDj7Cm << rekomendasi perlu scrap tiap berapa detik / menit ?

general requirement untuk job:

- Fixed : Min. $500
- Hourly : Min. $15
- Payment Method : Verified

2. **Step 2 :** Craft cover letter dan pilih portfolio yang sesuai
   notes : untuk portofolio buatkan contoh csv list nanti saya akan minta project manager / sales saya mengisi semua portofolio dan contoh project / work yang pernah kita kerjakan di upwork (portofilio.csv, upwork-work-done.csv)

3. **Step 3 :** kirim ke notion database untuk semua data job upwork tersebut, dari title, budget, link, date, cover letter, etc dan remind ke telegram bot ada 1 job baru yang discrape - craft - sesuai dengan requirement kita

4. **Step 4 :** fungsi telegram bot ketika pm / sales ngetik /bid url_link maka update status_bid notion database tadi jadi bidded

5. **Step 5 :** fungsi telegram bot ketika pm / sales ngetik /bid-success url_link maka update status_bid notion database tadi success
