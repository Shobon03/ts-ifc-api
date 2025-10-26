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
 * Application configuration
 * Uses environment variables when available, with sensible defaults
 */
export const config = {
  /**
   * Backend API base URL
   * Default: http://localhost:3000 (development)
   */
  backendUrl: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000',

  /**
   * WebSocket URL for real-time updates
   * Default: ws://localhost:3000/models/ws/conversion
   */
  wsUrl:
    import.meta.env.VITE_WS_URL || 'ws://localhost:3000/models/ws/conversion',
} as const;
