import Dexie, { type Table } from 'dexie';
import { InventoryItem, LabRequest, Patient } from '@/src/types';

export class LocalDB extends Dexie {
  patients!: Table<Patient>;
  inventory!: Table<InventoryItem>;
  labRequests!: Table<LabRequest>;
  syncOutbox!: Table<{
    id?: number;
    type: 'create' | 'update' | 'delete';
    collection: string;
    data: any;
    docId: string;
    timestamp: number;
  }>;
  
  constructor() {
    super('HospitalLocalDB');
    this.version(2).stores({
      patients: 'id, name, phone, mrn',
      inventory: 'id, name, scientificName, barcode',
      labRequests: 'id, patientName, status',
      syncOutbox: '++id, type, collection, docId, timestamp'
    });
  }
}

export const localDB = new LocalDB();
