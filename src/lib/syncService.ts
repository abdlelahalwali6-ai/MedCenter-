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
  writeBatch,
  onSnapshot,
  type Unsubscribe,
  getDoc
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { localDB } from './db';

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
  { name: 'labCatalog', firestoreName: 'lab_catalog' },
  { name: 'profiles', firestoreName: 'users', roles: ['admin'] } 
];

export class SyncService {
  private static isSyncing = false;
  private static listeners: Unsubscribe[] = [];
  private static lastSyncAttempt: number = 0;

  static async syncAll(userRole?: string, userId?: string) {
    if (this.isSyncing) return;
    if (!auth.currentUser) return;

    const now = Date.now();
    // Throttle manual syncAll to once every 5 seconds to prevent spam
    if (now - this.lastSyncAttempt < 5000) return;
    this.lastSyncAttempt = now;

    const effectiveRole = userRole || 'patient';
    const effectiveUserId = userId || auth.currentUser.uid;

    this.isSyncing = true;
    console.log(`[Sync] Starting full sync for ${effectiveRole} (${effectiveUserId})`);
    
    try {
      // 1. First sync deletions
      await this.syncDeletions().catch(e => console.error("[Sync] syncDeletions failed:", e));

      // 2. Iterate through collections
      for (const col of SYNC_COLLECTIONS as any[]) {
        try {
          if (col.roles) {
            if (!effectiveRole || !col.roles.includes(effectiveRole)) continue;
          }
          await this.syncCollection(col.name, col.firestoreName, effectiveRole, effectiveUserId, col.patientFilter);
        } catch (error) {
          console.error(`[Sync] Failed to sync ${col.name}:`, error);
        }
      }
      
      console.log(`[Sync] Full sync cycle completed.`);
    } catch (error) {
      console.error('[Sync] Global sync error:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  static startRealtimeSync(userRole?: string, userId?: string) {
    if (this.listeners.length > 0) return; // Already listening

    const effectiveRole = userRole || 'patient';
    const effectiveUserId = userId || auth.currentUser.uid;

    console.log(`[Sync] Initializing realtime listeners for ${effectiveRole}`);

    SYNC_COLLECTIONS.forEach(col => {
      // 1. Check authorization for this user role
      if (col.roles && !col.roles.includes(effectiveRole)) return;

      // 2. Set up query
      let constraints = [orderBy('last_modified', 'desc'), limit(50)];
      
      if (effectiveRole === 'patient' && col.patientFilter && effectiveUserId) {
        constraints.unshift(where(col.patientFilter, '==', effectiveUserId) as any);
      }

      const q = query(collection(db, col.firestoreName), ...constraints as any[]);

      // 3. Subscribe to snapshots
      const unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const remoteData = change.doc.data();
            remoteData.id = change.doc.id;
            this.sanitizeFromFirestore(remoteData);
            
            const table = (localDB as any)[col.name];
            const localData = await table.get(remoteData.id);
            
            // Conflict resolution
            if (!localData || (remoteData.version > localData.version) || 
                (remoteData.version === localData.version && this.getTimestampMs(remoteData.last_modified) > this.getTimestampMs(localData.last_modified))) {
                if(localData && localData.sync_status === 'pending') {
                    console.log(`[Sync] realtime: local ${col.name}/${remoteData.id} has pending changes, not overwriting`);
                    return;
                }
              await table.put(remoteData);
              console.log(`[Sync] realtime: updated local ${col.name}/${remoteData.id}`);
            }
          }
          if (change.type === 'removed') {
            await (localDB as any)[col.name].delete(change.doc.id);
            console.log(`[Sync] realtime: removed local ${col.name}/${change.doc.id}`);
          }
        });
      }, (error) => {
        console.error(`[Sync] Listener error for ${col.firestoreName}:`, error);
        if (error.code === 'permission-denied') {
          // Handle cleanup or notification?
        }
      });

