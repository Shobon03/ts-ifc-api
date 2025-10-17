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

import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import fastifySwagger from '@fastify/swagger';
import fastifyWebsocket from '@fastify/websocket';
import scalarFastifyApiReference from '@scalar/fastify-api-reference';
import fastify, { type FastifyInstance } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { join } from 'path';
import { healthRoute } from './routes/health.route';
import { modelRoutes } from './routes/model.route';
import { MAX_FILE_SIZE } from './utils/max-filesize';
import { pythonBridge } from './ws/python-bridge';
import { revitPlugin } from './ws/revit-plugin';
import { archicadPlugin } from './ws/archicad-plugin';
import { wsManager } from './ws/websocket';

/**
 * Initializes and configures the Fastify application.
 * @returns {Promise<FastifyInstance>} The configured Fastify application instance.
 */
export async function initApp(): Promise<FastifyInstance> {
  // Fastify app linitialization
  const app = fastify({
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

  // Allow all origins during local development to avoid CORS-related issues
  // NOTE: This should be restricted in production environments
  await app.register(fastifyCors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Register WebSocket support before other plugins
  await app.register(fastifyWebsocket);

  // Multipart files, will upload .rvt or .arc files, so it needs to be able to handle large files
  // Max file size is set to 100 MB
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: MAX_FILE_SIZE, // 100 MB
    },
    attachFieldsToBody: true, // Attach file fields to the request body
  });

  // Serve static files from public/conversion directory
  await app.register(fastifyStatic, {
    root: join(__dirname, '..', 'public', 'conversion'),
    prefix: '/download/conversion/',
    decorateReply: false,
  });

  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Model Generation API',
        description: 'API for generating models from files',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Local development server',
        },
      ],
    },
    transform: jsonSchemaTransform,
  });

  await app.register(scalarFastifyApiReference, {
    routePrefix: '/docs',
    configuration: {
      theme: 'kepler',
    },
  });

  // Register error handler
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    reply.status(500).send({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred. Please try again later.',
    });
  });

  // Register WebSocket endpoints
  app.register(async (app) => {
    // Client-facing WebSocket for job progress tracking
    app.get(
      '/ws/jobs/:jobId',
      {
        websocket: true,
      },
      (socket, req) => {
        const jobId = (req.params as { jobId: string }).jobId;

        if (!jobId) {
          socket.close(1008, 'Missing job ID');
          return;
        }

        console.log(`Client subscribed to job ${jobId}`);
        wsManager.subscribeToJob(jobId, socket);

        socket.on('message', (message) => {
          try {
            const data = JSON.parse(message.toString());

            if (data.type === 'ping') {
              socket.send(JSON.stringify({ type: 'pong' }));
            }
          } catch (error) {
            console.error('Error parsing client message:', error);
          }
        });
      },
    );

    // Python service WebSocket bridge
    app.get(
      '/ws/python-bridge',
      {
        websocket: true,
      },
      (socket, _req) => {
        pythonBridge.registerPythonConnection(socket);
      },
    );

    // Revit plugin WebSocket connection
    app.get(
      '/ws/revit-plugin',
      {
        websocket: true,
      },
      (socket, _req) => {
        revitPlugin.registerRevitConnection(socket);
      },
    );

    // Archicad plugin WebSocket connection
    app.get(
      '/ws/archicad-plugin',
      {
        websocket: true,
      },
      (socket, _req) => {
        archicadPlugin.registerArchicadConnection(socket);
      },
    );

    // Legacy test endpoint
    app.get(
      '/ws',
      {
        websocket: true,
      },
      (socket, _req) => {
        socket.on('message', (message) => {
          socket.send(`Hello from server! You sent: ${message}`);
        });
      },
    );
  });

  // Register routes
  await app.register(healthRoute);
  await app.register(modelRoutes);

  return app;
}
