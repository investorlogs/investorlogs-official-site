// PM2 process definition for the InvestorLogs production server.
//
// Usage:
//   pm2 start ecosystem.config.cjs     # start (or reload) the site
//   pm2 logs investorlogs              # tail logs
//   pm2 restart investorlogs           # restart after a code change
//   pm2 stop investorlogs              # stop
//
// After `pm2 start`, run `pm2 save` so the process list survives a reboot.
//
// This runs the production server (`next start`), so run `npm run build`
// first (or `npm run build && pm2 restart investorlogs`) whenever the code
// changes. `npm run dev` should NOT be used here — it is a developer server
// with hot reloading and is not meant to stay running.
module.exports = {
  apps: [
    {
      name: "investorlogs",
      // Invoke Next directly through node. Using `npm run start` would add an
      // extra shell layer that PM2 cannot reliably restart or signal.
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      // Restart automatically if the process ever exits unexpectedly.
      autorestart: true,
      // Treat a crash-loop (10 restarts in 10s) as fatal instead of spinning.
      max_restarts: 10,
      min_uptime: "10s",
      // Restart if the process leaks past 1GB of memory.
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // Keep logs bounded so they cannot fill the disk over time.
      error_file: "logs/pm2-error.log",
      out_file: "logs/pm2-out.log",
      merge_logs: true,
      time: true,
    },
  ],
}
