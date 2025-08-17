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

/**
 * Enum representing the status of a conversion job.
 * This is used to track the progress and state of a conversion job.
 * @enum {string}
 * @property {string} QUEUED - The job is queued and waiting to be processed.
 * @property {string} UPLOADING - The job is currently uploading the file.
 * @property {string} PROCESSING - The job is being processed.
 * @property {string} DOWNLOADING - The job is downloading the converted file.
 * @property {string} COMPLETED - The job has been completed successfully.
 * @property {string} ERROR - The job encountered an error during processing.
 * @property {string} CANCELLED - The job was cancelled by the user.
 * @description This enum is used to manage the state of conversion jobs in the WebSocketManager.
 * It allows for easy tracking of job status and provides a clear understanding of the current state of
 * each job in the conversion process.
 */
export enum ConversionStatus {
  QUEUED = 'queued',
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  DOWNLOADING = 'downloading',
  COMPLETED = 'completed',
  ERROR = 'error',
  CANCELLED = 'cancelled',
}

/**
 * Interface representing the progress of a conversion job.
 * This interface is used to send real-time updates about the conversion job status to connected clients.
 * @interface ConversionProgress
 * @property {string} jobId - The unique identifier of the conversion job.
 * @property {ConversionStatus} status - The current status of the conversion job.
 * @property {number} progress - The progress percentage of the conversion job (0-100).
 * @property {string} message - A message providing additional information about the job status.
 * @property {any} [details] - Optional additional details about the job.
 * @property {string} [error] - Optional error message if the job encountered an error.
 * @property {Object} [result] - Optional result object containing information about the converted file.
 * @property {string} [result.downloadUrl] - The URL to download the converted file.
 * @property {string} [result.fileName] - The name of the converted file.
 * @property {number} [result.fileSize] - The size of the converted file in bytes.
 * @description This interface is used to standardize the format of progress updates sent over WebSocket connections.
 * It ensures that all clients receive consistent information about the status of their conversion jobs,
 * including any errors that may have occurred and the final result of the conversion.
 */
export interface ConversionProgress {
  jobId: string;
  status: ConversionStatus;
  progress: number;
  message: string;
  details?: any;
  error?: string;
  result?: {
    downloadUrl?: string;
    fileName?: string;
    fileSize?: number;
  };
}

/**
 * Interface representing a conversion job.
 * This interface is used to store information about a conversion job,
 * including its status, progress, and associated WebSocket connection.
 * @interface ConversionJob
 * @property {string} id - The unique identifier of the conversion job.
 * @property {ConversionStatus} status - The current status of the conversion job.
 * @property {number} progress - The progress percentage of the conversion job (0-100).
 * @property {string} fileName - The name of the file being converted.
 * @property {Date} startTime - The time when the conversion job started.
 * @property {Date} [endTime] - Optional The time when the conversion job ended, if applicable.
 * @property {string} [error] - Optional error message if the job encountered an error.
 * @property {string} [urn] - Optional URN of the converted file, if applicable.
 * @property {WebSocket} socket - The WebSocket connection associated with the conversion job.
 * @description This interface is used to manage conversion jobs in the WebSocketManager.
 * It allows for tracking the status and progress of each job, handling errors, and associating
 * WebSocket connections for real-time updates.
 */
export interface ConversionJob {
  id: string;
  status: ConversionStatus;
  progress: number;
  fileName: string;
  startTime: Date;
  endTime?: Date;
  error?: string;
  urn?: string;
  socket: WebSocket;
}

/**
 * WebSocketManager class to manage WebSocket connections.
 * This class is responsible for handling WebSocket connections, broadcasting messages,
 * and managing connected clients.
 */
class WebSocketManager {
  /**
   * Map to store active conversion jobs.
   * Each job is identified by a unique job ID and contains details about the conversion process.
   * @type {Map<string, ConversionJob>}
   * @private
   * @example
   * const job = {
   *   id: 'job-123',
   *   status: ConversionStatus.QUEUED,
   *   progress: 0,
   *   fileName: 'example.ifc',
   *   startTime: new Date(),
   *   socket: new WebSocket('ws://example.com/socket'),
   * };
   * this.jobs.set(job.id, job);
   * @see {@link ConversionJob}
   */
  private jobs: Map<string, ConversionJob> = new Map<string, ConversionJob>();

