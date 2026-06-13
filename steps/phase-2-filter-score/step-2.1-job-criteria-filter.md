# Step 2.1 — Job Criteria Filter

## Goal
Filter parsed job objects against minimum requirements.

## File
- `src/filters/jobCriteria.js`
- `tests/jobCriteria.test.js`

## Function
```js
export function evaluateJobCriteria(job, config)
```

## Return shape
```js
{ accepted: bool, status: string, reasons: [], warnings: [] }
```

## Filter status values
- `qualified`
- `rejected_budget` — fixed < 500 or hourly min < 15
- `rejected_payment` — payment explicitly unverified
- `rejected_keyword` — contains blocked keyword
- `parse_error` — could not determine jobType

## Rules
1. If `jobType === 'fixed'` and `fixedBudgetUsd < config.fixedMinBudgetUsd` => rejected_budget.
2. If `jobType === 'hourly'` and `hourlyMinUsd < config.hourlyMinRateUsd` => rejected_budget.
3. If `paymentVerified === 'unverified'` => rejected_payment.
4. If `paymentVerified === 'unknown'` and `config.allowUnknownPayment === false` => rejected_payment.
5. If `paymentVerified === 'unknown'` and `config.allowUnknownPayment === true` => add warning.
6. If any blocked keyword found in title or description (case insensitive) => rejected_keyword.

## Tests
- Fixed 499 rejected_budget.
- Fixed 500 qualified.
- Hourly 14 rejected_budget.
- Hourly 15 qualified.
- Payment unverified rejected.
- Payment unknown accepted with warning when allowUnknownPayment=true.
- Payment unknown rejected when allowUnknownPayment=false.
- Blocked keyword "casino" rejected.
