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

export const JobStatus = {
  QUEUED: 'queued',
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  DOWNLOADING: 'downloading',
  COMPLETED: 'completed',
  ERROR: 'error',
  CANCELLED: 'cancelled',
} as const;

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const PluginType = {
  REVIT: 'revit',
  ARCHICAD: 'archicad',
} as const;

export type PluginType = (typeof PluginType)[keyof typeof PluginType];

export const PluginStatus = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
} as const;

export type PluginStatus = (typeof PluginStatus)[keyof typeof PluginStatus];

export interface BaseMessage {
  type: string;
  timestamp?: string;
}

export interface JobMessage extends BaseMessage {
  jobId: string;
  status?: JobStatus;
  progress?: number;
  message?: string;
}

export interface ConvertArchicadToIFCRequest extends BaseMessage {
  type: 'convert_archicad_to_ifc';
  file: string | File;
  fileName: string;
  jobId?: string;
}

export interface ConvertIFCToRevitRequest extends BaseMessage {
  type: 'convert_ifc_to_revit';
  ifcPath: string;
  jobId?: string;
  outputPath?: string;
}

export interface ConvertIFCToArchicadRequest extends BaseMessage {
  type: 'convert_ifc_to_archicad';
  ifcPath: string;
  jobId?: string;
  outputPath?: string;
}

export interface GetJobStatusRequest extends BaseMessage {
  type: 'get_job_status';
  jobId: string;
}

export interface CancelJobRequest extends BaseMessage {
  type: 'cancel_job';
  jobId: string;
}

export interface ListJobsRequest extends BaseMessage {
  type: 'list_jobs';
}

export type ClientMessage =
  | ConvertArchicadToIFCRequest
  | ConvertIFCToRevitRequest
  | ConvertIFCToArchicadRequest
  | GetJobStatusRequest
  | CancelJobRequest
  | ListJobsRequest;

export interface ConnectionAckMessage extends BaseMessage {
  type: 'connection_ack';
  message: string;
  timestamp: string;
}

export interface JobCreatedMessage extends JobMessage {
  type: 'job_created';
  jobId: string;
  status: typeof JobStatus.QUEUED;
  message: string;
  timestamp: string;
}

export interface ProgressUpdateMessage extends JobMessage {
  type: 'progress_update';
  jobId: string;
  status: JobStatus;
  progress: number;
  message: string;
  details?: {
    plugin?: PluginType;
    currentStep?: string;
    [key: string]: any;
  };
  timestamp: string;
}

export interface JobCompletedMessage extends JobMessage {
  type: 'job_completed';
  jobId: string;
  status: typeof JobStatus.COMPLETED;
  progress: 100;
  message: string;
  result: {
    downloadUrl: string;
    fileName: string;
    fileSize: number;
    outputPath?: string;
  };
  timestamp: string;
}

export interface JobErrorMessage extends JobMessage {
  type: 'job_error';
  jobId: string;
  status: typeof JobStatus.ERROR;
  progress: number;
  error: string;
  message: string;
  timestamp: string;
}

export interface JobStatusMessage extends JobMessage {
  type: 'job_status';
  jobId: string;
  status: JobStatus;
  progress: number;
  message: string;
  fileName?: string;
  createdAt?: string;
  completedAt?: string;
  result?: {
    downloadUrl: string;
    fileName: string;
    fileSize: number;
  };
  timestamp: string;
}

export interface JobCancelledMessage extends JobMessage {
  type: 'job_cancelled';
  jobId: string;
  status: typeof JobStatus.CANCELLED;
  message: string;
  timestamp: string;
}

export interface JobsListMessage extends BaseMessage {
  type: 'jobs_list';
  jobs: Array<{
    jobId: string;
    status: JobStatus;
    progress: number;
    fileName?: string;
    createdAt: string;
    completedAt?: string;
  }>;
  timestamp: string;
}

export interface PluginStatusMessage extends BaseMessage {
  type: 'plugin_status';
  plugin: PluginType;
  status: PluginStatus;
  message?: string;
  version?: string;
  timestamp: string;
}

export interface ErrorMessage extends BaseMessage {
  type: 'error';
  error: string;
  message: string;
  code?: string;
  timestamp: string;
}

export type ServerMessage =
  | ConnectionAckMessage
  | JobCreatedMessage
  | ProgressUpdateMessage
  | JobCompletedMessage
  | JobErrorMessage
  | JobStatusMessage
  | JobCancelledMessage
  | JobsListMessage
  | PluginStatusMessage
  | ErrorMessage;

export type WebSocketMessage = ClientMessage | ServerMessage;

export interface ConversionJob {
  jobId: string;
  status: JobStatus;
  progress: number;
  message?: string;
  fileName?: string;
  createdAt?: string;
  completedAt?: string;
  result?: {
    downloadUrl: string;
    fileName: string;
    fileSize: number;
    outputPath?: string;
  };
  error?: string;
  details?: {
    plugin?: PluginType;
    currentStep?: string;
    [key: string]: any;
  };
}
