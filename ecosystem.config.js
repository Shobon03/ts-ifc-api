/*
 * Copyright (C) 2025 Matheus Piovezan Teixeira
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * PM2 Configuration for ts-ifc-api
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 stop all
 *   pm2 restart all
 *   pm2 logs
 *   pm2 monit
 */

module.exports = {
  apps: [
    // Node.js Backend
    {
      name: "ts-ifc-api-node",
      script: "./backend/node/dist/server.js",
      cwd: "./backend/node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "./logs/node-error.log",
      out_file: "./logs/node-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },

    // Python Backend
    {
      name: "ts-ifc-api-python",
      script: "./backend/python/venv/Scripts/python.exe", // Windows
      // script: './backend/python/venv/bin/python', // Linux/Mac
      args: "src/server.py",
      cwd: "./backend/python",
      interpreter: "none",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        FLASK_ENV: "production",
        FLASK_PORT: 5000,
        FLASK_DEBUG: "False",
      },
      error_file: "./logs/python-error.log",
      out_file: "./logs/python-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
