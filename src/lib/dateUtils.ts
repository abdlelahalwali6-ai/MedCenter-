/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Robustly converts any date-like value to a JavaScript Date object.
 * Handles Firestore Timestamps, plain objects with seconds/nanoseconds,
 * ISO strings, numbers, and existing Date objects.
 */
export function toDate(value: any): Date | null {
  if (!value) return null;

  // Firestore Timestamp or object with toDate method
  if (typeof value.toDate === 'function') {
    return value.toDate();
  }

  // Plain object from Firestore serialization { seconds, nanoseconds }
  if (typeof value.seconds === 'number') {
    return new Timestamp(value.seconds, value.nanoseconds || 0).toDate();
  }

  // JavaScript Date object
  if (value instanceof Date) {
    return value;
  }

  // String (ISO or other format)
  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  // Number (milliseconds)
  if (typeof value === 'number') {
    return new Date(value);
  }

  return null;
}

/**
 * Formats a date-like value into a localized Arabic string.
 */
export function formatArabicDate(value: any, options?: Intl.DateTimeFormatOptions): string {
  const date = toDate(value);
  if (!date) return '---';
  return date.toLocaleDateString('ar-SA', options);
}

/**
 * Formats a date-like value into a localized Arabic date and time string.
 */
export function formatArabicDateTime(value: any): string {
  const date = toDate(value);
  if (!date) return '---';
  return date.toLocaleString('ar-SA');
}
