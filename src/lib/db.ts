import Dexie, { type Table } from 'dexie';
import { 
  InventoryItem, 
  LabRequest, 
  Patient, 
  Appointment, 
  MedicalRecord, 
  Prescription, 
  RadiologyRequest, 
  Bill, 
  Message, 
  AuditLog, 
  ServiceCatalogItem, 
  LabCatalogItem,
  ServiceRequest 
} from '@/src/types';

export class LocalDB extends Dexie {
  patients!: Table<Patient>;
  inventory!: Table<InventoryItem>;
  labRequests!: Table<LabRequest>;
  appointments!: Table<Appointment>;
  medicalRecords!: Table<MedicalRecord>;
  prescriptions!: Table<Prescription>;
  radiologyRequests!: Table<RadiologyRequest>;
  bills!: Table<Bill>;
  messages!: Table<Message>;
  auditLogs!: Table<AuditLog>;
  serviceCatalog!: Table<ServiceCatalogItem>;
  labCatalog!: Table<LabCatalogItem>;
  serviceRequests!: Table<ServiceRequest>;
  syncMetaData!: Table<{ id: string; lastSynced: number }>;
  counters!: Table<{ id: string; value: number }>;
  deletedItems!: Table<{ id: string; collectionName: string; deletedAt: number }>;
  
  constructor() {
    super('HospitalLocalDB');
    this.version(2).stores({
      patients: 'id, name, phone, mrn',
      inventory: 'id, name, scientificName, barcode',
      labRequests: 'id, patientId, status',
      appointments: 'id, patientId, doctorId, date, status',
      medicalRecords: 'id, patientId, doctorId',
      prescriptions: 'id, patientId, doctorId, status',
      radiologyRequests: 'id, patientId, status',
      bills: 'id, patientId, status',
      messages: 'id, senderId, receiverId',
      auditLogs: 'id, userId, entityType',
      serviceCatalog: 'id, name, category',
      labCatalog: 'id, name, category',
      serviceRequests: 'id, patientId, status',
      syncMetaData: 'id',
      counters: 'id',
      deletedItems: 'id, collectionName'
    });
  }
}

export const localDB = new LocalDB();
