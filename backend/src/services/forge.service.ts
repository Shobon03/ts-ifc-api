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

/// WEBSOCKET IMPLEMENTATION ///
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
      const progress = manifest.body.progress;

      if (status === 'success') {
        wsManager.updateProgress(
          jobId,
          90,
          ConversionStatus.COMPLETED,
          'Conversion completed successfully, preparing download...',
        );

        const derivatives = manifest.body.derivatives || [];
        let ifcDerivative = null;

        for (const derivative of derivatives) {
          if (derivative.outputType === 'ifc') {
            ifcDerivative = derivative;
            break;
          }
        }

        if (ifcDerivative) {
          wsManager.completeJob(jobId, {
            downloadUrl: `/models/download/${urn}`,
            fileName: 'converded_model.ifc',
          });
        } else {
          wsManager.handleJobError(
            jobId,
            'IFC derivative not found after successful conversion.',
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
    } catch (error) {}
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
    const urn = Buffer.from(`${bucketKey}:${objectKey}`).toString('base64');

    const job = {
      input: {
        urn,
      },
      output: {
        formats: [
          {
            type: BIMFileExportType.IFC,
            views: ['3d'],
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

///WITHOUT WEBSOCKET IMPLEMENTATION ///
/**
 * Converts a Revit file to IFC format using Autodesk Forge.
 * This function uploads the Revit file to a Forge bucket, starts a translation job,
 * and returns the job response.
 * @param {Buffer} file - The Revit file to be converted.
 * @param {BIMFileExportType} [type=BIMFileExportType.IFC] - The type of BIM file export format. Defaults to IFC.
 * @return {Promise<ForgeSDK.ApiResponse>} Returns a promise that resolves to the response of the translation job.
 * @throws {Error} If the upload or translation fails, or if the file is not a valid Revit file.
 */
export async function convertRvtToIfc(
  file: Buffer,
  type: BIMFileExportType = BIMFileExportType.IFC,
): Promise<ForgeSDK.ApiResponse> {
  const { oAuth2TwoLegged, credentials } = await get2LeggedToken();

  const bucketsApi = new ForgeSDK.BucketsApi();
  const objectsApi = new ForgeSDK.ObjectsApi();
  const derivativesApi = new ForgeSDK.DerivativesApi();

  // Create a bucket if it doesn't exist
  const bucketKey = 'ts-ifc-api-bucket';
  try {
    await bucketsApi.getBucketDetails(bucketKey, oAuth2TwoLegged, credentials);
  } catch (error) {
    await bucketsApi.createBucket(
      { bucketKey: bucketKey, policyKey: 'transient' },
      { xAdsRegion: 'us' },
      oAuth2TwoLegged,
      credentials,
    );
  }

  // Upload the file to the bucket
  const uploadResponse = await objectsApi.uploadResources(
    bucketKey,
    [
      {
        objectKey: `model-${Date.now()}.rvt`,
        data: file,
      },
    ],
    {},
    oAuth2TwoLegged,
    credentials,
  );

  // Start the translation job
  const job = {
    input: {
      urn: Buffer.from(uploadResponse[0].completed.objectId).toString('base64'),
    },
    output: {
      formats: [
        {
          type,
          views: ['2d', '3d'],
        },
      ],
    },
  };

  const jobResponse = await derivativesApi.translate(
    job,
    {},
    oAuth2TwoLegged,
    credentials,
  );

  return jobResponse;
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
 * Downloads the converted IFC file from Autodesk Forge.
 * This function retrieves the manifest of the converted file and checks its status.
 * If the conversion is successful, it returns the response containing the IFC file.
 * @param {string} urn - The URN of the converted IFC file.
 * @return {Promise<ForgeSDK.ApiResponse>} Returns a promise that resolves to the response of the downloaded IFC file.
 * @throws {Error} If the conversion is not complete or if the download fails.
 */
export async function downloadIfcFile(
  urn: string,
): Promise<ForgeSDK.ApiResponse> {
  const { oAuth2TwoLegged, credentials } = await get2LeggedToken();
  const derivativesApi = new ForgeSDK.DerivativesApi();

  // Download the IFC file
  const response = await derivativesApi.getManifest(
    urn,
    {},
    oAuth2TwoLegged,
    credentials,
  );

  if (response.body.status !== 'success') {
    throw new Error('IFC file conversion is not complete or failed.');
  }

  return response;
}
