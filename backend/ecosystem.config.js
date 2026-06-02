module.exports = {
  apps: [
    {
      name: 'pokeschool',
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
  ],
};
