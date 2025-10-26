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
 * Interface for messages from Archicad plugin
 */
interface ArchicadMessage {
  type: string;
  command?: string;
  jobId?: string;
  status?: string;
  progress?: number;
  message?: string;
  error?: string;
  plnPath?: string;
  outputPath?: string;
  result?: {
    outputPath?: string;
    fileName?: string;
  };
}

/**
 * Interface for commands sent to Archicad plugin
 */
interface ArchicadCommand {
  command: string;
  jobId: string;
  plnPath?: string;
  outputPath?: string;
  [key: string]: unknown;
}

/**
 * Manages WebSocket connection to Archicad plugin
 */
class ArchicadPluginManager {
  private archicadSocket: WebSocket | null = null;
  private connected = false;

  /**
   * Registers an Archicad plugin WebSocket connection
   */
  registerArchicadConnection(socket: WebSocket): void {
    this.archicadSocket = socket;
    this.connected = true;

    console.log('✓ Archicad plugin connected');

    socket.on('message', (data: Buffer) => {
      this.handleArchicadMessage(data.toString());
    });

    socket.on('close', () => {
      this.handleArchicadDisconnect();
    });

    socket.on('error', (error: Error) => {
      console.error('Archicad plugin socket error:', error);
      this.handleArchicadDisconnect();
    });

    // Request plugin status
    this.sendCommand({
      command: 'get_status',
      jobId: 'init',
    });
  }

  /**
   * Handles messages received from Archicad plugin
   */
  private handleArchicadMessage(rawMessage: string): void {
    try {
      const message: ArchicadMessage = JSON.parse(rawMessage);

      console.log(
        `Received from Archicad: ${message.type || message.command} ${message.jobId ? `(Job: ${message.jobId})` : ''}`,
      );

      switch (message.type || message.command) {
        case 'status':
        case 'plugin_status':
          this.handlePluginStatus(message);
          break;

        case 'connection_ack':
          console.log('Archicad plugin acknowledged connection');
          break;

        case 'conversion_started':
          this.handleConversionStarted(message);
          break;

        case 'progress':
        case 'conversion_progress':
          this.handleConversionProgress(message);
          break;

        case 'conversion_completed':
        case 'completed':
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
            `Unknown message type from Archicad: ${message.type || message.command}`,
          );
      }
    } catch (error) {
      console.error('Failed to parse Archicad message:', error);
    }
  }

  /**
   * Handles plugin status messages
   */
  private handlePluginStatus(message: ArchicadMessage): void {
    console.log(`Archicad plugin status: ${message.status || 'ready'}`);
    if (message.message) {
      console.log(`  ${message.message}`);
    }
  }

  /**
   * Handles conversion started notification
   */
  private handleConversionStarted(message: ArchicadMessage): void {
    if (!message.jobId) return;

    wsManager.updateProgress(
      message.jobId,
      0,
      ConversionStatus.PROCESSING,
      'Archicad plugin started conversion',
    );
  }

  /**
   * Handles conversion progress updates
   */
  private handleConversionProgress(message: ArchicadMessage): void {
    if (!message.jobId) return;

    const progress = Math.max(0, Math.min(100, message.progress || 0));
    const status = this.mapArchicadStatus(message.status || 'processing');

    wsManager.updateProgress(
      message.jobId,
      progress,
      status,
      message.message || `Converting... ${progress}%`,
    );
  }

  /**
   * Handles successful conversion completion
   */
  private handleConversionCompleted(message: ArchicadMessage): void {
    if (!message.jobId) return;

    console.log(`Archicad conversion completed for job ${message.jobId}`);

    wsManager.completeJob(message.jobId, {
      downloadUrl: message.result?.outputPath,
      fileName: message.result?.fileName,
    });
  }

  /**
   * Handles conversion errors
   */
  private handleConversionError(message: ArchicadMessage): void {
    if (!message.jobId) return;

    console.error(
      `Archicad conversion failed for job ${message.jobId}: ${message.error || message.message}`,
    );

    wsManager.handleJobError(
      message.jobId,
      message.error || message.message || 'Archicad conversion failed',
    );
  }

  /**
   * Handles conversion cancellation
   */
  private handleConversionCancelled(message: ArchicadMessage): void {
    if (!message.jobId) return;

    console.log(`Archicad conversion cancelled for job ${message.jobId}`);

    wsManager.updateProgress(
      message.jobId,
      0,
      ConversionStatus.CANCELLED,
      'Conversion cancelled by Archicad plugin',
    );
  }

  /**
   * Handles Archicad plugin disconnection
   */
  private handleArchicadDisconnect(): void {
    console.log('Archicad plugin disconnected');
    this.archicadSocket = null;
    this.connected = false;
  }

  /**
   * Sends a command to Archicad plugin
   */
  sendCommand(command: ArchicadCommand): boolean {
    if (!this.archicadSocket || !this.connected) {
      console.warn('Cannot send command to Archicad - not connected');
      return false;
    }

    try {
      this.archicadSocket.send(JSON.stringify(command));
      console.log(
        `Sent command to Archicad: ${command.command} (Job: ${command.jobId})`,
      );
      return true;
    } catch (error) {
      console.error('Failed to send command to Archicad:', error);
      return false;
    }
  }

  /**
   * Starts PLN to IFC conversion
   */
  startConversion(
    jobId: string,
    plnPath: string,
    outputPath?: string,
  ): boolean {
    return this.sendCommand({
      command: 'start_conversion',
      jobId,
      plnPath,
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
   * Gets current plugin status
   */
  getStatus(jobId: string = 'status-check'): boolean {
    return this.sendCommand({
      command: 'get_status',
      jobId,
    });
  }

  /**
   * Checks if Archicad plugin is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Maps Archicad status strings to Node.js ConversionStatus enum
   */
  private mapArchicadStatus(archicadStatus: string): ConversionStatus {
    const statusMap: Record<string, ConversionStatus> = {
      queued: ConversionStatus.QUEUED,
      uploading: ConversionStatus.UPLOADING,
      processing: ConversionStatus.PROCESSING,
      downloading: ConversionStatus.DOWNLOADING,
      completed: ConversionStatus.COMPLETED,
      error: ConversionStatus.ERROR,
      cancelled: ConversionStatus.CANCELLED,
    };

    return (
      statusMap[archicadStatus.toLowerCase()] || ConversionStatus.PROCESSING
    );
  }
}

/**
 * Singleton instance of ArchicadPluginManager
 */
export const archicadPlugin = new ArchicadPluginManager();