  /**
   * Map to store WebSocket connections.
   * Each key is a job ID, and the value is a set of WebSocket connections associated with that job.
   * This allows multiple clients to subscribe to the same job and receive updates.
   * @type {Map<string, Set<WebSocket>>}
   * @private
   * @example
   * const socket = new WebSocket('ws://example.com/socket');
   * this.sockets.set(socket.url, socket);
   * @see {@link WebSocket}
   * @description This map allows for efficient management of WebSocket connections,
   * enabling the server to send real-time updates to clients about the status of their conversion jobs
   * and handle disconnections gracefully.
   */
  private sockets: Map<string, Set<WebSocket>> = new Map<
    string,
    Set<WebSocket>
  >();

  /**
   * Handles job errors by updating the job status to ERROR and logging the error.
   * This method is called when a job encounters an error during processing.
   * @param {string} jobId - The unique identifier of the job that encountered an error.
   * @param {string} error - The error message describing the issue that occurred.
   * @example
   * this.handleJobError('job-123', 'File not found');
   * @description This method updates the job status to ERROR, sets the error message,
   * and marks the job as ended. It also sends a progress update to the associated WebSocket connection
   * to notify the client about the error. After handling the error, it cleanss up the job
   * from the internal maps after a delay to allow clients to receive the error message.
   * @see {@link ConversionJob}
   * @see {@link ConversionStatus}
   */
  handleJobError(jobId: string, error: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = ConversionStatus.ERROR;
    job.error = error;
    job.endTime = new Date();

    this.sendProgress(jobId, {
      jobId,
      status: ConversionStatus.ERROR,
      progress: 0,
      message: 'Conversion failed',
      error,
    });

    setTimeout(() => {
      this.cleanupJob(jobId);
    }, 30000);
  }

  /**
   * Handles WebSocket disconnections by updating the job status to CANCELLED if not completed.
   * This method is called when a WebSocket connection is closed unexpectedly.
   * @param {string} jobId - The unique identifier of the job associated with the disconnected socket.
   * @private
   * @example
   * this.handleSocketDisconnect('job-123');
   * @description This method checks if the job associated with the disconnected socket is still active.
   * If the job is not completed or in an error state, it updates the job status to CANCELLED and sets the end time.
   * This ensures that jobs are properly marked as cancelled when clients disconnect unexpectedly.
   * @see {@link ConversionJob}
   * @see {@link ConversionStatus}
   */
  private handleSocketDisconnect(jobId: string) {
    const job = this.jobs.get(jobId);
    if (
      job &&
      job.status !== ConversionStatus.COMPLETED &&
      job.status !== ConversionStatus.ERROR
    ) {
      job.status = ConversionStatus.CANCELLED;
      job.endTime = new Date();
    }
  }

  /**
   * Cleans up a job by removing it from the jobs and sockets maps.
   * This method is called after a job is completed, cancelled, or encounters an error.
   * @param {string} jobId - The unique identifier of the job to be cleaned up.
   * @private
   * @example
   * this.cleanupJob('job-123');
   * @description This method removes the job from the internal jobs map and the associated WebSocket
   * connection from the sockets map. This helps to free up resources and prevent memory leaks
   * by ensuring that completed or inactive jobs are no longer tracked. It also logs a message indicating that the job has been cleaned up.
   * @see {@link ConversionJob}
   */
  cleanupJob(jobId: string) {
    this.jobs.delete(jobId);
    this.sockets.delete(jobId);
    console.log(`Job ${jobId} cleaned up`);
  }

