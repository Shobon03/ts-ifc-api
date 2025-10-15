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

import type { WebSocket } from 'ws';
import { ConversionStatus, wsManager } from './websocket';

/**
 * Interface for messages from Python service
 */
interface PythonMessage {
  type: string;
  jobId?: string;
  progress?: number;
  status?: string;
  message?: string;
  details?: any;
  error?: string;
  service?: string;
  version?: string;
}

/**
 * Manages WebSocket connection from Python service
 */
class PythonBridgeManager {
  private pythonSocket: WebSocket | null = null;
  private connected = false;

  /**
   * Registers a Python service WebSocket connection
   */
  registerPythonConnection(socket: WebSocket): void {
    this.pythonSocket = socket;
    this.connected = true;

    console.log('✓ Python service connected to bridge');

    socket.on('message', (data: Buffer) => {
      this.handlePythonMessage(data.toString());
    });

    socket.on('close', () => {
      this.handlePythonDisconnect();
    });

    socket.on('error', (error: Error) => {
      console.error('Python bridge socket error:', error);
      this.handlePythonDisconnect();
    });

    // Send acknowledgment
    this.sendToPython({
      type: 'connection_ack',
      message: 'Connected to Node.js WebSocket bridge',
    });
  }

  /**
   * Handles messages received from Python service
   */
  private handlePythonMessage(rawMessage: string): void {
    try {
      const message: PythonMessage = JSON.parse(rawMessage);

      console.log(
        `Received from Python: ${message.type} ${message.jobId ? `(Job: ${message.jobId})` : ''}`,
      );

      switch (message.type) {
        case 'identify':
          this.handleIdentification(message);
          break;

        case 'progress_update':
          this.handleProgressUpdate(message);
          break;

        case 'job_error':
          this.handleJobError(message);
          break;

        case 'trigger_revit_conversion':
          this.handleRevitConversionRequest(message);
          break;

        case 'get_job_status':
          this.handleJobStatusRequest(message);
          break;

        case 'archicad_conversion_received':
          console.log(
            `Archicad conversion queued for job ${message.jobId}`,
          );
          break;

        case 'pong':
          // Heartbeat response
          break;

        default:
          console.warn(`Unknown message type from Python: ${message.type}`);
      }
    } catch (error) {
      console.error('Failed to parse Python message:', error);
    }
  }

  /**
   * Handles Python service identification
   */
  private handleIdentification(message: PythonMessage): void {
    console.log(
      `Python service identified: ${message.service} v${message.version}`,
    );
  }

  /**
   * Handles progress updates from Python
   */
  private handleProgressUpdate(message: PythonMessage): void {
    if (!message.jobId) {
      console.warn('Progress update missing jobId');
      return;
    }

    const status = this.mapPythonStatus(message.status || 'processing');
    const progress = Math.max(0, Math.min(100, message.progress || 0));

    wsManager.updateProgress(
      message.jobId,
      progress,
      status,
      message.message || 'Processing',
      message.details,
    );
  }

  /**
   * Handles error notifications from Python
   */
  private handleJobError(message: PythonMessage): void {
    if (!message.jobId) {
      console.warn('Job error missing jobId');
      return;
    }

    wsManager.handleJobError(
      message.jobId,
      message.error || 'Unknown error from Python service',
    );
  }

  /**
   * Handles request from Python to trigger Revit conversion
   */
  private handleRevitConversionRequest(message: PythonMessage): void {
    console.log(
      `Python requested Revit conversion for job ${message.jobId}`,
    );

    // TODO: Implement Revit plugin communication
    // For now, just acknowledge the request
    this.sendToPython({
      type: 'revit_conversion_queued',
      jobId: message.jobId,
      message: 'Revit conversion request received',
    });
  }

  /**
   * Handles job status request from Python
   */
  private handleJobStatusRequest(message: PythonMessage): void {
    if (!message.jobId) {
      console.warn('Job status request missing jobId');
      return;
    }

    const job = wsManager.getJob(message.jobId);

    if (job) {
      this.sendToPython({
        type: 'job_status_response',
        jobId: message.jobId,
        status: job.status,
        progress: job.progress,
        fileName: job.fileName,
        error: job.error,
      });
    } else {
      this.sendToPython({
        type: 'job_status_response',
        jobId: message.jobId,
        error: 'Job not found',
      });
    }
  }

  /**
   * Handles Python service disconnection
   */
  private handlePythonDisconnect(): void {
    console.log('Python service disconnected from bridge');
    this.pythonSocket = null;
    this.connected = false;
  }

  /**
   * Sends a message to Python service
   */
  sendToPython(message: any): boolean {
    if (!this.pythonSocket || !this.connected) {
      console.warn('Cannot send to Python - not connected');
      return false;
    }

    try {
      this.pythonSocket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Failed to send message to Python:', error);
      return false;
    }
  }

  /**
   * Sends a ping to Python service
   */
  ping(): void {
    this.sendToPython({ type: 'ping' });
  }

  /**
   * Checks if Python service is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Maps Python status strings to Node.js ConversionStatus enum
   */
  private mapPythonStatus(pythonStatus: string): ConversionStatus {
    const statusMap: Record<string, ConversionStatus> = {
      queued: ConversionStatus.QUEUED,
      uploading: ConversionStatus.UPLOADING,
      processing: ConversionStatus.PROCESSING,
      downloading: ConversionStatus.DOWNLOADING,
      completed: ConversionStatus.COMPLETED,
      error: ConversionStatus.ERROR,
      cancelled: ConversionStatus.CANCELLED,
    };

    return statusMap[pythonStatus.toLowerCase()] || ConversionStatus.PROCESSING;
  }

  /**
   * Triggers Archicad conversion via Python service
   */
  triggerArchicadConversion(jobId: string, filePath: string): boolean {
    return this.sendToPython({
      type: 'trigger_archicad_conversion',
      jobId,
      filePath,
    });
  }
}

/**
 * Singleton instance of PythonBridgeManager
 */
export const pythonBridge = new PythonBridgeManager();
