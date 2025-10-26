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
 * Interface for messages from Revit plugin
 */
interface RevitMessage {
  type: string;
  command?: string;
  jobId?: string;
  status?: string;
  progress?: number;
  message?: string;
  error?: string;
  ifcPath?: string;
  outputPath?: string;
  result?: {
    outputPath?: string;
    fileName?: string;
  };
}

/**
 * Interface for commands sent to Revit plugin
 */
interface RevitCommand {
  command: string;
  jobId: string;
  ifcPath?: string;
  outputPath?: string;
  [key: string]: unknown;
}

/**
 * Manages WebSocket connection to Revit plugin
 */
class RevitPluginManager {
  private revitSocket: WebSocket | null = null;
  private connected = false;

  /**
   * Registers a Revit plugin WebSocket connection
   */
  registerRevitConnection(socket: WebSocket): void {
    this.revitSocket = socket;
    this.connected = true;

    console.log('✓ Revit plugin connected');

    socket.on('message', (data: Buffer) => {
      this.handleRevitMessage(data.toString());
    });

    socket.on('close', () => {
      this.handleRevitDisconnect();
    });

    socket.on('error', (error: Error) => {
      console.error('Revit plugin socket error:', error);
      this.handleRevitDisconnect();
    });

    // Request plugin status
    this.sendCommand({
      command: 'get_status',
      jobId: 'init',
    });
  }

  /**
   * Handles messages received from Revit plugin
   */
  private handleRevitMessage(rawMessage: string): void {
    try {
      const message: RevitMessage = JSON.parse(rawMessage);

      console.log(
        `Received from Revit: ${message.type || message.command} ${message.jobId ? `(Job: ${message.jobId})` : ''}`,
      );

      switch (message.type || message.command) {
        case 'status':
        case 'plugin_status':
          this.handlePluginStatus(message);
          break;

        case 'conversion_started':
          this.handleConversionStarted(message);
          break;

        case 'progress':
        case 'conversion_progress':
          this.handleConversionProgress(message);
          break;

        case 'conversion_completed':
        case 'success':
          this.handleConversionCompleted(message);
          break;

        case 'conversion_failed':
        case 'error':
          this.handleConversionError(message);
          break;

        case 'conversion_cancelled':
          this.handleConversionCancelled(message);
          break;

        default:
          console.warn(
            `Unknown message type from Revit: ${message.type || message.command}`,
          );
      }
    } catch (error) {
      console.error('Failed to parse Revit message:', error);
    }
  }

  /**
   * Handles plugin status messages
   */
  private handlePluginStatus(message: RevitMessage): void {
    console.log(`Revit plugin status: ${message.status || 'ready'}`);
    if (message.message) {
      console.log(`  ${message.message}`);
    }
  }

  /**
   * Handles conversion started notification
   */
  private handleConversionStarted(message: RevitMessage): void {
    if (!message.jobId) return;

    wsManager.updateProgress(
      message.jobId,
      0,
      ConversionStatus.PROCESSING,
      'Revit plugin started conversion',
    );
  }

  /**
   * Handles conversion progress updates
   */
  private handleConversionProgress(message: RevitMessage): void {
    if (!message.jobId) return;

    const progress = Math.max(0, Math.min(100, message.progress || 0));

    wsManager.updateProgress(
      message.jobId,
      progress,
      ConversionStatus.PROCESSING,
      message.message || `Converting... ${progress}%`,
    );
  }

  /**
   * Handles successful conversion completion
   */
  private handleConversionCompleted(message: RevitMessage): void {
    if (!message.jobId) return;

    console.log(`Revit conversion completed for job ${message.jobId}`);

    wsManager.completeJob(message.jobId, {
      downloadUrl: message.result?.outputPath,
      fileName: message.result?.fileName,
    });
  }

  /**
   * Handles conversion errors
   */
  private handleConversionError(message: RevitMessage): void {
    if (!message.jobId) return;

    console.error(
      `Revit conversion failed for job ${message.jobId}: ${message.error || message.message}`,
    );

    wsManager.handleJobError(
      message.jobId,
      message.error || message.message || 'Revit conversion failed',
    );
  }

  /**
   * Handles conversion cancellation
   */
  private handleConversionCancelled(message: RevitMessage): void {
    if (!message.jobId) return;

    console.log(`Revit conversion cancelled for job ${message.jobId}`);

    wsManager.updateProgress(
      message.jobId,
      0,
      ConversionStatus.CANCELLED,
      'Conversion cancelled by Revit plugin',
    );
  }

  /**
   * Handles Revit plugin disconnection
   */
  private handleRevitDisconnect(): void {
    console.log('Revit plugin disconnected');
    this.revitSocket = null;
    this.connected = false;
  }

  /**
   * Sends a command to Revit plugin
   */
  sendCommand(command: RevitCommand): boolean {
    if (!this.revitSocket || !this.connected) {
      console.warn('Cannot send command to Revit - not connected');
      return false;
    }

    try {
      this.revitSocket.send(JSON.stringify(command));
      console.log(
        `Sent command to Revit: ${command.command} (Job: ${command.jobId})`,
      );
      return true;
    } catch (error) {
      console.error('Failed to send command to Revit:', error);
      return false;
    }
  }

  /**
   * Starts IFC to Revit conversion
   */
  startConversion(
    jobId: string,
    ifcPath: string,
    outputPath?: string,
  ): boolean {
    return this.sendCommand({
      command: 'start_conversion',
      jobId,
      ifcPath,
      outputPath,
    });
  }

  /**
   * Cancels an ongoing conversion
   */
  cancelConversion(jobId: string): boolean {
    return this.sendCommand({
      command: 'cancel_job',
      jobId,
    });
  }

  /**
   * Updates the IFC file path in Revit plugin
   */
  updatePath(jobId: string, ifcPath: string): boolean {
    return this.sendCommand({
      command: 'update_path',
      jobId,
      ifcPath,
    });
  }

  /**
   * Gets current plugin status
   */
  getStatus(jobId: string = 'status-check'): boolean {
    return this.sendCommand({
      command: 'get_status',
      jobId,
    });
  }

  /**
   * Checks if Revit plugin is connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Singleton instance of RevitPluginManager
 */
export const revitPlugin = new RevitPluginManager();
