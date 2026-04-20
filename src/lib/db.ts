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
  ServiceRequest,
  UserProfile
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
  profiles!: Table<UserProfile>;
  
  constructor() {
    super('HospitalLocalDB');
    this.version(4).stores({
      patients: 'id, sync_status, last_modified, version, name, phone, mrn',
      inventory: 'id, sync_status, last_modified, version, name, scientificName, barcode',
      labRequests: 'id, sync_status, last_modified, version, patientId, status',
      appointments: 'id, sync_status, last_modified, version, patientId, doctorId, date, status',
      medicalRecords: 'id, sync_status, last_modified, version, patientId, doctorId',
      prescriptions: 'id, sync_status, last_modified, version, patientId, doctorId, status',
      radiologyRequests: 'id, sync_status, last_modified, version, patientId, status',
      bills: 'id, sync_status, last_modified, version, patientId, status',
      messages: 'id, sync_status, last_modified, version, senderId, receiverId',
      auditLogs: 'id, sync_status, last_modified, version, userId, entityType',
      serviceCatalog: 'id, sync_status, last_modified, version, name, category',
      labCatalog: 'id, sync_status, last_modified, version, name, category',
      serviceRequests: 'id, sync_status, last_modified, version, patientId, status',
      syncMetaData: 'id',
      counters: 'id',
      deletedItems: 'id, collectionName',
      profiles: 'uid, email, role'
    });
    
    // Ensure admin stub exists locally to help with initial identification
    this.ensureLocalAdmin();
  }

  private async ensureLocalAdmin() {
    try {
      const adminEmail = 'abdlelahalwali6@gmail.com';
      const existing = await this.profiles.where('email').equalsIgnoreCase(adminEmail).first();
      
      if (!existing) {
        // We use a temporary UID if we don't have one, but it will be updated during first sync/login
        await this.profiles.add({
          uid: 'admin-initial-uid', 
          email: adminEmail,
          displayName: 'مسؤول النظام (أمان)',
          role: 'admin',
          created_at: Date.now()
        });
        console.log("Local admin stub seeded.");
      }
    } catch (e) {
      console.error("Error seeding local admin:", e);
    }
  }
}

export const localDB = new LocalDB();
