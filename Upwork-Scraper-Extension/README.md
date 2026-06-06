# Upwork Job Review Assistant

A Chrome extension designed to help PM/Sales teams manually review Upwork jobs, apply default business filters, and export candidate jobs to CSV for AI scoring or proposal drafting.

## ⚠️ Compliance & Safety Guardrails

This extension is built with strict adherence to Upwork's Terms of Service and Chrome Web Store guidelines:

- **Manual Operation Only**: It only captures jobs from pages you have manually opened and scrolled to.
- **No Automation**: It does NOT auto-refresh, auto-paginate, auto-apply filters, or run background crawlers.
- **No API Interception**: It only reads the visible DOM of the current page. It does not call or intercept private Upwork APIs.
- **No Auto-Submission**: It does NOT auto-login, auto-bid, or auto-submit proposals.
- **Local Storage Only**: All captured data is stored locally in your browser (`chrome.storage.local`) and exported as a CSV file. No data is sent to external servers.

## Installation (Unpacked Mode)

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top right corner).
3. Click **Load unpacked**.
4. Select the `Upwork-Scraper-Extension` folder.
5. The extension icon will appear in your Chrome toolbar.

## Usage Flow

1. **Navigate**: Manually open an Upwork job search page (e.g., `https://www.upwork.com/nx/search/jobs/`).
2. **Filter**: Apply your desired filters directly on the Upwork website.
3. **Capture**: Click the extension icon and hit **Capture Current Page**. The extension will read the visible job cards.
4. **Review**: Click **Open Results** to view the captured jobs, apply local filters, and review risk flags.
5. **Export**: Click **Export CSV** to download `scraped-jobs-list.csv` for your AI scoring or internal review workflow.
6. **Append**: You can manually navigate to the next page on Upwork and click **Capture Current Page** again. New unique jobs will be appended to your local list without duplicates.

## Default Business Filters

The extension applies the following local filters upon capture (configurable in the popup):
- **Fixed Price**: Minimum USD 500 (Flags as `low_budget` if below).
- **Hourly**: Minimum USD 15/hour (Flags as `low_budget` if below).
- **Payment Method**: Flags as `payment_unverified` if the client's payment is not verified.

Jobs failing these checks are automatically tagged with `recommended_action: reject` or `review`.

## File Structure

```
Upwork-Scraper-Extension/
├── manifest.json          # Extension configuration (Manifest V3)
├── popup.html             # Extension popup UI
├── popup.css              # Popup styles
├── popup.js               # Popup logic and messaging
├── background.js          # Service worker for storage, filtering, and CSV generation
├── content.js             # DOM parser for visible job cards
├── result.html            # Local results viewer page
├── result.css             # Results page styles
├── result.js              # Results page logic (filtering, deletion, copy JSON)
├── fixtures/              # DOM snapshots for testing
│   └── upwork-search-result.html
├── plan.md                # Detailed implementation plan
└── README.md              # This file
```

## Troubleshooting

- **"Unsupported Page"**: Ensure you are on `https://www.upwork.com/nx/search/jobs/*`. The extension will not activate on other pages.
- **No Jobs Captured**: Ensure job cards are fully loaded in the DOM. The extension does not auto-scroll to trigger lazy loading.
- **Missing Fields**: Upwork's DOM structure may change. The parser uses fallback selectors and will default to `unknown` rather than crashing.

## References

- [Upwork Guidelines for using Google Chrome extensions](https://support.upwork.com/hc/en-us/articles/17652357074451-Guidelines-for-using-Google-Chrome-extensions)
- [Upwork Terms of Service](https://support.upwork.com/hc/en-us/articles/17995731752851)
