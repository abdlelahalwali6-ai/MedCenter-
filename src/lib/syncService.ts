import { localDB } from './db';
import { db } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';

export async function processSyncOutbox() {
  const pendingChanges = await localDB.syncOutbox.orderBy('timestamp').toArray();
  
  if (pendingChanges.length === 0) return;

  console.log(`Processing ${pendingChanges.length} pending changes...`);

  for (const change of pendingChanges) {
    try {
      const docRef = doc(db, change.collection, change.docId);
      
      switch (change.type) {
        case 'create':
          await setDoc(docRef, {
            ...change.data,
            createdAt: change.data.createdAt || serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          break;
        case 'update':
          await updateDoc(docRef, {
            ...change.data,
            updatedAt: serverTimestamp()
          });
          break;
        case 'delete':
          await deleteDoc(docRef);
          break;
      }

      // If successful, remove from outbox
      if (change.id) {
        await localDB.syncOutbox.delete(change.id);
      }
      console.log(`Successfully synced ${change.type} for ${change.collection}/${change.docId}`);
    } catch (error) {
      console.error(`Failed to sync change ${change.id}:`, error);
      // Stop processing if we hit a network error, will retry later
      if (error instanceof Error && error.message.includes('offline')) {
        break;
      }
    }
  }
}

export async function addToOutbox(
  type: 'create' | 'update' | 'delete',
  collectionName: string,
  docId: string,
  data: any
) {
  await localDB.syncOutbox.add({
    type,
    collection: collectionName,
    docId,
    data,
    timestamp: Date.now()
  });
  
  // Try to process immediately if online
  if (navigator.onLine) {
    processSyncOutbox();
  }
}
