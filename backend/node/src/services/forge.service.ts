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

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ForgeSDK from 'forge-apis';
import { BIMFileExportType } from '../types/formats';
import { env } from '../utils/load-env';
import { ConversionStatus, wsManager } from '../ws/websocket';

/**
 * Initializes a 2-legged OAuth client for Autodesk Forge.
 * This client is used for server-to-server communication with Forge APIs.
 * It requires the Autodesk client ID and secret from environment variables.
 * @return {Promise<{ oAuth2TwoLegged: ForgeSDK.AuthClientTwoLegged, credentials: ForgeSDK.AuthToken }>} Returns an object containing the OAuth client and the authentication credentials.
 * @throws {Error} If the authentication fails or the credentials are invalid.
 */
async function get2LeggedToken(): Promise<{
  oAuth2TwoLegged: ForgeSDK.AuthClientTwoLegged;
  credentials: ForgeSDK.AuthToken;
}> {
  const oAuth2TwoLegged = new ForgeSDK.AuthClientTwoLegged(
    env.AUTODESK_CLIENT_ID,
    env.AUTODESK_CLIENT_SECRET,
    ['data:read', 'data:write', 'bucket:create', 'bucket:read'],
    true,
  );

  const credentials = await oAuth2TwoLegged.authenticate();
  return { oAuth2TwoLegged, credentials };
}

/**
 * Checks the translation status of a file in Autodesk Forge.
 * This function retrieves the manifest of the translated file
 * and returns the status of the translation job.
 * @param {string} urn - The URN of the translated file.
 * @return {Promise<ForgeSDK.ApiResponse>} Returns a promise that resolves to the response of the translation status.
 * @throws {Error} If the translation status cannot be retrieved or if the URN is invalid.
 */
export async function checkTranslationStatus(
  urn: string,
): Promise<ForgeSDK.ApiResponse> {
  const { oAuth2TwoLegged, credentials } = await get2LeggedToken();
  const derivativesApi = new ForgeSDK.DerivativesApi();

  const manifest = derivativesApi.getManifest(
    urn,
    {},
    oAuth2TwoLegged,
    credentials,
  );

  return manifest;
}

/**
 * Downloads and saves the IFC file after conversion.
 * This function retrieves the IFC file from Autodesk Forge after a successful translation job,
 * saves it to the local filesystem, and returns the file path.
 * @param {string} urn - The URN of the file being converted.
 * @param {string} jobId - The unique identifier of the conversion job.
 * @return {Promise<{ success: boolean, filePath?: string, error?: string }>} Returns an object indicating success, the file path of the saved IFC file, or an error message if the download fails.
 */
