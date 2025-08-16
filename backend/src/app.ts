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

import fastifyCors from "@fastify/cors";
import fastifyMultipart from "@fastify/multipart";
import fastifyRateLimit from "@fastify/rate-limit";
import fastify, { FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

/**
 * Initializes and configures the Fastify application.
 * @returns {Promise<FastifyInstance>} The configured Fastify application instance.
 */
export async function initApp(): Promise<FastifyInstance> {
  // Fastify app linitialization
  const app =  fastify({
    logger: true,
  });

  // Register Zod validation plugin
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Register plugins
  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  await app.register(fastifyCors, {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], // Allowed HTTP methods
  });

  // Multipart files, will upload .rvt or .arc files, so it needs to be able to handle large files
  // Max file size is set to 100 MB
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100 MB
    },
  });

  return app;
}