/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, deleteApp, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile as authUpdateProfile } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, runTransaction, increment } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '@/firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

/**
 * Creates a new user account without logging out the current admin session.
 * Uses a secondary app instance for creation.
 */
export async function createNewUser(email: string, pass: string, name: string) {
  let secondaryApp: FirebaseApp | undefined;
  try {
    // Unique name for secondary app to avoid conflicts
    const secondaryAppName = `SecondaryApp_${Date.now()}`;
    secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);
    
    // Create the account
    const result = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
    
    // Set display name in auth
    await authUpdateProfile(result.user, { displayName: name });
    
    return result.user.uid;
  } finally {
    // Always clean up the secondary app
    if (secondaryApp) {
      await deleteApp(secondaryApp);
    }
  }
}

/**
 * Generates a sequential Medical Record Number (MRN)
 * Format: MC-00001
 */
export async function getNextMRN(): Promise<string> {
  const counterRef = doc(db, 'metadata', 'counters');
  
  return await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    let nextId = 1;
    
    if (counterDoc.exists()) {
      nextId = (counterDoc.data().patientCount || 0) + 1;
      transaction.update(counterRef, { patientCount: increment(1) });
    } else {
      transaction.set(counterRef, { patientCount: 1 });
    }
    
    return `MC-${nextId.toString().padStart(5, '0')}`;
  });
}

// Test connection to Firestore
async function testConnection() {
  try {
    // Attempt to fetch a non-existent doc to check connectivity
    await getDocFromServer(doc(db, '_connection_test_', 'ping'));
    console.log("Firestore connection successful.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Firestore connection failed: The client is offline. Please check your Firebase configuration or internet connection.");
    }
    // Other errors (like 403) are expected if rules are strict, but they mean we reached the server.
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
