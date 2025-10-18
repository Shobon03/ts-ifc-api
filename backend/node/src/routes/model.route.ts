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

import type { MultipartFile, MultipartValue } from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { promises as fs } from 'fs';
import path, { basename, extname } from 'path';
import z from 'zod';
import {
  sendFileToArchicadPythonServiceWS,
  sendIfcToArchicadPythonServiceWS,
} from '../services/archicad.service';
import { sendFileToRevitPythonServiceWS } from '../services/revit.service';
import { convertRvtToIfcWS } from '../services/forge.service';
import { IfcValidator } from '../services/ifc.service';
import { BIMFileExportType } from '../types/formats';
import { MAX_FILE_SIZE } from '../utils/max-filesize';
import { wsManager } from '../ws/websocket';
import { pythonBridge } from '../ws/python-bridge';

const BASE_URL = '/models';
const TAGS = ['Models'];

/**
 * Validates a file for BIM-related operations.
 * Ensures the file is present, does not exceed the maximum size, and has a valid extension.
 */
const fileValidationBase = z
  .custom<MultipartFile>()
  .refine((file) => file?.file, 'The file is required')
  .refine(
    (file) => !file || file?.file.bytesRead <= MAX_FILE_SIZE,
    'File size should be less than 100MB',
  );

/**
 * Validates a BIM file.
 * Ensures the file has a valid extension (.rvt or .pln).
 */
const bimFileValidation = fileValidationBase.refine((file) => {
  if (!file?.filename) return false;
  const extension = file.filename.toLowerCase().split('.').pop();
  return ['rvt', 'pln'].includes(extension || '');
}, 'Invalid file type. Only .rvt and .pln files are allowed.');

/**
 * Validates a file for IFC validation.
 * Ensures the file is present, does not exceed the maximum size, and has a valid extension.
 */
const ifcValidationFileValidation = fileValidationBase.refine((file) => {
  if (!file?.filename) return false;
  const extension = file.filename.toLowerCase().split('.').pop();
  return ['ifc', 'json', 'xml', 'rvt', 'pln', 'step', 'stp'].includes(
    extension || '',
  );
}, 'Invalid file type. Only .ifc, .json, .xml, .rvt, .pln, and .step files are allowed.');

/**
 * Registers model-related routes on the Fastify instance.
 * @param instance Fastify instance to register the model routes.
 * @returns {Promise<void>} A promise that resolves when the routes are registered.
 */
