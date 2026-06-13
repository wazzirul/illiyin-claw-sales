# Step 8.2 — Cron Scheduler

## Goal
Run the worker on cron without overlapping runs.

## File
- `src/scheduler/index.js`

## Functions
```js
export function runSafely(worker, logger)
export function startScheduler({ config, worker, logger })
```

## runSafely
Return an async function with `isRunning` closure.
- If running, log warn and skip.
- Else set running true, await worker, finally set false.

## startScheduler
- Use `node-cron`.
- Schedule `config.upworkRssPollCron`.
- timezone: `config.timezone`.
- Log when scheduler starts with cron value.
- Return cron task.

## Verification
Import and call `runSafely` with a fake worker in a small test or manual script.
