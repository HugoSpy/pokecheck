module.exports = {
  apps: [
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
  ],
};
