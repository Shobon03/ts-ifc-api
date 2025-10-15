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

    return (
      status === 200 && data.status === 'healthy' && data.archicad_connected
    );
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
): Promise<Buffer> {
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
      50,
      ConversionStatus.PROCESSING,
      'File sent, waiting for conversion',
    );

    const { data, status } = await axios.post(
      `${PYTHON_API_CONNECTION_URL}/convert/archicad-to-ifc`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
        responseType: 'arraybuffer',
        timeout: 300000, // 5 minutes timeout for conversion
      },
    );

    if (status !== 200) {
      throw new Error(
        `Error from Archicad Python service: ${status} -> ${data.error || ''}`,
      );
    }

    wsManager.updateProgress(
      jobId,
      100,
      ConversionStatus.COMPLETED,
      'Conversion completed',
    );

    return Buffer.from(data);
  } catch (error) {
    wsManager.handleJobError(
      jobId,
      `Conversion failed during upload: ${error.message}`,
    );

    return null;
  }
}
