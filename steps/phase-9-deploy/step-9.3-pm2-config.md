# Step 9.3 — PM2 Config

## Goal
Run the app 24/7 with PM2.

## File
- `ecosystem.config.cjs`

## Content
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

If deployed under a different path, update `cwd`.

## Commands
```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
pm2 logs illiyin-upwork-sales-worker
```

## Verification
- PM2 status is `online`.
- Logs show scheduler started.
- After cron interval, logs show worker started/finished.
