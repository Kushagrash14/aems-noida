// PM2 process file:  pm2 start aws/ecosystem.config.cjs
// Runs a single Next.js instance on localhost:3000 behind Nginx.
// Keep instances at 1: session validation cache and rate limits are per-process.
const path = require('path');

module.exports = {
  apps: [
    {
      name: 'aems',
      cwd: path.resolve(__dirname, '..'),
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000 -H 127.0.0.1',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