async function downloadAndSaveIfcFile(
  urn: string,
  jobId: string,
): Promise<{
  success: boolean;
  filePath?: string;
  error?: string;
}> {
  try {
    const { oAuth2TwoLegged, credentials } = await get2LeggedToken();
    const derivativesApi = new ForgeSDK.DerivativesApi();

    // Get the manifest first to find the IFC derivative
    const manifest = await derivativesApi.getManifest(
      urn,
      {},
      oAuth2TwoLegged,
      credentials,
    );

    if (!manifest.body.derivatives) {
      throw new Error('No derivatives found in manifest');
    }

    // Find the IFC derivative
    let ifcDerivative = null;
    for (const derivative of manifest.body.derivatives) {
      if (derivative.outputType === 'ifc') {
        ifcDerivative = derivative;
        break;
      }
    }

    if (!ifcDerivative) {
      throw new Error('IFC derivative not found');
    }

    // The IFC derivative should have children with the actual files
    if (!ifcDerivative.children || ifcDerivative.children.length === 0) {
      throw new Error('No IFC files found in derivative');
    }

    // Get the first IFC file (usually there's only one)
    const ifcFile = ifcDerivative.children[0];
    const derivativeUrn = ifcFile.urn;

    // Fetch the IFC file from Autodesk Forge
    const downloadUrl = `https://developer.api.autodesk.com/derivativeservice/v2/derivatives/${encodeURIComponent(derivativeUrn)}`;

    const response = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${credentials.access_token}`,
        Accept: 'application/octet-stream',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download IFC file: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const fileContent = Buffer.from(arrayBuffer);

    // Create the converted_models directory if it doesn't exist
    const outputDir = path.join(
      process.cwd(),
      'public/models/converted_models',
    );
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Create the file path
    const fileName = `${jobId}.ifc`;
    const filePath = path.join(outputDir, fileName);

    // Save the file
    writeFileSync(filePath, fileContent);

    return { success: true, filePath };
  } catch (error) {
    console.error(`Error downloading/saving IFC file:`, error);
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
  urn: string,
  jobId: string,
): Promise<void> {
  const maxAttempts = 60; // 5 min max
  let attempts = 0;

  const checkProgress = async () => {
    try {
      attempts++;

      const manifest = await checkTranslationStatus(urn);
      const status = manifest.body.status;
      const progress =
        manifest.body.progress === 'completed'
          ? 100
          : manifest.body.progress.split('%')[0];

      if (status === 'success') {
        wsManager.updateProgress(
          jobId,
          90,
          ConversionStatus.COMPLETED,
          'Conversion completed successfully, preparing download...',
        );

        // Download and save the IFC file
        const downloadResult = await downloadAndSaveIfcFile(urn, jobId);

        if (downloadResult.success) {
          wsManager.completeJob(jobId, {
            downloadUrl: `${env.HOST}:${env.PORT}/public/models/converted_models/${jobId}.ifc`,
            fileName: `${jobId}.ifc`,
            fileSize: existsSync(downloadResult.filePath)
              ? require('fs').statSync(downloadResult.filePath).size
              : undefined,
          });
        } else {
          wsManager.handleJobError(
            jobId,
            `Failed to download IFC file: ${downloadResult.error}`,
          );
        }
      } else if (status === 'failed') {
        wsManager.handleJobError(jobId, 'File conversion failed.');
      } else if (status === 'inprogress') {
        const progressPercent = Math.min(70 + (progress || 0) * 0.2, 89);
        wsManager.updateProgress(
          jobId,
          progressPercent,
          ConversionStatus.PROCESSING,
          `Conversion in progress: ${progress || 0}%`,
        );

        if (attempts < maxAttempts) {
          setTimeout(checkProgress, 5000); // Check again in 5 seconds
        } else {
          wsManager.handleJobError(
            jobId,
            'Conversion timed out after multiple attempts.',
          );
        }
      } else {
        const progressPercent = Math.min(70 + attempts, 85);
        wsManager.updateProgress(
          jobId,
          progressPercent,
          ConversionStatus.PROCESSING,
          `Conversion status: ${status}`,
        );

        if (attempts < maxAttempts) {
          setTimeout(checkProgress, 5000); // Check again in 5 seconds
        } else {
          wsManager.handleJobError(
            jobId,
            'Conversion timed out after multiple attempts.',
          );
        }
      }
    } catch (error) {
      wsManager.handleJobError(
        jobId,
        `Error checking progress: ${(error as Error).message}`,
      );
    }
  };

  setTimeout(checkProgress, 2000); // First check after 2 seconds
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
    wsManager.updateProgress(
      jobId,
      10,
      ConversionStatus.UPLOADING,
      'Uploading file to Forge',
    );

    const { oAuth2TwoLegged, credentials } = await get2LeggedToken();
    const bucketsApi = new ForgeSDK.BucketsApi();
    const objectsApi = new ForgeSDK.ObjectsApi();
    const derivativesApi = new ForgeSDK.DerivativesApi();

    // Create bucket
    const bucketKey = 'ts-ifc-api-bucket';
    try {
      await bucketsApi.getBucketDetails(
        bucketKey,
        oAuth2TwoLegged,
        credentials,
      );
    } catch (error) {
      if (error.statusCode === 404) {
        wsManager.updateProgress(
          jobId,
          20,
          ConversionStatus.UPLOADING,
          'Creating bucket in Forge',
        );
        await bucketsApi.createBucket(
          { bucketKey: bucketKey, policyKey: 'transient' },
          { xAdsRegion: 'us' },
          oAuth2TwoLegged,
          credentials,
        );
      }
    }

    // Upload file
    const objectKey = `model-${Date.now()}-${filename}`;
    wsManager.updateProgress(
      jobId,
      40,
      ConversionStatus.UPLOADING,
      'Uploading file to Forge',
    );

    const uploadResponse = await objectsApi.uploadResources(
      bucketKey,
      [
        {
          objectKey,
          data: file,
        },
      ],
      {},
      oAuth2TwoLegged,
      credentials,
    );

    if (!uploadResponse[0]?.completed?.objectId) {
      throw new Error('File upload failed');
    }

    wsManager.updateProgress(
      jobId,
      60,
      ConversionStatus.PROCESSING,
      'Starting file conversion',
    );

    // Create URN and start translation
    const urn = Buffer.from(uploadResponse[0].completed.objectId).toString(
      'base64',
    );

    const job = {
      input: {
        urn,
      },
      output: {
        formats: [
          {
            type: BIMFileExportType.IFC,
            views: ['2d', '3d'],
          },
        ],
      },
    };

    await derivativesApi.translate(job, {}, oAuth2TwoLegged, credentials);

    wsManager.updateProgress(
      jobId,
      70,
      ConversionStatus.PROCESSING,
      'Conversion job started, monitoring progress...',
    );

    monitorConversionProgress(urn, jobId);

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
  file: Buffer,
  filename: string,
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