  /**
   * Generates a unique job ID.
   * This method creates a unique identifier for each conversion job.
   * @returns {string} A unique job ID string.
   * @example
   * const jobId = this.generateJobId();
   * console.log(jobId); // Outputs something like 'job-1627891234567-abc123xyz'
   * @description The generated job ID is a combination of the current timestamp and a random string.
   * This ensures that each job ID is unique and can be used to track individual conversion jobs.
   * The job ID is prefixed with 'job-' to clearly indicate that it is a job identifier.
   * @see {@link ConversionJob}
   */
  generateJobId(): string {
    return `job-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Creates a job without an initial socket (for REST API initiated jobs)
   * This method is used when a job is created via REST API and the WebSocket will connect later.
   * @param {string} fileName - The name of the file being converted.
   * @returns {string} The unique identifier of the newly created conversion job.
   * @example
   * const jobId = this.createJobWithoutSocket('example.rvt');
   * console.log(jobId); // Outputs something like 'job-1627891234567-abc123xyz'
   */
  createJobWithoutSocket(fileName: string): string {
    const jobId = this.generateJobId();

    const job: ConversionJob = {
      id: jobId,
      status: ConversionStatus.QUEUED,
      progress: 0,
      fileName,
      startTime: new Date(),
      socket: null as WebSocket, // Will be set when WebSocket connects
    };

    this.jobs.set(jobId, job);

    console.log(`Created job ${jobId} without socket for file ${fileName}`);

    // Send initial status for any future subscribers
    this.sendProgress(jobId, {
      jobId,
      status: ConversionStatus.QUEUED,
      progress: 0,
      message: 'Job queued for processing',
    });

    return jobId;
  }

  /**
   * Retrieves a conversion job by its ID.
   * This method looks up a job in the jobs map using the provided job ID.
   * @param {string} jobId - The unique identifier of the conversion job to retrieve.
   * @returns {ConversionJob | undefined} The ConversionJob object if found, otherwise undefined.
   * @example
   * const job = this.getJob('job-123');
   * if (job) {
   *   console.log(job.status); // Outputs the current status of the job
   * } else {
   *   console.log('Job not found');
   * }
   * @description This method is used to access the details of a specific conversion job,
   * allowing for tracking and management of the job's status and progress. If the job ID
   * does not exist in the jobs map, the method returns undefined. This is useful for checking the state of a job
   * or performing operations based on its current status.
   * @see {@link ConversionJob}
   */
  getJob(jobId: string): ConversionJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Retrieves all active conversion jobs.
   * This method filters the jobs map to return only those jobs that are not completed, errored, or cancelled.
   * @returns {ConversionJob[]} An array of active ConversionJob objects.
   * @example
   * const activeJobs = this.getActiveJobs();
   * activeJobs.forEach((job) => {
   *   console.log(`${job.id}: ${job.status}`);
   * });
   * @description This method is useful for monitoring the current workload of the conversion system,
   * allowing administrators or users to see which jobs are still in progress. It filters out jobs
   * that have reached a terminal state (COMPLETED, ERROR, CANCELLED) to provide a clear view of ongoing tasks.
   * @see {@link ConversionJob}
   */
  getActiveJobs(): ConversionJob[] {
    return Array.from(this.jobs.values()).filter(
      (job) =>
        job.status !== ConversionStatus.COMPLETED &&
        job.status !== ConversionStatus.ERROR &&
        job.status !== ConversionStatus.CANCELLED,
    );
  }

  /**
   * Cancels a conversion job by its ID.
   * This method updates the job status to CANCELLED and sends a progress update to the associated
   * WebSocket connection.
   * @param {string} jobId - The unique identifier of the conversion job to cancel.
   * @returns {boolean} True if the job was successfully cancelled, false if the job was not found or already completed.
   * @example
   * const success = this.cancelJob('job-123');
   * if (success) {
   *   console.log('Job cancelled successfully');
   * } else {
   *   console.log('Failed to cancel job (not found or already completed)');
   * }
   * @description This method checks if the job exists and is not already completed or in an error state.
   * If the job is active, it updates the status to CANCELLED, sets the end time, and sends a progress update
   * to notify the client of the cancellation. It returns true if the cancellation was successful,
   * or false if the job was not found or already in a terminal state.
   * @see {@link ConversionJob}
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (
      job.status === ConversionStatus.COMPLETED ||
      job.status === ConversionStatus.ERROR
    ) {
      return false;
    }

    job.status = ConversionStatus.CANCELLED;
    job.endTime = new Date();

    this.sendProgress(jobId, {
      jobId,
      status: ConversionStatus.CANCELLED,
      progress: 0,
      message: 'Job cancelled by user',
    });

    return true;
  }

  /**
   * Marks a conversion job as completed and sends a final progress update to the client.
   * This method updates the job status to COMPLETED, sets the progress to 100%, and records the end time.
   * It also sends a progress update to the associated WebSocket connection with the result details.
   * @param {string} jobId - The unique identifier of the conversion job to mark as completed.
   * @param {Object} result - An object containing details about the converted file.
   * @param {string} [result.downloadUrl] - The URL to download the converted file.
   * @param {string} [result.filename] - The name of the converted file.
   * @param {number} [result.fileSize] - The size of the converted file in bytes.
   * @example
   * this.completeJob('job-123', {
   *   downloadUrl: '/models/download/job-123',
   *   filename: 'converted_model.ifc',
   *   fileSize: 204800,
   * });
   * @description This method is called when a conversion job has been successfully completed.
   * It updates the job's status and progress, records the end time, and sends a final progress update
   * to the client with information about the converted file. This allows clients to receive real-time
   * updates about the completion of their conversion jobs and access the resulting files.
   */
  completeJob(
    jobId: string,
    result: {
      downloadUrl?: string;
      fileName?: string;
      fileSize?: number;
    },
  ) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.progress = 100;
    job.status = ConversionStatus.COMPLETED;
    job.endTime = new Date();

    this.sendProgress(jobId, {
      jobId,
      status: ConversionStatus.COMPLETED,
      progress: 100,
      message: 'Conversion completed successfully',
      result,
    });
  }

  /**
   * Subscribes a WebSocket connection to a specific job ID for receiving progress updates.
   * This method adds the WebSocket connection to the sockets map under the specified job ID.
   * It also sends the current job status to the client if the job exists.
   * @param {string} jobId - The unique identifier of the conversion job to subscribe to.
   * @param {WebSocket} socket - The WebSocket connection to subscribe for progress updates.
   * @example
   * this.subscribeToJob('job-123', socket);
   * @description This method allows clients to subscribe to real-time updates for a specific conversion job.
   * When a client subscribes, it is added to the sockets map under the job ID, enabling the server to send progress updates
   * directly to the client. If the job already exists, the current status is sent immediately to provide context.
   * The method also sets up an event listener to handle socket disconnections, ensuring that the client is unsubscribed
   * when the connection is closed.
   * @see {@link ConversionJob}
   * @see {@link WebSocket}
   */
  subscribeToJob(jobId: string, socket: WebSocket): void {
    // Validate socket state
    if (!socket || socket.readyState !== socket.OPEN) {
      console.warn(`Cannot subscribe invalid/closed socket to job ${jobId}`);
      return;
    }

    // Add to sockets map for multi-client support
    if (!this.sockets.has(jobId)) {
      this.sockets.set(jobId, new Set());
    }

    const socketSet = this.sockets.get(jobId);
    socketSet.add(socket);

    // Update the job's primary socket reference if it doesn't have one
    const job = this.jobs.get(jobId);
    if (job && !job.socket) {
      job.socket = socket;
    }

    console.log(
      `Socket subscribed to job ${jobId}. Total connections: ${socketSet.size}`,
    );

    // Send current job status if exists
    if (job) {
      const statusMessage = {
        type: 'status',
        jobId,
        status: job.status,
        progress: job.progress,
        message: job.error || `Job ${job.status}`,
        fileName: job.fileName,
        startTime: job.startTime.toISOString(),
        endTime: job.endTime?.toISOString(),
      };

      try {
        socket.send(JSON.stringify(statusMessage));
      } catch (error) {
        console.error(`Failed to send initial status to socket:`, error);
      }
    }

    // Handle socket disconnect
    socket.on('close', () => {
      this.unsubscribeFromJob(jobId, socket);
    });

    socket.on('error', (error) => {
      console.error(`Socket error for job ${jobId}:`, error);
      this.unsubscribeFromJob(jobId, socket);
    });
  }

  /**
   * Unsubscribes a WebSocket connection from a specific job ID.
   * This method removes the WebSocket connection from the sockets map under the specified job ID.
   * If there are no more connections for the job ID, it removes the job ID from the map.
   * @param {string} jobId - The unique identifier of the conversion job to unsubscribe from.
   * @param {WebSocket} socket - The WebSocket connection to unsubscribe from progress updates.
   * @private
   * @example
   * this.unsubscribeFromJob('job-123', socket);
   * @description This method is used to clean up WebSocket connections when a client disconnects
   * or no longer wishes to receive updates for a specific conversion job. It ensures that the
   * internal sockets map remains accurate and does not retain stale connections, which helps to
   * prevent memory leaks and unnecessary resource usage. It checks if the job ID exists in the map,
   * removes the specified socket, and deletes the job ID entry if there are no remaining connections.
   * @see {@link WebSocket}
   */
  private unsubscribeFromJob(jobId: string, socket: WebSocket): void {
    const jobSockets = this.sockets.get(jobId);
    if (jobSockets) {
      jobSockets.delete(socket);
      if (jobSockets.size === 0) {
        this.sockets.delete(jobId);
      }
    }
  }

  /**
   * Sends a progress update to the client via WebSocket.
   * This method serializes the progress object to JSON and sends it over the WebSocket connection.
   * @param {string} jobId - The unique identifier of the conversion job.
   * @param {ConversionProgress} progress - The progress update to send to the client.
   * @example
   * this.sendProgress('job-123', {
   *   jobId: 'job-123',
   *   status: ConversionStatus.PROCESSING,
   *   progress: 50,
   *   message: 'Conversion is halfway done',
   * });
   * @description This method checks if the WebSocket connection for the given job ID is open
   * before attempting to send the progress update. If the connection is not open, it silently
   * returns without sending the message. If an error occurs during the send operation,
   * it logs the error to the console. This ensures that clients receive real-time updates
   * about the status of their conversion jobs.
   * @see {@link ConversionProgress}
   */
  sendProgress(jobId: string, progress: ConversionProgress) {
    const jobSockets = this.sockets.get(jobId);
    if (!jobSockets) return;

    const message = JSON.stringify({
      type: 'progress',
      ...progress,
    });

    jobSockets.forEach((socket) => {
      if (socket.readyState === socket.OPEN) {
        try {
          socket.send(message);
        } catch (error) {
          console.error(`Failed to send progress for job ${jobId}:`, error);
          this.unsubscribeFromJob(jobId, socket);
        }
      } else {
        this.unsubscribeFromJob(jobId, socket);
      }
    });
  }

  /**
   * Updates the progress of a conversion job and sends a progress update to the client.
   * This method modifies the job's status and progress, and notifies the client via WebSocket.
   * @param {string} jobId - The unique identifier of the conversion job.
   * @param {number} progress - The current progress percentage of the job (0-100).
   * @param {ConversionStatus} status - The current status of the conversion job.
   * @param {string} message - A message providing additional information about the job status.
   * @param {any} [details] - Optional additional details about the job.
   * @example
   * this.updateProgress('job-123', 75, ConversionStatus.PROCESSING, 'Conversion is 75% complete');
   * @description This method updates the job's progress and status in the internal jobs map.
   * It then sends a progress update to the associated WebSocket connection to notify the client.
   * If the job reaches a terminal state (COMPLETED or ERROR), it schedules a cleanup of the job
   * after a 30-second delay to allow the client to receive the final update before the job is removed from tracking.
   * @see {@link ConversionJob}
   * @see {@link ConversionStatus}
   * @see {@link ConversionProgress}
   */
  updateProgress(
    jobId: string,
    progress: number,
    status: ConversionStatus,
    message: string,
    details?: any,
  ): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      console.warn(`Attempted to update non-existent job: ${jobId}`);
      return;
    }

    // Validate progress range
    const validProgress = Math.max(0, Math.min(100, progress));

    job.status = status;
    job.progress = validProgress;

    if (status === ConversionStatus.ERROR) {
      job.error = message;
      job.endTime = new Date();
    } else if (status === ConversionStatus.COMPLETED) {
      job.endTime = new Date();
      job.progress = 100; // Ensure completion is 100%
    }

    this.sendProgress(jobId, {
      jobId,
      status,
      progress: validProgress,
      message,
      details,
    });

    // Auto-cleanup terminal states
    if (
      status === ConversionStatus.COMPLETED ||
      status === ConversionStatus.ERROR ||
      status === ConversionStatus.CANCELLED
    ) {
      setTimeout(() => {
        this.cleanupJob(jobId);
      }, 30000);
    }
  }
}

/**
 * Manages WebSocket connections and broadcasts messages to all connected clients.
 */
export const wsManager = new WebSocketManager();
