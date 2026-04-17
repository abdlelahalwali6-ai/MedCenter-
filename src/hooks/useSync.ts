import { useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { localDB } from '@/src/lib/db';
import { Patient, InventoryItem, LabRequest } from '@/src/types';
import { processSyncOutbox } from '@/src/lib/syncService';

export function useSync() {
  useEffect(() => {
    // Process outbox on mount and when coming online
    processSyncOutbox();
    
    const handleOnline = () => {
      console.log('App is online, processing outbox...');
      processSyncOutbox();
    };

    window.addEventListener('online', handleOnline);

    // 1. Sync Patients
    // 1. Sync Patients
    const unsubPatients = onSnapshot(query(collection(db, 'patients'), orderBy('createdAt', 'desc')), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Patient[];
      localDB.patients.bulkPut(data);
    });

    // 2. Sync Inventory
    const unsubInventory = onSnapshot(collection(db, 'inventory'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InventoryItem[];
      localDB.inventory.bulkPut(data);
    });

    // 3. Sync Lab Requests
    const unsubLab = onSnapshot(collection(db, 'lab_requests'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LabRequest[];
      localDB.labRequests.bulkPut(data);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      unsubPatients();
      unsubInventory();
      unsubLab();
    };
  }, []);
}
