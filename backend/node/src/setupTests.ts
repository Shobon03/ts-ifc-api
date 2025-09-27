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

import { afterEach, beforeEach, vi } from 'vitest';

// Mock console methods to reduce noise in test output
beforeEach(() => {
  // Mock console.log to reduce noise in test output
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});

  // Keep console.error for important error messages in tests
  // vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  // Restore all mocks after each test
  vi.restoreAllMocks();

  // Clear any timers that might be running
  vi.clearAllTimers();
});
