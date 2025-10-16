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
import FormData from 'form-data';
import { ConversionStatus, wsManager } from '../ws/websocket';

/**
 * Service to interact with Archicad via a Python intermediary.
 * If the enviroinment is local, use the Windows machine's IP address to route it.
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
 * Checks the connection to the Archicad Python service.
 * @returns A promise that resolves with a boolean indicating the connection status.
 */
export async function checkArchicadPythonServiceConnection(
  jobId: string,
): Promise<boolean> {
  try {
    wsManager.updateProgress(
      jobId,
      20,
      ConversionStatus.UPLOADING,
      'Sending file to Archicad service',
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
    const archicadPluginStatus =
      data?.pluginWebSockets?.archicad || data?.archicad;

    const serviceOnline = ['ok', 'healthy'].includes(serviceStatus);
    const pluginOnline = archicadPluginStatus === 'connected';

    if (serviceOnline && pluginOnline) {
      wsManager.updateProgress(
        jobId,
        25,
        ConversionStatus.UPLOADING,
        'Archicad bridge reachable',
      );
    }

    return serviceOnline && pluginOnline;
  } catch (error) {
    console.error(
      `Error connecting to Archicad Python service: ${error.message}`,
    );
    return false;
  }
}

/**
 * Sends a BIM file to the Archicad Python service for conversion to IFC.
 * Updates the WebSocket with the conversion progress.
 * @param file The BIM file buffer to be sent.
 * @param filename The name of the file being sent.
 * @param jobId The job ID for tracking progress via WebSocket.
 * @returns A promise that resolves with the converted IFC file buffer, or null if an error occurs.
 */
export async function sendFileToArchicadPythonServiceWS(
  file: Buffer,
  filename: string,
  jobId: string,
): Promise<void> {
  try {
    wsManager.updateProgress(
      jobId,
      10,
      ConversionStatus.UPLOADING,
      'Sending file to Archicad service',
    );

    // Check if API is healthy
    const isHealthy = await checkArchicadPythonServiceConnection(jobId);

    if (!isHealthy) {
      throw new Error('Archicad Python service is not healthy or reachable.');
    }

    // Send file with job ID for tracking
    const formData = new FormData();
    formData.append('file', new Blob([file]), filename);
    formData.append('jobId', jobId);

    wsManager.updateProgress(
      jobId,
      40,
      ConversionStatus.PROCESSING,
      'File sent to Archicad bridge, awaiting plugin confirmation',
    );

    const response = await axios.post(
      `${PYTHON_API_CONNECTION_URL}/convert/archicad-to-ifc`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
        responseType: 'json',
        timeout: 120000,
        validateStatus: (code) => code >= 200 && code < 400,
      },
    );

    if (response.status >= 300) {
      throw new Error(
        `Unexpected response from Archicad Python service: ${response.status}`,
      );
    }

    const message =
      response.data?.message || 'Conversion dispatched to Archicad plugin';

    wsManager.updateProgress(jobId, 50, ConversionStatus.PROCESSING, message, {
      pythonJobId: response.data?.jobId,
      downloadUrl: response.data?.downloadUrl,
    });
  } catch (error) {
    wsManager.handleJobError(
      jobId,
      `Conversion failed during upload: ${error.message}`,
    );
  }
}
