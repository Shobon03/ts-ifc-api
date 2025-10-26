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

import { existsSync, statSync } from 'node:fs';
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
  details?: Record<string, unknown>;
  error?: string;
  service?: string;
  version?: string;
  result?: Record<string, unknown>;
  plugin?: string;
}

/**
 * Plugin status tracking
 */
type PluginType = 'revit' | 'archicad';
type PluginStatus = 'connected' | 'disconnected' | 'error';

interface PluginStatusInfo {
  status: PluginStatus;
  version?: string;
  lastUpdate: Date;
}

/**
 * Manages WebSocket connection from Python service
 */
class PythonBridgeManager {
  private pythonSocket: WebSocket | null = null;
  private connected = false;
  private pluginStatuses: Map<PluginType, PluginStatusInfo> = new Map();
  private clientSockets: Set<WebSocket> = new Set();

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
          console.log(`Archicad conversion queued for job ${message.jobId}`);
          break;

        case 'plugin_conversion_completed':
          this.handlePluginConversionCompleted(message);
          break;

        case 'plugin_conversion_failed':
          this.handlePluginConversionFailed(message);
          break;

        case 'plugin_status':
          this.handlePluginStatus(message);
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
    console.log(`Python requested Revit conversion for job ${message.jobId}`);

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
   * Handles plugin conversion completion notification
   */
  private handlePluginConversionCompleted(message: PythonMessage): void {
    if (!message.jobId) {
      console.warn('Plugin conversion completed missing jobId');
      return;
    }

    console.log(`✓ Plugin conversion completed for job ${message.jobId}`);

    const result = message.result || {};

    // Build Node.js-based download URL that points to the static file server
    // The Python service stores files in outputPath, which we need to map to our static route
    const outputPath =
      (typeof result.outputPath === 'string' ? result.outputPath : '') || '';
    let downloadUrl =
      typeof result.downloadUrl === 'string' ? result.downloadUrl : undefined;
    let fileName =
      typeof result.fileName === 'string' ? result.fileName : undefined;
    let fileSize: number | undefined =
      (typeof result.fileSize === 'number'
        ? result.fileSize
        : typeof result.outputSize === 'number'
          ? result.outputSize
          : undefined) || undefined;

    // If we have an outputPath from Python, construct the download URL for Node's static server
    if (outputPath) {
      // Extract the relative path from the outputPath
      // outputPath format: C:\...\backend\node\public\conversion\job-xxx\file.ifc
      const pathParts = outputPath.split(/[/\\]/);
      const conversionIndex = pathParts.indexOf('conversion');

      if (conversionIndex !== -1) {
        // Build the path from 'conversion' onwards
        const relativePath = pathParts.slice(conversionIndex + 1).join('/');
        downloadUrl = `/download/conversion/${relativePath}`;

        // Extract filename if not provided
        if (!fileName) {
          fileName = pathParts[pathParts.length - 1];
        }
      }

      // Get file size from the actual file if not provided by Python
      if (!fileSize && existsSync(outputPath)) {
        try {
          const stats = statSync(outputPath);
          fileSize = stats.size;
          console.log(`Retrieved file size from filesystem: ${fileSize} bytes`);
        } catch (error) {
          console.warn(`Failed to get file size for ${outputPath}:`, error);
        }
      }
    }

    wsManager.completeJob(message.jobId, {
      downloadUrl,
      fileName,
      fileSize,
    });
  }

  /**
   * Handles plugin conversion failure notification
   */
  private handlePluginConversionFailed(message: PythonMessage): void {
    if (!message.jobId) {
      console.warn('Plugin conversion failed missing jobId');
      return;
    }

    console.error(`✗ Plugin conversion failed for job ${message.jobId}`);

    wsManager.handleJobError(
      message.jobId,
      message.error || 'Plugin conversion failed',
    );
  }

  /**
   * Handles plugin status updates
   */
  private handlePluginStatus(message: PythonMessage): void {
    const plugin = message.plugin as PluginType;
    const status = message.status as PluginStatus;
    const version = message.version;

    console.log(`Plugin ${plugin} status: ${status}`);

    // Update internal status tracking
    this.pluginStatuses.set(plugin, {
      status,
      version,
      lastUpdate: new Date(),
    });

    // Broadcast to all connected clients
    this.broadcastPluginStatus(plugin, status, version);
  }

  /**
   * Broadcasts plugin status to all connected client sockets
   */
  private broadcastPluginStatus(
    plugin: PluginType,
    status: PluginStatus,
    version?: string,
  ): void {
    const message = {
      type: 'plugin_status',
      plugin,
      status,
      version,
      timestamp: new Date().toISOString(),
    };

    const messageStr = JSON.stringify(message);

    this.clientSockets.forEach((socket) => {
      if (socket.readyState === socket.OPEN) {
        try {
          socket.send(messageStr);
        } catch (error) {
          console.error(`Failed to send plugin status to client:`, error);
          this.clientSockets.delete(socket);
        }
      } else {
        this.clientSockets.delete(socket);
      }
    });
  }

  /**
   * Registers a client WebSocket connection to receive plugin status updates
   */
  registerClientConnection(socket: WebSocket): void {
    this.clientSockets.add(socket);

    console.log('[PythonBridge] Client registered for plugin status updates');
    console.log('[PythonBridge] Current plugin statuses:', {
      revit: this.pluginStatuses.get('revit'),
      archicad: this.pluginStatuses.get('archicad'),
    });

    // Send current plugin statuses to the new client
    // If we have status info, send it. Otherwise, send 'disconnected' as default
    const sendInitialStatus = () => {
      ['revit', 'archicad'].forEach((pluginType) => {
        const statusInfo = this.pluginStatuses.get(pluginType as PluginType);
        const message = {
          type: 'plugin_status',
          plugin: pluginType,
          status: statusInfo?.status || 'disconnected',
          version: statusInfo?.version,
          timestamp: new Date().toISOString(),
        };

        try {
          if (socket.readyState === socket.OPEN) {
            socket.send(JSON.stringify(message));
            console.log(
              `[PythonBridge] Sent initial ${pluginType} status to client:`,
              message.status,
            );
          }
        } catch (error) {
          console.error(`Failed to send initial ${pluginType} status:`, error);
        }
      });
    };

    // Send statuses immediately if socket is open
    if (socket.readyState === socket.OPEN) {
      sendInitialStatus();
    } else {
      // Otherwise wait for socket to open
      socket.on('open', sendInitialStatus);
    }

    // Clean up on disconnect
    socket.on('close', () => {
      this.clientSockets.delete(socket);
    });

    socket.on('error', () => {
      this.clientSockets.delete(socket);
    });
  }

  /**
   * Gets current status of a specific plugin
   */
  getPluginStatus(plugin: PluginType): PluginStatusInfo | undefined {
    return this.pluginStatuses.get(plugin);
  }

  /**
   * Gets all plugin statuses
   */
  getAllPluginStatuses(): Record<PluginType, PluginStatusInfo | undefined> {
    return {
      revit: this.pluginStatuses.get('revit'),
      archicad: this.pluginStatuses.get('archicad'),
    };
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
  sendToPython(message: Record<string, unknown>): boolean {
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
