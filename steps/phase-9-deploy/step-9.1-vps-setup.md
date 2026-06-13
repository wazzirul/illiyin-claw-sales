# Step 9.1 — VPS Setup

## Goal
Prepare Ubuntu VPS with Node.js and PM2.

## Server requirements
- Ubuntu 22.04 or 24.04
- 1 vCPU minimum
- 1GB RAM minimum
- Node.js 20 or 22

## Commands
```bash
sudo apt update
sudo apt install -y git curl build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
node -v
npm -v
pm2 -v
```

## Expected
- Node version 22.x (or 20+)
- PM2 installed
