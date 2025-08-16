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

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../app';

describe('Health Route', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await initApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('should return 200 status with health check data', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should return correct response structure', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('timestamp');
      expect(body.status).toBe('ok');
      expect(typeof body.timestamp).toBe('string');
    });

    it('should return valid ISO timestamp', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const body = JSON.parse(response.body);
      const timestamp = new Date(body.timestamp);

      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.toISOString()).toBe(body.timestamp);
    });

    it('should return recent timestamp', async () => {
      const beforeRequest = new Date();

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const afterRequest = new Date();
      const body = JSON.parse(response.body);
      const responseTimestamp = new Date(body.timestamp);

      expect(responseTimestamp.getTime()).toBeGreaterThanOrEqual(
        beforeRequest.getTime(),
      );
      expect(responseTimestamp.getTime()).toBeLessThanOrEqual(
        afterRequest.getTime(),
      );
    });

    it('should handle multiple concurrent requests', async () => {
      const requests = Array.from({ length: 5 }, () =>
        app.inject({
          method: 'GET',
          url: '/health',
        }),
      );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.status).toBe('ok');
        expect(body).toHaveProperty('timestamp');
      });
    });
  });

  describe('Health Route - Error Cases', () => {
    it('should return 404 for invalid health endpoints', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/invalid',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 for POST requests to health endpoint', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/health',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 for PUT requests to health endpoint', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/health',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 for DELETE requests to health endpoint', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/health',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Health Route - Performance', () => {
    it('should respond quickly', async () => {
      const startTime = Date.now();

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.statusCode).toBe(200);
      expect(responseTime).toBeLessThan(100); // Should respond in less than 100ms
    });

    it('should maintain consistent response times', async () => {
      const responseTimes: number[] = [];

      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();

        const response = await app.inject({
          method: 'GET',
          url: '/health',
        });

        const endTime = Date.now();
        responseTimes.push(endTime - startTime);

        expect(response.statusCode).toBe(200);
      }

      const avgResponseTime =
        responseTimes.reduce((sum, time) => sum + time, 0) /
        responseTimes.length;
      expect(avgResponseTime).toBeLessThan(50); // Average should be less than 50ms
    });
  });
});
