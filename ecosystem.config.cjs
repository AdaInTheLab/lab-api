// ecosystem.config.cjs
// PM2 config for The Human Pattern Lab API

module.exports = {
    apps: [
        {
            name: "lab-api",

            // Run the built output in production
            script: "dist/index.js",

            // Where PM2 runs the process from (helps relative paths behave)
            cwd: "/home/humanpatternlab/lab-api",

            // Run one instance (SQLite prefers this unless you add WAL + coordination)
            instances: 1,
            exec_mode: "fork",

            // Restart behavior
            autorestart: true,
            watch: false,
            max_restarts: 10,
            min_uptime: "10s",

            // Logs (PM2 will create these if directories exist)
            output: "/home/humanpatternlab/lab-api/logs/out.log",
            error: "/home/humanpatternlab/lab-api/logs/err.log",
            merge_logs: true,
            time: true,

            env_production: {
                NODE_ENV: "production",
                PORT: 8001,
                // Auth-related envs (set real values on the server)
                ALLOWED_GITHUB_USERNAME: "AdaInTheLab"
            }
        }
    ]
};
