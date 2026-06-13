# Step 3.2 — CSV Loader

## Goal
Load portfolio and upwork-work-done CSV files into arrays.

## File
- `src/portfolio/loadPortfolioCsv.js`
- `tests/loadPortfolioCsv.test.js`

## Functions
```js
export async function loadPortfolioCsv(path)
export async function loadUpworkWorkDoneCsv(path)
export async function loadPortfolioData(config)
```

`loadPortfolioData(config)` calls both loaders and returns:
```js
{ portfolioItems: [], upworkWorkItems: [] }
```

## Requirements
- Use `csv-parse` with header: true.
- Split semicolon fields (`skills`, `tools`, `team_role`) into string arrays.
- If file does not exist, log warning and return empty array. Do NOT throw.
- Validate required columns: `id`, `title`, `service_category`, `skills`. Log warning if missing.

## Tests
Use `tests/fixtures/portfolio.sample.csv` and `tests/fixtures/upwork-work-done.sample.csv`.
- Load and parse sample.
- Missing file returns [].
- Semicolon fields parsed to arrays.