export async function modelRoutes(instance: FastifyInstance): Promise<void> {
  const app = instance.withTypeProvider<ZodTypeProvider>();

  app.register(async (app) => {
  app.get(`${BASE_URL}/ws/conversion`, { websocket: true }, (socket, req) => {
      // Log incoming websocket upgrade headers to help debugging browser handshake issues
      try {
        const origin = (req.headers && (req.headers as any).origin) || 'no-origin';
        const host = req.headers?.host || 'no-host';
        const remote = (req.raw && req.raw.socket && (req.raw.socket as any).remoteAddress) || 'unknown-remote';
        console.log(`WebSocket upgrade request for /models/ws/conversion - origin=${origin} host=${host} remote=${remote} url=${req.url}`);
        console.log('WebSocket upgrade headers:', req.headers);
      } catch (err) {
        console.error('Failed to log websocket upgrade headers:', err);
      }

      // Extract jobId from query string
      const url = new URL(req.url, `http://${req.headers.host}`);
      const jobId = url.searchParams.get('jobId');

      // small helper to send safely and log failures without throwing
      const safeSend = (payload: any) => {
        const msg = typeof payload === 'string' ? payload : JSON.stringify(payload);
        try {
          if (socket && (socket as any).readyState === (socket as any).OPEN) {
            console.log(`[WebSocket SEND] ${new Date().toISOString()} -> ${msg.substring(0, 200)}`);
            socket.send(msg);
            return true;
          }
          console.warn('[WebSocket SEND] socket not open, readyState=', (socket as any).readyState);
          return false;
        } catch (err) {
          console.error('[WebSocket SEND] failed to send message', err, 'payload=', msg);
          try {
            // attempt graceful close if send fails
            socket.close(1011, 'Internal send error');
          } catch (_e) {
            // ignore
          }
          return false;
        }
      };

      // Setup message handler
      socket.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());

          if (data.type === 'ping') {
            socket.send(JSON.stringify({ type: 'pong' }));
          } else if (data.type === 'subscribe') {
            const subscribeJobId = data.jobId || jobId;

            if (!subscribeJobId) {
              safeSend({ type: 'error', message: 'Job ID is required for subscription' });
              return;
            }

            wsManager.subscribeToJob(subscribeJobId, socket);

            safeSend({ type: 'subscribed', jobId: subscribeJobId, message: 'Successfully subscribed to job updates' });
          }
        } catch (error) {
          safeSend({ type: 'error', message: 'Invalid message format' });
        }
      });

      // Log socket lifecycle events to debug browser disconnects
      socket.on('close', (code: number, reason: Buffer) => {
        try {
          const reasonStr = reason ? reason.toString() : '<no-reason>';
          console.log(`WebSocket /models/ws/conversion closed - code=${code} reason=${reasonStr}`);
        } catch (err) {
          console.log('WebSocket closed - unable to stringify reason', err);
        }
      });

      socket.on('error', (err: Error) => {
        console.error('WebSocket /models/ws/conversion error:', err);
      });

      // Send connection acknowledgment
      try {
        const ack = JSON.stringify({
          type: 'connection_ack',
          message: 'WebSocket connection established',
          timestamp: new Date().toISOString(),
        });
        console.log('Sending connection_ack to websocket client');
        safeSend(ack);
        console.log('connection_ack send attempted');
      } catch (err) {
        console.error('Failed to send connection_ack to websocket client:', err);
      }

      // Auto-subscribe to job if jobId provided
      if (jobId) {
        wsManager.subscribeToJob(jobId, socket);
        safeSend({ type: 'auto-subscribed', jobId, message: 'Automatically subscribed to job updates' });
      }

      // Register client for plugin status updates (after initial setup)
      console.log('[WebSocket] registering client for plugin status updates');
      pythonBridge.registerClientConnection(socket);
      console.log('[WebSocket] client registered for plugin status updates');
    });
  });

  app.route({
    method: 'post',
    url: `${BASE_URL}/generate-ifc`,
    schema: {
      consumes: ['multipart/form-data'],
      description:
        'Endpoint to generate a IFC model from a file of Revit or ArchiCAD',
      tags: TAGS,
      body: z.object({
        file: bimFileValidation,
        type: z.preprocess(
          (file) => (file as MultipartValue)?.value,
          z.enum(BIMFileExportType).optional().default(BIMFileExportType.IFC),
        ),
        socketId: z.preprocess(
          (file) => (file as MultipartValue)?.value,
          z.string().optional(),
        ),
      }),
      response: {
        200: z.object({
          jobId: z.string(),
          message: z.string(),
          websocketUrl: z.string(),
        }),
        400: z.object({
          error: z.string(),
        }),
      },
    },
    handler: async (request, reply) => {
      const { file } = request.body;

      try {
        const fileType = file.filename?.toLowerCase().split('.').pop();
        const buffer = await file.toBuffer();
        if (fileType === 'rvt') {
          const fileName = file.filename || 'model.rvt';
          const jobId = wsManager.createJobWithoutSocket(fileName);

          convertRvtToIfcWS(buffer, fileName, jobId).catch((error) => {
            console.error(`Conversion failed for job ${jobId}:`, error);
            wsManager.handleJobError(jobId, (error as Error).message);
          });

          return reply.status(200).send({
            jobId,
            message: 'Conversion job started',
            websocketUrl: `/models/ws/conversion`,
          });
        }

        if (fileType === 'pln') {
          const fileName = file.filename || 'model.pln';
          const jobId = wsManager.createJobWithoutSocket(fileName);

          sendFileToArchicadPythonServiceWS(buffer, fileName, jobId).catch(
            (error) => {
              console.error(`Conversion failed for job ${jobId}:`, error);
              wsManager.handleJobError(jobId, (error as Error).message);
            },
          );

          return reply.status(200).send({
            jobId,
            message: 'Conversion job started',
            websocketUrl: `/models/ws/conversion`,
          });
        }
      } catch (error) {
        app.log.error('Error when processing model generation:', error);
        return reply.status(400).send({
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
  });

  app.route({
    method: 'post',
    url: `${BASE_URL}/convert-from-ifc`,
    schema: {
      description: 'Convert IFC file to Revit (RVT) or Archicad (PLN) format',
      tags: TAGS,
      body: z.object({
        filePath: z.string().min(1, 'File path is required'),
        resultType: z.enum(['rvt', 'pln']).describe('Target format: rvt (Revit) or pln (Archicad)'),
      }),
      response: {
        200: z.object({
          message: z.string(),
          jobId: z.string(),
          websocketUrl: z.string(),
        }),
        400: z.object({
          error: z.string(),
        }),
        500: z.object({
          error: z.string(),
        }),
      },
    },
    handler: async (request, reply) => {
      const { filePath, resultType } = request.body;

      try {
        // Convert URL path to filesystem path
        // Example: /download/conversion/job-xxx/file.ifc -> backend/node/public/conversion/job-xxx/file.ifc
        let actualFilePath = filePath;

        if (filePath.startsWith('/download/conversion/')) {
          // Remove the /download/conversion/ prefix and construct the actual path
          const relativePath = filePath.replace('/download/conversion/', '');
          actualFilePath = path.join(process.cwd(), 'public', 'conversion', relativePath);
        }

        // Validate file path exists and is an IFC file
        try {
          await fs.access(actualFilePath);
        } catch {
          return reply.status(400).send({
            error: `File not found: ${actualFilePath}`,
          });
        }

        const ext = extname(actualFilePath).toLowerCase();
        if (ext !== '.ifc') {
          return reply.status(400).send({
            error: 'Only IFC files can be converted. File must have .ifc extension',
          });
        }

        // Generate job ID
        const jobId = wsManager.createJobWithoutSocket(basename(actualFilePath));

        // Route to appropriate conversion service based on target format
        if (resultType === 'rvt') {
          // Send to Revit plugin via Python (IFC to RVT)
          sendFileToRevitPythonServiceWS(actualFilePath, basename(actualFilePath), jobId).catch(
            (error) => {
              console.error(`Revit conversion failed for job ${jobId}:`, error);
              wsManager.handleJobError(jobId, (error as Error).message);
            },
          );

          return reply.status(200).send({
            message: 'IFC to RVT conversion started',
            jobId,
            websocketUrl: `/models/ws/conversion`,
          });
        } else if (resultType === 'pln') {
          // Send to Archicad plugin via Python (IFC to PLN)
          sendIfcToArchicadPythonServiceWS(actualFilePath, basename(actualFilePath), jobId).catch(
            (error) => {
              console.error(`Archicad conversion failed for job ${jobId}:`, error);
              wsManager.handleJobError(jobId, (error as Error).message);
            },
          );

          return reply.status(200).send({
            message: 'IFC to PLN conversion started',
            jobId,
            websocketUrl: `/models/ws/conversion`,
          });
        }

        return reply.status(400).send({
          error: 'Invalid result type',
        });
      } catch (error) {
        console.error('Error in convert endpoint:', error);
        return reply.status(500).send({
          error: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    },
  });

  app.route({
    method: 'post',
    url: `${BASE_URL}/validate`,
    schema: {
      consumes: ['multipart/form-data'],
      description: 'Endpoint to validate a model file',
      tags: TAGS,
      body: z.object({
        file: ifcValidationFileValidation,
      }),
      response: {
        200: z.object({
          valid: z.boolean(),
          message: z.string(),
        }),
        400: z.object({
          valid: z.boolean(),
          message: z.string(),
          error: z.any().optional(),
        }),
      },
    },
    handler: async (request, reply) => {
      const { file } = request.body;

      try {
        const buffer = await file.toBuffer();
        const fileContent = buffer.toString('utf-8');

        const validator = new IfcValidator(fileContent);
        const result = await validator.validate();

        const validationText = !result.isValid ? 'invalid' : 'valid';

        return reply.status(result.isValid ? 200 : 400).send({
          valid: result.isValid,
          message: `Model is ${validationText}`,
          error: result.isValid ? undefined : result.errors,
        });
      } catch (error) {
        return reply.status(400).send({
          valid: false,
          message: 'Error validating model',
          error: (error as Error).message,
        });
      }
    },
  });
}
