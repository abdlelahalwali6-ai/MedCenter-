/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export enum AuditEntityType {
  PATIENT = 'patient',
  APPOINTMENT = 'appointment',
  BILL = 'bill',
  PRESCRIPTION = 'prescription',
  LAB = 'lab',
  RADIOLOGY = 'radiology',
  INVENTORY = 'inventory',
  USER = 'user',
  SETTINGS = 'settings',
  CLINIC = 'clinic'
}

export interface ActivityLogParams {
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  entityType: AuditEntityType | string;
  entityId?: string;
  details: string;
}

/**
 * Logs a system activity for auditing and tracking.
 * Expected signature based on usage: logAction(profile, action, entityType, entityId, details)
 */
export async function logAction(
  profile: any,
  action: string,
  entityType: string,
  entityId: string,
  details: string,
  metadata: any = {}
) {
  try {
    if (!profile) return;
    
    await addDoc(collection(db, 'audit_logs'), {
      userId: profile.uid || profile.id,
      userName: profile.displayName || profile.name || 'Unknown',
      userRole: profile.role || 'user',
      action,
      entityType,
      entityId,
      details,
      metadata: metadata || {},
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}
