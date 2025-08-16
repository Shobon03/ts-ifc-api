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

import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';

type DropzoneProps = React.ComponentProps<'div'> & {
  title: string;
  subtitle?: string;
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // em bytes
  onFilesSelect?: (files: File[]) => void;
  onError?: (error: string) => void;
};

function Dropzone({
  title,
  subtitle,
  className,
  accept = '.rvt,.pln',
  multiple = false,
  maxSize = 100 * 1024 * 1024, // 100MB default
  onFilesSelect,
  onError,
  ...props
}: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFiles = useCallback(
    (files: File[]) => {
      const validFiles: File[] = [];
      const errors: string[] = [];

      for (const file of files) {
        // Verificar tamanho
        if (file.size > maxSize) {
          errors.push(
            `${file.name} é muito grande (máx: ${Math.round(maxSize / 1024 / 1024)}MB)`,
          );
          continue;
        }

        // Verificar tipo de arquivo se accept foi especificado
        if (accept && accept !== '*') {
          const acceptedTypes = accept.split(',').map((type) => type.trim());
          const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;

          if (
            !acceptedTypes.some(
              (type) =>
                type === fileExtension ||
                file.type.match(type.replace('*', '.*')),
            )
          ) {
            errors.push(`${file.name} não é um tipo de arquivo aceito`);
            continue;
          }
        }

        validFiles.push(file);
      }

      if (errors.length > 0) {
        onError?.(errors.join(', '));
      }

      return validFiles;
    },
    [accept, maxSize, onError],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;

      const fileArray = Array.from(files);
      const validFiles = validateFiles(fileArray);

      if (validFiles.length > 0) {
        setSelectedFiles(
          multiple ? [...selectedFiles, ...validFiles] : validFiles,
        );
        onFilesSelect?.(validFiles);
      }
    },
    [validateFiles, multiple, selectedFiles, onFilesSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      handleFiles(files);
    },
    [handleFiles],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
    },
    [handleFiles],
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const removeFile = useCallback(
    (index: number) => {
      const newFiles = selectedFiles.filter((_, i) => i !== index);
      setSelectedFiles(newFiles);
    },
    [selectedFiles],
  );

  return (
    <div className={className} {...props}>
      <Label>{title}</Label>
      {subtitle && (
        <p className='mb-2 text-sm text-muted-foreground'>{subtitle}</p>
      )}

      <button
        type='button'
        className={cn(
          'mt-1 flex justify-center rounded-md border-2 border-dashed px-6 pt-5 pb-6 transition-colors cursor-pointer',
          isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50',
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <div className='space-y-1 text-center'>
          <svg
            className={cn(
              'mx-auto h-12 w-12 transition-colors',
              isDragOver ? 'text-primary' : 'text-muted-foreground',
            )}
            stroke='currentColor'
            fill='none'
            viewBox='0 0 48 48'
            aria-hidden='true'
          >
            <path
              d='M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 16h.02'
              strokeWidth={2}
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>

          <div className='flex text-sm text-muted-foreground'>
            <span className='font-medium text-primary hover:text-primary/80'>
              {isDragOver ? 'Solte os arquivos aqui' : 'Clique para selecionar'}
            </span>
            <p className='pl-1'>ou arraste e solte</p>
          </div>

          <p className='text-xs text-muted-foreground'>
            Arquivos BIM (.rvt, .pln) até {Math.round(maxSize / 1024 / 1024)}MB
          </p>
        </div>
      </button>

      {/* Input oculto */}
      <Input
        ref={fileInputRef}
        type='file'
        className='sr-only'
        accept={accept}
        multiple={multiple}
        onChange={handleFileInputChange}
      />

      {/* Lista de arquivos selecionados */}
      {selectedFiles.length > 0 && (
        <div className='mt-4 space-y-2'>
          <Label>Arquivos selecionados:</Label>
          {selectedFiles.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className='flex items-center justify-between p-2 bg-muted/50 rounded-md'
            >
              <div className='flex items-center space-x-2'>
                <svg
                  className='h-4 w-4 text-muted-foreground'
                  fill='currentColor'
                  viewBox='0 0 20 20'
                >
                  <title>Arquivo selecionado</title>
                  <path
                    fillRule='evenodd'
                    d='M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z'
                    clipRule='evenodd'
                  />
                </svg>
                <span className='text-sm font-medium'>{file.name}</span>
                <span className='text-xs text-muted-foreground'>
                  ({(file.size / 1024 / 1024).toFixed(1)} MB)
                </span>
              </div>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(index);
                }}
                className='text-muted-foreground hover:text-destructive transition-colors'
              >
                <svg
                  className='h-4 w-4'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <title>Remover arquivo</title>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { Dropzone };
