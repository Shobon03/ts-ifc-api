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

import { configDotenv } from 'dotenv';

/**
 * Validates required environment variables
 * @param env Object containing environment variables
 * @throws {Error} If required variables are missing or invalid
 */
function validateEnvironmentVariables(env: Record<string, string | undefined>) {
  const errors: string[] = [];

  // Validate HOST
  if (env.HOST && !/^[a-zA-Z0-9.-]+$/.test(env.HOST)) {
    errors.push('HOST must be a valid hostname or IP address');
  }

  // Validate PORT
  if (env.PORT) {
    const port = Number.parseInt(env.PORT, 10);
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      errors.push('PORT must be a valid port number (1-65535)');
    }
  }

  // Validate Autodesk credentials (optional but warn if missing)
  if (!env.AUTODESK_CLIENT_ID || !env.AUTODESK_CLIENT_SECRET) {
    console.warn(
      'Warning: AUTODESK_CLIENT_ID and AUTODESK_CLIENT_SECRET are not set. Forge API features will be disabled.',
    );
  } else {
    // Basic validation for Autodesk credentials format
    if (env.AUTODESK_CLIENT_ID.length < 10) {
      errors.push('AUTODESK_CLIENT_ID appears to be invalid (too short)');
    }
    if (env.AUTODESK_CLIENT_SECRET.length < 10) {
      errors.push('AUTODESK_CLIENT_SECRET appears to be invalid (too short)');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n- ${errors.join('\n- ')}`);
  }
}

/**
 * Interface for environment variables
 * This interface defines the expected structure of the environment variables.
 */
interface EnvVariables {
  HOST?: string;
  PORT?: string;
  AUTODESK_CLIENT_ID?: string;
  AUTODESK_CLIENT_SECRET?: string;
  [key: string]: string | undefined; // Allow additional variables
}

/**
 * Loads environment variables from a .env file.
 * If the .env file is not found, it will throw an error.
 * This function should be called at the start of the application.
 */
export function loadEnv(): EnvVariables {
  try {
    const result = configDotenv();
    if (result.error) {
      throw result.error;
    }

    validateEnvironmentVariables(process.env);

    console.log('Environment variables loaded successfully.');

    return process.env;
  } catch (error) {
    console.error('Error loading environment variables:', error);
    throw error;
  }
}

/**
 * Exports the environment variables for use in the application.
 * This should be used to access environment variables throughout the application.
 */
export const env: EnvVariables = loadEnv();
