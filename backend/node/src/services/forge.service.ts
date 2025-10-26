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

import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { AuthenticationClient, Scopes } from '@aps_sdk/authentication';
import {
  type JobPayload,
  type Manifest,
  ModelDerivativeClient,
} from '@aps_sdk/model-derivative';
import { OssClient, Region as OssRegion } from '@aps_sdk/oss';
import axios from 'axios';
import { BIMFileExportType } from '../types/formats';
import { env } from '../utils/load-env';
import { ConversionStatus, wsManager } from '../ws/websocket';

const authenticationClient = new AuthenticationClient();
const ossClient = new OssClient();
const modelDerivativeClient = new ModelDerivativeClient();

const CONVERTED_MODELS_DIR = path.join(process.cwd(), 'public', 'conversion');

function toBase64Url(value: string): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function ensureConvertedDirectoryExists(): void {
  if (!existsSync(CONVERTED_MODELS_DIR)) {
    mkdirSync(CONVERTED_MODELS_DIR, { recursive: true });
  }
}

function buildDownloadUrl(jobId: string, filename: string): string {
  // Use the fastify-static route prefix with job folder
  return `/download/conversion/${jobId}/${filename}`;
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeStatus =
    (error as { statusCode?: number }).statusCode ??
    (error as { status?: number }).status ??
    (error as { response?: { status?: number } }).response?.status ??
    (error as { axiosError?: { response?: { status?: number } } }).axiosError
      ?.response?.status;

  return maybeStatus === 404;
}

async function ensureBucket(
  accessToken: string,
  bucketKey: string,
): Promise<void> {
  try {
    await ossClient.getBucketDetails(bucketKey, { accessToken });
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }

    await ossClient.createBucket(
      OssRegion.Us,
      {
        bucketKey,
        policyKey: 'transient',
      },
      { accessToken },
    );
  }
}

/**
 * Checks the translation status of a file in Autodesk Platform Services.
 * This function retrieves the manifest of the translated file
 * and returns the status of the translation job.
 * @param {string} urn - The URN of the translated file.
 * @return {Promise<any>} Returns a promise that resolves to the manifest of the translation status.
 * @throws {Error} If the translation status cannot be retrieved or if the URN is invalid.
 */
export async function checkTranslationStatus(
  accessToken: string,
  urn: string,
): Promise<Manifest> {
  return modelDerivativeClient.getManifest(urn, { accessToken });
}

/**
 * Downloads and saves the IFC file after conversion.
 * This function retrieves the IFC file from Autodesk Forge after a successful translation job,
 * saves it to the local filesystem, and returns the file path.
 * @param {string} urn - The URN of the file being converted.
 * @param {string} jobId - The unique identifier of the conversion job.
 * @param {string} filename - The original filename to use for the output file.
 * @return {Promise<{ success: boolean, filePath?: string, filename?: string, error?: string }>} Returns an object indicating success, the file path of the saved IFC file, or an error message if the download fails.
 */
