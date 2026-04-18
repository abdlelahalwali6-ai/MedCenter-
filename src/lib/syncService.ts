import { 
  collection, 
  query, 
  where, 
  getDocs, 
  setDoc, 
  doc, 
  Timestamp, 
  orderBy,
  limit,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { localDB } from './db';
import { toast } from 'sonner';

const SYNC_COLLECTIONS = [
  { name: 'patients', firestoreName: 'patients', roles: ['admin', 'doctor', 'nurse', 'receptionist', 'pharmacist', 'lab_tech', 'radiologist'] },
  { name: 'inventory', firestoreName: 'inventory', roles: ['admin', 'doctor', 'nurse', 'pharmacist', 'receptionist'] },
  { name: 'labRequests', firestoreName: 'lab_requests', patientFilter: 'patientId' },
  { name: 'appointments', firestoreName: 'appointments', patientFilter: 'patientId' },
  { name: 'medicalRecords', firestoreName: 'medical_records', patientFilter: 'patientId' },
  { name: 'prescriptions', firestoreName: 'prescriptions', patientFilter: 'patientId' },
  { name: 'radiologyRequests', firestoreName: 'radiology_requests', patientFilter: 'patientId' },
  { name: 'bills', firestoreName: 'bills', patientFilter: 'patientId' },
  { name: 'messages', firestoreName: 'messages' },
  { name: 'auditLogs', firestoreName: 'audit_logs', roles: ['admin', 'doctor', 'receptionist'] },
  { name: 'serviceRequests', firestoreName: 'service_requests', patientFilter: 'patientId' },
  { name: 'serviceCatalog', firestoreName: 'services_catalog' },
  { name: 'labCatalog', firestoreName: 'lab_catalog' }
];

export class SyncService {
  private static isSyncing = false;

  static async syncAll(userRole?: string, userId?: string) {
    if (this.isSyncing) return;
    if (!auth.currentUser) return;

    this.isSyncing = true;
    const start = Date.now();
    
    try {
      // 1. First sync deletions (to clean up Firestore)
      await this.syncDeletions();

      for (const col of SYNC_COLLECTIONS as any[]) {
        try {
          // If a collection has specific roles, verify permission before syncing
          if (col.roles) {
            if (!userRole || !col.roles.includes(userRole)) {
              console.log(`[Sync] Skipping collection ${col.name}: userRole ${userRole || 'missing'} is not authorized.`);
              continue;
            }
          }
          await this.syncCollection(col.name, col.firestoreName, userRole, userId, col.patientFilter);
        } catch (error) {
          console.error(`[Sync] Failed to sync collection ${col.name}:`, error);
          // Continue with next collection
        }
      }
      
      const duration = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`[Sync] Completed all collections in ${duration}s`);
    } catch (error) {
      console.error('[Sync] Error during global sync:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  private static async syncDeletions() {
    const deleted = await localDB.deletedItems.toArray();
    if (deleted.length === 0) return;

    console.log(`[Sync] Processing ${deleted.length} remote deletions`);
    const writeBatchObj = writeBatch(db);
    
    for (const item of deleted) {
      const col = SYNC_COLLECTIONS.find(c => c.name === item.collectionName);
      if (col) {
        const docRef = doc(db, col.firestoreName, item.id);
        writeBatchObj.delete(docRef);
      }
    }

    await writeBatchObj.commit();
    await localDB.deletedItems.clear();
  }

  private static async syncCollection(localName: string, firestoreName: string, userRole?: string, userId?: string, patientFilter?: string) {
    const meta = await localDB.syncMetaData.get(localName);
    const lastSynced = meta?.lastSynced || 0;
    const now = Date.now();

    try {
      // 1. Push local changes (Items updated locally since last sync)
      await this.pushLocalChanges(localName, firestoreName, lastSynced);

      // 2. Pull remote changes (Items updated in Firestore since last sync)
      await this.pullRemoteChanges(localName, firestoreName, lastSynced, userRole, userId, patientFilter);

      // 3. Update sync metadata
      await localDB.syncMetaData.put({ id: localName, lastSynced: now });
      
    } catch (error) {
      console.error(`[Sync] Error syncing ${localName}:`, error);
      throw error;
    }
  }

  private static async pushLocalChanges(localName: string, firestoreName: string, lastSynced: number) {
    const table = (localDB as any)[localName];
    // Find items updated after last sync
    // Standardizing on 'updatedAt' field. Some might be Firestore Timestamps or JS Dates
    const localItems = await table.toArray();
    
    const dirtyItems = localItems.filter((item: any) => {
      const updatedAt = this.getTimestampMs(item.updatedAt || item.createdAt);
      return updatedAt > lastSynced;
    });

    if (dirtyItems.length === 0) return;

    console.log(`[Sync] Pushing ${dirtyItems.length} changes to ${firestoreName}`);

    // Break into batches of 500 for Firestore
    for (let i = 0; i < dirtyItems.length; i += 500) {
      const batch = dirtyItems.slice(i, i + 500);
      const writeBatchObj = writeBatch(db);
      
      batch.forEach((item: any) => {
        const docRef = doc(db, firestoreName, item.id);
        const data = { ...item };
        // Clear properties that don't belong in Firestore if needed
        // Convert any JS Dates to Firestore Timestamps
        this.sanitizeForFirestore(data);
        writeBatchObj.set(docRef, data, { merge: true });
      });

      await writeBatchObj.commit();
    }
  }

  private static async pullRemoteChanges(localName: string, firestoreName: string, lastSynced: number, userRole?: string, userId?: string, patientFilter?: string) {
    const table = (localDB as any)[localName];
    const lastSyncedDate = new Date(lastSynced);
    
    let constraints = [
      where('updatedAt', '>', Timestamp.fromDate(lastSyncedDate)),
      orderBy('updatedAt', 'asc'),
      limit(1000)
    ];

    // If it's a patient, and the collection supports patient filtering, apply it
    if (userRole === 'patient' && patientFilter && userId) {
      constraints = [
        where(patientFilter, '==', userId),
        ...constraints
      ];
    }

    const q = query(
      collection(db, firestoreName),
      ...constraints
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return;

    console.log(`[Sync] Pulling ${snapshot.size} changes from ${firestoreName}`);

    const remoteItems = snapshot.docs.map(doc => {
      const data = doc.data();
      // Ensure ID is consistent
      data.id = doc.id;
      // Convert Firestore Timestamps back to whatever localDB expects (usually Date or Number)
      this.sanitizeFromFirestore(data);
      return data;
    });

    await table.bulkPut(remoteItems);
  }

  private static getTimestampMs(val: any): number {
    if (!val) return 0;
    if (val instanceof Timestamp) return val.toMillis();
    if (val instanceof Date) return val.getTime();
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return new Date(val).getTime();
    return 0;
  }

  private static sanitizeForFirestore(obj: any) {
    for (const key in obj) {
      const val = obj[key];
      if (val instanceof Date) {
        obj[key] = Timestamp.fromDate(val);
      } else if (typeof val === 'number' && (key === 'updatedAt' || key === 'createdAt' || key === 'date' || key === 'deletedAt')) {
        // Convert numbers that are definitely timestamps to Firestore Timestamps
        if (val > 1000000000000) { // Simple check for ms timestamp
          obj[key] = Timestamp.fromMillis(val);
        }
      } else if (typeof val === 'object' && val !== null) {
        this.sanitizeForFirestore(val);
      }
    }
  }

  private static sanitizeFromFirestore(obj: any) {
    for (const key in obj) {
      if (obj[key] instanceof Timestamp) {
        obj[key] = obj[key].toDate();
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.sanitizeFromFirestore(obj[key]);
      }
    }
  }
}
