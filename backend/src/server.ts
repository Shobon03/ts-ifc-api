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

// This file is the entry point for the backend server.
// It initializes the application, loads environment variables, and starts the server.

import type { FastifyInstance } from 'fastify';
import { initApp } from './app';
import { env } from './utils/load-env';

/**
 * The Fastify instance for the application.
 * This is initialized in the main function and used to start the server.
 * It is set to null initially to allow for graceful shutdown handling.
 */
let app: FastifyInstance | null = null;

/**
 * Main function to initialize the application and start the server.
 * It sets up the Fastify instance, configures the server, and starts listening on the specified host and port.
 * If an error occurs during startup, it logs the error and exits the process with a non-zero exit code.
 * It also handles graceful shutdown on SIGINT and SIGTERM signals.
 * @returns {Promise<void>} A promise that resolves when the server is successfully started.
 * @throws {Error} If there is an error during server initialization or startup.
 * @example
 * main().catch((err) => {
 *   console.error('Error starting server:', err);
 *   process.exit(1);
 * });
 */
async function main(): Promise<void> {
  app = await initApp();

  try {
    const host = env.HOST || 'localhost';
    const port = Number(env.PORT) || 3000;

    await app.listen({
      port,
      host,
    });

    app.log.info(`Server is running at http://localhost:3000`);
    app.log.info(`API documentation available at http://localhost:3000/docs`);
  } catch (err) {
    console.error(err);
    handleGracefulShutdown(1);
  }
}

async function handleGracefulShutdown(
  exitCode: number | string | null | undefined,
) {
  if (app) {
    app.log.info('Shutting down server gracefully...');
    try {
      await app.close();
      app.log.info('Server shut down successfully.');
    } catch (err) {
      console.error('Error during server shutdown:', err);
    }
  }

  app = null;
  console.log('Server reference cleared.');

  process.exit(Number(exitCode ?? 0));
}

process.on('SIGINT', handleGracefulShutdown);
process.on('SIGTERM', handleGracefulShutdown);

main();