async function downloadAndSaveIfcFile(
  accessToken: string,
  urn: string,
  jobId: string,
  filename: string,
): Promise<{
  success: boolean;
  filePath?: string;
  filename?: string;
  error?: string;
}> {
  try {
    const manifest = await modelDerivativeClient.getManifest(urn, {
      accessToken,
    });

    if (!manifest.derivatives?.length) {
      throw new Error('No derivatives found in manifest');
    }

    const ifcDerivative = manifest.derivatives.find(
      (derivative) =>
        derivative.outputType?.toLowerCase() === BIMFileExportType.IFC,
    );

    if (!ifcDerivative) {
      throw new Error('IFC derivative not found');
    }

    const ifcResource = ifcDerivative.children?.find((child) => child.urn);

    if (!ifcResource?.urn) {
      throw new Error('No IFC resources available in derivative');
    }

    const derivativeUrn = ifcResource.urn;

    const derivativeDownload = await modelDerivativeClient.getDerivativeUrl(
      derivativeUrn,
      urn,
      { accessToken },
    );

    if (!derivativeDownload.url) {
      throw new Error('Derivative download URL missing from response');
    }

    ensureConvertedDirectoryExists();

    const response = await axios.get<ArrayBuffer>(derivativeDownload.url, {
      responseType: 'arraybuffer',
    });

    // Create job-specific directory
    const jobDir = path.join(CONVERTED_MODELS_DIR, jobId);
    if (!existsSync(jobDir)) {
      mkdirSync(jobDir, { recursive: true });
    }

    // Use original filename with .ifc extension
    const outputFilename = filename.replace(/\.(rvt|pln)$/i, '.ifc');
    const filePath = path.join(jobDir, outputFilename);
    writeFileSync(filePath, Buffer.from(response.data));

    return { success: true, filePath, filename: outputFilename };
  } catch (error) {
    console.error('Error downloading/saving IFC file:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Monitors the conversion progress of a file in Autodesk Forge.
 * This function periodically checks the translation status and updates the WebSocket clients
 * about the progress of the conversion job.
 * @param {string} urn - The URN of the file being converted.
 * @param {string} jobId - The unique identifier of the conversion job.
 */
async function monitorConversionProgress(
  accessToken: string,
  urn: string,
  jobId: string,
  originalFilename: string,
): Promise<void> {
  const POLLING_INTERVAL = 5000;
  const MAX_ATTEMPTS = 60;

  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  await delay(2000);

  for (let attempts = 0; attempts < MAX_ATTEMPTS; attempts++) {
    try {
      const manifest = await checkTranslationStatus(accessToken, urn);
      const { status, progress } = manifest;

      if (status === 'success') {
        wsManager.updateProgress(
          jobId,
          90,
          ConversionStatus.COMPLETED,
          'Conversion completed successfully, preparing download...',
        );

        const downloadResult = await downloadAndSaveIfcFile(
          accessToken,
          urn,
          jobId,
          originalFilename,
        );
        if (downloadResult.success && downloadResult.filename) {
          wsManager.completeJob(jobId, {
            downloadUrl: buildDownloadUrl(jobId, downloadResult.filename),
            fileName: downloadResult.filename,
            fileSize:
              downloadResult.filePath && existsSync(downloadResult.filePath)
                ? statSync(downloadResult.filePath).size
                : undefined,
          });
        } else {
          wsManager.handleJobError(
            jobId,
            `Failed to download IFC file: ${downloadResult.error}`,
          );
        }
        return;
      }

      if (status === 'failed') {
        wsManager.handleJobError(jobId, 'File conversion failed.');
        return;
      }

      if (status === 'inprogress') {
        // The progress field can be a percentage string like "50%" or the word "complete"
        let manifestProgress = 0;

        if (progress === 'complete') {
          manifestProgress = 100;
        } else if (typeof progress === 'string') {
          // Remove % sign and parse
          const numericProgress = Number.parseInt(
            progress.replace('%', ''),
            10,
          );
          manifestProgress = Number.isNaN(numericProgress)
            ? 0
            : numericProgress;
        } else if (typeof progress === 'number') {
          manifestProgress = progress;
        }

        // Map 0-100 manifest progress to 70-89 overall progress
        const progressPercent = Math.min(70 + manifestProgress * 0.19, 89);

        wsManager.updateProgress(
          jobId,
          Math.round(progressPercent),
          ConversionStatus.PROCESSING,
          `Conversion in progress: ${manifestProgress}%`,
        );
      }
    } catch (error) {
      wsManager.handleJobError(
        jobId,
        `Error checking progress: ${(error as Error).message}`,
      );
    }

    await delay(POLLING_INTERVAL);
  }

  wsManager.handleJobError(jobId, 'Conversion timed out.');
}

/**
 * Converts a Revit file to IFC format using Autodesk Forge with WebSocket updates.
 * This function uploads the Revit file to a Forge bucket, starts a translation job,
 * and uses WebSocket to notify clients about the progress of the conversion.
 * @param {Buffer} file - The Revit file to be converted.
 * @param {string} filename - The original filename of the Revit file.
 * @param {string} jobId - The unique identifier for the conversion job, used for WebSocket updates.
 * @return {Promise<{ success: boolean; urn?: string; error?: string }>} Returns an object indicating success, the URN of the job, or an error message.
 * @throws {Error} If the upload or translation fails, or if the file is not a valid Revit file.
 */
export async function convertRvtToIfcWS(
  file: Buffer,
  filename: string,
  jobId: string,
): Promise<{
  success: boolean;
  urn?: string;
  error?: string;
}> {
  try {
    const token = await authenticationClient.getTwoLeggedToken(
      env.AUTODESK_CLIENT_ID,
      env.AUTODESK_CLIENT_SECRET,
      [
        Scopes.DataRead,
        Scopes.DataWrite,
        Scopes.DataCreate,
        Scopes.BucketCreate,
        Scopes.BucketRead,
      ],
    );

    const accessToken = token.access_token;

    wsManager.updateProgress(
      jobId,
      10,
      ConversionStatus.UPLOADING,
      'Uploading file to APS',
    );

    const bucketKey = 'ts-ifc-api-bucket';

    try {
      await ensureBucket(accessToken, bucketKey);
    } catch (error) {
      wsManager.handleJobError(
        jobId,
        `Unable to prepare storage bucket: ${(error as Error).message}`,
      );
      return { success: false, error: (error as Error).message };
    }

    const objectKey = `model-${Date.now()}-${filename}`;
    wsManager.updateProgress(
      jobId,
      40,
      ConversionStatus.UPLOADING,
      'Uploading file to bucket',
    );

    const uploadResponse = await ossClient.uploadObject(
      bucketKey,
      objectKey,
      file,
      {
        accessToken,
      },
    );

    if (!uploadResponse.objectId) {
      throw new Error('File upload failed');
    }

    wsManager.updateProgress(
      jobId,
      60,
      ConversionStatus.PROCESSING,
      'Starting file conversion',
    );

    const urn = toBase64Url(uploadResponse.objectId);

    const job: JobPayload = {
      input: {
        urn,
      },
      output: {
        formats: [
          {
            type: BIMFileExportType.IFC,
          },
        ],
      },
    };

    await modelDerivativeClient.startJob(job, { accessToken });

    wsManager.updateProgress(
      jobId,
      70,
      ConversionStatus.PROCESSING,
      'Conversion job started, monitoring progress...',
    );

    void monitorConversionProgress(accessToken, urn, jobId, filename);

    return { success: true, urn };
  } catch (error) {
    wsManager.handleJobError(
      jobId,
      `Conversion failed during upload: ${(error as Error).message}`,
    );
    return { success: false, error: (error as Error).message };
  }
}

export async function convertIfcToRvtWS(
  _file: Buffer,
  _filename: string,
  jobId: string,
): Promise<{
  success: boolean;
  urn?: string;
  error?: string;
}> {
  wsManager.updateProgress(
    jobId,
    10,
    ConversionStatus.UPLOADING,
    'Uploading file to Forge',
  );

  // Todo...

  return {
    success: false,
    error: 'IFC to RVT conversion is not supported yet.',
  };
}
