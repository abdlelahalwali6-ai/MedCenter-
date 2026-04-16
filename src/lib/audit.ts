import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { AuditLog, UserProfile } from '../types';

export async function logAction(
  user: UserProfile | null,
  action: string,
  entityType: AuditLog['entityType'],
  entityId: string,
  details: string,
  metadata?: any
) {
  if (!user) return;

  try {
    await addDoc(collection(db, 'audit_logs'), {
      userId: user.uid,
      userName: user.displayName,
      userRole: user.role,
      action,
      entityType,
      entityId,
      details,
      metadata: metadata || {},
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Failed to log action:', error);
  }
}
