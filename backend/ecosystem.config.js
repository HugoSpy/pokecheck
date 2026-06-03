module.exports = {
  apps: [
    // ── Production ────────────────────────────────────────────────────────────
    {
      name: 'pokecheck',
      script: 'dist/index.js',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'coin-expiry',
      script: 'dist/jobs/coinExpiry.js',
      cron_restart: '0 0 * * *',
      autorestart: false,
      watch: false,
    },
    {
      name: 'market-expiry',
      script: 'dist/jobs/marketExpiry.js',
      cron_restart: '0 * * * *',
      autorestart: false,
      watch: false,
    },

    // ── Staging (dev branch — pokeschool_dev DB, port 3004) ───────────────────
    // cwd points to the git worktree at ~/pokecheck-dev/backend so that
    // `import 'dotenv/config'` in index.ts loads the staging .env (not prod's).
    {
      name: 'pokecheck-dev',
      script: 'dist/index.js',
      cwd: '/home/hugolerigolo/pokecheck-dev/backend',
      env: { NODE_ENV: 'staging' },
    },
    {
      name: 'coin-expiry-dev',
      script: 'dist/jobs/coinExpiry.js',
      cwd: '/home/hugolerigolo/pokecheck-dev/backend',
      cron_restart: '0 0 * * *',
      autorestart: false,
      watch: false,
    },
    {
      name: 'market-expiry-dev',
      script: 'dist/jobs/marketExpiry.js',
      cwd: '/home/hugolerigolo/pokecheck-dev/backend',
      cron_restart: '0 * * * *',
      autorestart: false,
      watch: false,
    },
  ],
};
