# Step 2.2 — Score Job

## Goal
Assign 0-100 score and priority label after qualification and AI draft.

## File
- `src/filters/scoreJob.js`
- `tests/scoreJob.test.js`

## Function
```js
export function scoreJob(job, matches, aiDraft)
```

## Return shape
```js
{ score: number, priority: 'high'|'medium'|'low', scoreBreakdown: {} }
```

## Score factors
| Factor                     | Max |
|----------------------------|-----|
| Budget/rate high           | 20  |
| Portfolio skill match      | 25  |
| Category match             | 15  |
| Description quality/length | 15  |
| Client seriousness signals | 10  |
| Long-term / urgency        | 10  |
| Low red flags              | 5   |

## Priority
- score >= 80 => high
- score >= 60 => medium
- else => low

## Budget scoring hints
- Fixed >= 5000 USD or hourly >= 50 = 20 pts
- Fixed >= 2000 or hourly >= 30 = 15 pts
- Fixed >= 1000 or hourly >= 20 = 10 pts
- Else 5 pts if job passes min filter

## Portfolio match scoring hints
- Each matched portfolio/work contributes.
- Use `matches.portfolio.length` and `matches.upworkWork.length`.

## Tests
- High budget + many matches => high priority.
- Low budget + no matches => low.
