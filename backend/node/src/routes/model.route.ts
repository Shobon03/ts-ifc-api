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
import z from 'zod';
import { sendFileToArchicadPythonServiceWS } from '../services/archicad.service';
import { convertRvtToIfcWS } from '../services/forge.service';
import { IfcValidator } from '../services/ifc.service';
import { BIMFileExportType } from '../types/formats';
import { MAX_FILE_SIZE } from '../utils/max-filesize';
import { wsManager } from '../ws/websocket';

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
      // Extract jobId from query string
      const url = new URL(req.url, `http://${req.headers.host}`);
      const jobId = url.searchParams.get('jobId');

      socket.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());

          if (data.type === 'ping') {
            socket.send(JSON.stringify({ type: 'pong' }));
          } else if (data.type === 'subscribe') {
            const subscribeJobId = data.jobId || jobId;

            if (!subscribeJobId) {
              socket.send(
                JSON.stringify({
                  type: 'error',
                  message: 'Job ID is required for subscription',
                }),
              );
              return;
            }

            wsManager.subscribeToJob(subscribeJobId, socket);

            socket.send(
              JSON.stringify({
                type: 'subscribed',
                jobId: subscribeJobId,
                message: 'Successfully subscribed to job updates',
              }),
            );
          }
        } catch (error) {
          socket.send(
            JSON.stringify({
              type: 'error',
              message: 'Invalid message format',
            }),
          );
        }
      });

      if (jobId) {
        wsManager.subscribeToJob(jobId, socket);
        socket.send(
          JSON.stringify({
            type: 'auto-subscribed',
            jobId,
            message: 'Automatically subscribed to job updates',
          }),
        );
      }

      socket.send(
        JSON.stringify({
          type: 'connected',
          message: 'WebSocket connection established',
        }),
      );
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
          (file) => (file as MultipartValue).value,
          z.enum(BIMFileExportType).optional().default(BIMFileExportType.IFC),
        ),
        socketId: z.preprocess(
          (file) => (file as MultipartValue).value,
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
      const { file, type } = request.body;

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
        return reply.status(400).send({ error: error.message });
      }
    },
  });

  app.route({
    method: 'post',
    url: `${BASE_URL}/convert`,
    schema: {
      consumes: ['multipart/form-data'],
      description: 'Endpoint to convert a model file to another format',
      tags: TAGS,
      body: z.object({
        file: bimFileValidation,
      }),
      response: {
        200: z.object({ message: z.string() }),
      },
    },
    handler: async (request, reply) => {
      const { file } = request.body;

      // TODO...

      return reply.status(200).send({ message: 'Model conversion endpoint' });
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
