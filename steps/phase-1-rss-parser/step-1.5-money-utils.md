# Step 1.5 — Money Utilities

## Goal
Parse USD fixed budgets and hourly ranges.

## File
- `src/utils/money.js`
- `tests/money.test.js`

## Functions
```js
export function parseUsdAmount(text)
export function parseFixedBudget(text)
export function parseHourlyRange(text)
export function formatBudgetText(job)
```

## Must handle
- `1,500 USD` => 1500
- `$1,500` => 1500
- `500 USD` => 500
- `Hourly: $15.00-$30.00/hr` => `{ min: 15, max: 30 }`
- `$15/hr` => `{ min: 15, max: null }`
- `15 USD/hour` => `{ min: 15, max: null }`

## Verification
`npm test`
