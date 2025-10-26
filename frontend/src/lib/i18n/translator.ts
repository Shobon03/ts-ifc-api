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

import messages from './messages.json';

type Language = 'pt-BR' | 'en-US';
type MessageCategory = keyof typeof messages;

/**
 * Get the current language from localStorage or default to pt-BR
 */
export function getCurrentLanguage(): Language {
  const stored = localStorage.getItem('language');
  if (stored === 'pt-BR' || stored === 'en-US') {
    return stored;
  }
  return 'pt-BR';
}

/**
 * Set the current language in localStorage
 */
export function setLanguage(lang: Language): void {
  localStorage.setItem('language', lang);
}

/**
 * Translate a message key to the current language
 * @param category - The message category (connection, job, plugin, etc.)
 * @param key - The message key within the category
 * @param fallback - Optional fallback text if key not found
 * @returns The translated message
 */
export function translate(
  category: MessageCategory,
  key: string,
  fallback?: string,
): string {
  const lang = getCurrentLanguage();
  const categoryMessages = messages[category];

  if (categoryMessages && typeof categoryMessages === 'object') {
    const message = categoryMessages[key as keyof typeof categoryMessages];
    if (message && typeof message === 'object' && lang in message) {
      return message[lang as keyof typeof message] as string;
    }
  }

  return fallback || key;
}

/**
 * Translate a raw English message from the backend to Portuguese
 * This function attempts to find matching translations based on common patterns
 */
export function translateBackendMessage(englishMessage: string): string {
  const lang = getCurrentLanguage();

  // If language is English, return as-is
  if (lang === 'en-US') {
    return englishMessage;
  }

  const lowerMessage = englishMessage.toLowerCase();

  // Try to find exact matches in all categories
  for (const category of Object.keys(messages) as MessageCategory[]) {
    const categoryMessages = messages[category];
    if (typeof categoryMessages !== 'object') continue;

    for (const key of Object.keys(categoryMessages)) {
      const message = categoryMessages[key as keyof typeof categoryMessages];
      if (typeof message === 'object' && 'en-US' in message) {
        const enMessage = message['en-US'] as string;
        if (enMessage.toLowerCase() === lowerMessage) {
          return message[lang] as string;
        }
      }
    }
  }

  // Pattern matching for common message types
  if (lowerMessage.includes('connected')) {
    return translate('connection', 'connected', englishMessage);
  }
  if (lowerMessage.includes('disconnected')) {
    return translate('connection', 'disconnected', englishMessage);
  }
  if (lowerMessage.includes('connecting')) {
    return translate('connection', 'connecting', englishMessage);
  }
  if (lowerMessage.includes('completed') || lowerMessage.includes('complete')) {
    return translate('job', 'completed', englishMessage);
  }
  if (lowerMessage.includes('processing')) {
    return translate('job', 'processing', englishMessage);
  }
  if (lowerMessage.includes('queued')) {
    return translate('job', 'queued', englishMessage);
  }
  if (lowerMessage.includes('failed') || lowerMessage.includes('error')) {
    return translate('job', 'failed', englishMessage);
  }
  if (lowerMessage.includes('downloading')) {
    return translate('progress', 'downloading', englishMessage);
  }
  if (lowerMessage.includes('uploading')) {
    return translate('progress', 'uploading', englishMessage);
  }
  if (
    lowerMessage.includes('converting') ||
    lowerMessage.includes('conversion')
  ) {
    return translate('progress', 'converting', englishMessage);
  }
  if (lowerMessage.includes('validating')) {
    return translate('progress', 'validating', englishMessage);
  }

  // If no match found, return original message
  return englishMessage;
}

/**
 * Translate plugin status messages
 */
export function translatePluginStatus(status: string): string {
  const lang = getCurrentLanguage();

  if (lang === 'en-US') {
    return status;
  }

  switch (status.toLowerCase()) {
    case 'connected':
      return translate('plugin', 'connected', status);
    case 'disconnected':
      return translate('plugin', 'disconnected', status);
    case 'connecting':
      return translate('plugin', 'connecting', status);
    case 'error':
      return translate('plugin', 'error', status);
    default:
      return status;
  }
}

/**
 * Translate job status messages
 */
export function translateJobStatus(status: string): string {
  const lang = getCurrentLanguage();

  if (lang === 'en-US') {
    return status;
  }

  switch (status.toLowerCase()) {
    case 'queued':
      return translate('job', 'queued', status);
    case 'processing':
      return translate('job', 'processing', status);
    case 'completed':
      return translate('job', 'completed', status);
    case 'failed':
      return translate('job', 'failed', status);
    case 'cancelled':
      return translate('job', 'cancelled', status);
    default:
      return status;
  }
}
