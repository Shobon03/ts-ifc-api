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

import axios from 'axios';
import { prepareOutputPath } from '../utils/file-staging';
import { ConversionStatus, wsManager } from '../ws/websocket';

/**
 * Service to interact with Revit via a Python intermediary.
 */
let PYTHON_API_CONNECTION_URL: string = null;

if (process.env.APP_ENV === 'production') {
  PYTHON_API_CONNECTION_URL = `https://${process.env.PYTHON_SERVICE_HOST}`;
} else {
  const host = process.env.PYTHON_SERVICE_HOST || 'localhost';
  const port = process.env.PYTHON_SERVICE_PORT || '5000';

  PYTHON_API_CONNECTION_URL = `http://${host}:${port}`;
}

/**
 * Checks the connection to the Revit Python service.
 * @returns A promise that resolves with a boolean indicating the connection status.
 */
export async function checkRevitPythonServiceConnection(
  jobId: string,
): Promise<boolean> {
  try {
    wsManager.updateProgress(
      jobId,
      20,
      ConversionStatus.UPLOADING,
      'Checking Revit bridge health',
    );

    const { data, status } = await axios.get(
      `${PYTHON_API_CONNECTION_URL}/health`,
      {
        timeout: 5000,
      },
    );

    if (status !== 200) {
      return false;
    }

    const serviceStatus = (data?.status || '').toLowerCase();
    const revitPluginStatus = data?.pluginWebSockets?.revit || data?.revit;

    const serviceOnline = ['ok', 'healthy'].includes(serviceStatus);
    const pluginOnline = revitPluginStatus === 'connected';

    console.log('Revit health check response:', {
      serviceStatus,
      revitPluginStatus,
      serviceOnline,
      pluginOnline,
      fullData: data,
    });

    if (serviceOnline && pluginOnline) {
      wsManager.updateProgress(
        jobId,
        25,
        ConversionStatus.UPLOADING,
        'Revit bridge reachable',
      );
    }

    return serviceOnline && pluginOnline;
  } catch (error) {
    console.error(`Error connecting to Revit Python service: ${error.message}`);
    return false;
  }
}

/**
 * Sends an IFC file path to the Revit Python service for conversion to RVT.
 * The IFC file should already exist on disk (e.g., from a previous Archicad conversion).
 * Updates the WebSocket with the conversion progress.
 * @param ifcFilePath The absolute path to the IFC file on disk
 * @param filename The name of the file being sent
 * @param jobId The job ID for tracking progress via WebSocket
 * @returns A promise that resolves when the conversion is dispatched
 */
export async function sendFileToRevitPythonServiceWS(
  ifcFilePath: string,
  filename: string,
  jobId: string,
): Promise<void> {
  try {
    wsManager.updateProgress(
      jobId,
      10,
      ConversionStatus.UPLOADING,
      'Preparing IFC file for Revit service',
    );

    // Prepare the output path where Revit will save the RVT file
    const outputPath = await prepareOutputPath(jobId, filename, '.rvt');

    wsManager.updateProgress(
      jobId,
      15,
      ConversionStatus.UPLOADING,
      'IFC file path prepared for Revit conversion',
      {
        stagingStrategy: 'file-path',
        ifcPath: ifcFilePath,
        outputPath,
      },
    );

    // Check if API is healthy
    const isHealthy = await checkRevitPythonServiceConnection(jobId);

    if (!isHealthy) {
      throw new Error('Revit Python service is not healthy or reachable.');
    }

    // Send JSON payload to Python
    const payload = {
      jobId,
      ifcPath: ifcFilePath,
      outputPath,
      downloadName: filename.replace(/\.ifc$/i, '.rvt'),
    };

    wsManager.updateProgress(
      jobId,
      40,
      ConversionStatus.PROCESSING,
      'File path submitted to Revit bridge',
      {
        stagingStrategy: 'file-path',
        ifcPath: ifcFilePath,
        outputPath,
      },
    );

    const response = await axios.post(
      `${PYTHON_API_CONNECTION_URL}/trigger-revit-conversion`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        responseType: 'json',
        timeout: 120000,
        validateStatus: (code) => code >= 200 && code < 400,
      },
    );

    if (response.status >= 300) {
      throw new Error(
        `Unexpected response from Revit Python service: ${response.status}`,
      );
    }

    const message =
      response.data?.message || 'Conversion dispatched to Revit plugin';

    wsManager.updateProgress(jobId, 50, ConversionStatus.PROCESSING, message, {
      pythonJobId: response.data?.jobId,
      downloadUrl: response.data?.downloadUrl,
      stagingStrategy: 'file-path',
      ifcPath: ifcFilePath,
      outputPath,
    });
  } catch (error) {
    wsManager.handleJobError(
      jobId,
      `Revit conversion failed during upload: ${error.message}`,
    );
  }
}
