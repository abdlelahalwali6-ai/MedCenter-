import Dexie, { type Table } from 'dexie';
import { InventoryItem, LabRequest, Patient } from '@/src/types';

export class LocalDB extends Dexie {
  patients!: Table<Patient>;
  inventory!: Table<InventoryItem>;
  labRequests!: Table<LabRequest>;
  
  constructor() {
    super('HospitalLocalDB');
    this.version(1).stores({
      patients: 'id, name, phone, mrn',
      inventory: 'id, name, scientificName, barcode',
      labRequests: 'id, patientName, status'
    });
  }
}

export const localDB = new LocalDB();
