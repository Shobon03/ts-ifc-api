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

import { promises as fs } from 'node:fs';
import { basename, extname, join, resolve as resolvePath } from 'node:path';

// Use the public/conversion directory for staging files
const CONVERSION_ROOT = join(process.cwd(), 'public', 'conversion');

function sanitizeComponent(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Stages a file in the conversion directory.
 * Creates a job-specific directory and saves the file buffer.
 * Directory structure: public/conversion/{jobId}/{sanitized-filename}
 * @param jobId - The unique job identifier
 * @param originalName - The original filename
 * @param buffer - The file buffer to save
 * @returns The staged file path and size
 */
export async function stageFile(
  jobId: string,
  originalName: string,
  buffer: Buffer,
): Promise<{ stagedPath: string; size: number }> {
  const extension = extname(originalName) || '.bin';
  const baseName = basename(originalName, extension) || 'model';
  const safeBase = sanitizeComponent(baseName) || 'model';
  const safeJobSegment = sanitizeComponent(jobId) || 'job';
  const safeFilename = `${safeBase}${extension.toLowerCase()}`;

  // Create job-specific directory inside public/conversion/
  const jobDir = join(CONVERSION_ROOT, safeJobSegment);

  await fs.mkdir(jobDir, { recursive: true });

  const stagedPath = join(jobDir, safeFilename);
  await fs.writeFile(stagedPath, buffer);

  return {
    stagedPath: resolvePath(stagedPath),
    size: buffer.byteLength,
  };
}

/**
 * Removes a staged file and its job directory if empty
 * @param stagedPath - The path to the staged file
 */
export async function cleanupStagedFile(stagedPath: string): Promise<void> {
  try {
    await fs.unlink(stagedPath);

    // Try to remove the parent directory if it's empty
    const jobDir = resolvePath(stagedPath, '..');
    try {
      await fs.rmdir(jobDir);
    } catch {
      // Directory not empty or doesn't exist, ignore
    }
  } catch (error) {
    console.warn(
      `Failed to cleanup staged file ${stagedPath}: ${error instanceof Error ? error.message : error}`,
    );
  }
}

/**
 * Gets the conversion root directory path
 * @returns The absolute path to the conversion root directory
 */
export function getConversionRoot(): string {
  return CONVERSION_ROOT;
}

/**
 * Generates the output file path for a conversion job.
 * Creates the job directory if it doesn't exist.
 * @param jobId - The unique job identifier
 * @param originalName - The original input filename (e.g., "example.pln")
 * @param outputExtension - The desired output extension (e.g., ".ifc")
 * @returns The absolute path where the output file should be saved
 */
export async function prepareOutputPath(
  jobId: string,
  originalName: string,
  outputExtension: string,
): Promise<string> {
  const baseName = basename(originalName, extname(originalName)) || 'model';
  const safeBase = sanitizeComponent(baseName) || 'model';
  const safeJobSegment = sanitizeComponent(jobId) || 'job';
  const outputFilename = `${safeBase}${outputExtension.toLowerCase()}`;

  // Create job-specific directory inside public/conversion/
  const jobDir = join(CONVERSION_ROOT, safeJobSegment);
  await fs.mkdir(jobDir, { recursive: true });

  const outputPath = join(jobDir, outputFilename);
  return resolvePath(outputPath);
}