      this.listeners.push(unsubscribe);
    });

    // Also trigger an immediate push of any pending local changes
    this.syncDeletions();
    SYNC_COLLECTIONS.forEach(col => {
      this.pushLocalChanges(col.name, col.firestoreName);
    });
  }

  static stopRealtimeSync() {
    console.log(`[Sync] Stopping all realtime listeners (${this.listeners.length})`);
    this.listeners.forEach(unsub => unsub());
    this.listeners = [];
  }

  /**
   * Pushes a specific item to Firestore immediately
   */
  static async pushItem(localName: string, item: any) {
    if (!auth.currentUser) return;
    
    const col = SYNC_COLLECTIONS.find(c => c.name === localName);
    if (!col) return;

    try {
      const docRef = doc(db, col.firestoreName, item.id);
      const data = { ...item, last_modified: Timestamp.now(), sync_status: 'synced', owner_id: auth.currentUser.uid };
      this.sanitizeForFirestore(data);
      await setDoc(docRef, data, { merge: true });
      
      // Update local with the new timestamp to keep in sync
      this.sanitizeFromFirestore(data);
      await (localDB as any)[localName].put(data);
      
      console.log(`[Sync] Successfully pushed item ${item.id} to ${col.firestoreName}`);
    } catch (error) {
      console.error(`[Sync] Failed to push item ${item.id}:`, error);
      // Mark as failed
      await (localDB as any)[localName].update(item.id, { sync_status: 'failed' });
    }
  }

  private static async syncDeletions() {
    const deleted = await localDB.deletedItems.toArray();
    if (deleted.length === 0) return;

    console.log(`[Sync] Pushing ${deleted.length} deletions to cloud`);
    
    for (const item of deleted) {
      const col = SYNC_COLLECTIONS.find(c => c.name === item.collectionName);
      if (col) {
        try {
          const docRef = doc(db, col.firestoreName, item.id);
          await setDoc(doc(db, 'deleted_vault', item.id), { ...item, syncedAt: Timestamp.now() }); // Optional: archive before delete
          await writeBatch(db).delete(docRef).commit();
          await localDB.deletedItems.delete(item.id);
        } catch (error) {
          if (error instanceof Error && error.message.includes('permission')) {
             await localDB.deletedItems.delete(item.id);
          }
        }
      }
    }
  }

  private static async syncCollection(localName: string, firestoreName: string, userRole?: string, userId?: string, patientFilter?: string) {
    const meta = await localDB.syncMetaData.get(localName);
    const lastSynced = meta?.lastSynced || 0;
    const now = Date.now();

    await this.pushLocalChanges(localName, firestoreName);
    await this.pullRemoteChanges(localName, firestoreName, lastSynced, userRole, userId, patientFilter);
    await localDB.syncMetaData.put({ id: localName, lastSynced: now });
  }

  private static async pushLocalChanges(localName: string, firestoreName: string) {
    const table = (localDB as any)[localName];
    if (!table) return;

    const dirtyItems = await table.where('sync_status').equals('pending').toArray();

    if (dirtyItems.length === 0) return;

    for (let i = 0; i < dirtyItems.length; i += 500) {
      const batch = dirtyItems.slice(i, i + 500);
      const writeBatchObj = writeBatch(db);
      
      batch.forEach((item: any) => {
        const docRef = doc(db, firestoreName, item.id);
        const data = { ...item, sync_status: 'synced', last_modified: Timestamp.now() };
        this.sanitizeForFirestore(data);
        writeBatchObj.set(docRef, data, { merge: true });
      });

      await writeBatchObj.commit();

      // Now update local items
      const updatedItems = batch.map(item => ({ ...item, sync_status: 'synced', last_modified: new Date() }));
      await table.bulkPut(updatedItems);
    }
  }

  private static async pullRemoteChanges(localName: string, firestoreName: string, lastSynced: number, userRole?: string, userId?: string, patientFilter?: string) {
    const table = (localDB as any)[localName];
    if (!table) return;

    const lastSyncedDate = new Date(lastSynced);
    let constraints = [
      where('last_modified', '>', Timestamp.fromDate(lastSyncedDate)),
      orderBy('last_modified', 'asc'),
      limit(2000)
    ];

    if (userRole === 'patient' && patientFilter && userId) {
      constraints.unshift(where(patientFilter, '==', userId) as any);
    }

    const q = query(collection(db, firestoreName), ...constraints as any[]);
    const snapshot = await getDocs(q);
    if (snapshot.empty) return;

    const remoteItems = snapshot.docs.map(doc => {
      const data = doc.data();
      data.id = doc.id;
      this.sanitizeFromFirestore(data);
      return data;
    });

    // Conflict resolution
    const localItems = await table.bulkGet(remoteItems.map(item => item.id));
    const itemsToPut = [];
    for(let i=0; i<remoteItems.length; i++) {
        const remoteItem = remoteItems[i];
        const localItem = localItems[i];
        if(!localItem || (remoteItem.version > localItem.version) || 
            (remoteItem.version === localItem.version && this.getTimestampMs(remoteItem.last_modified) > this.getTimestampMs(localItem.last_modified))) {
            if(localItem && localItem.sync_status === 'pending') {
                console.log(`[Sync] pull: local ${localName}/${remoteItem.id} has pending changes, not overwriting`);
                continue;
            }
            itemsToPut.push(remoteItem);
        }
    }

    if(itemsToPut.length > 0) {
        await table.bulkPut(itemsToPut);
    }
  }

  private static getTimestampMs(val: any): number {
    if (!val) return 0;
    if (val instanceof Timestamp) return val.toMillis();
    if (val instanceof Date) return val.getTime();
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const parsed = Date.parse(val);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  private static sanitizeForFirestore(obj: any) {
    for (const key in obj) {
      const val = obj[key];
      if (val instanceof Date) {
        obj[key] = Timestamp.fromDate(val);
      } else if (typeof val === 'number' && (key === 'last_modified' || key === 'created_at' || key === 'date')) {
        if (val > 1000000000) { 
          obj[key] = Timestamp.fromMillis(val < 10000000000 ? val * 1000 : val);
        }
      } else if (typeof val === 'object' && val !== null && !(val instanceof Timestamp)) {
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
