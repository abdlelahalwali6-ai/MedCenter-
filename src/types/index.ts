/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'admin' | 'doctor' | 'nurse' | 'pharmacist' | 'lab_tech' | 'radiologist' | 'receptionist' | 'patient';
export type SyncStatus = 'pending' | 'synced' | 'failed';

export interface BaseSyncable {
  id: string;
  sync_status: SyncStatus;
  version: number;
  last_modified: any;
  owner_id?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  photoURL?: string;
  phoneNumber?: string;
  specialization?: string; // For doctors
  department?: string;
  consultationFee?: number;
  freeFollowUps?: number;
  availableDays?: string[];
  workingHours?: {
    start: string;
    end: string;
  };
  created_at: any;
}

export interface Patient extends BaseSyncable {
  mrn: string; // Medical Record Number (Sequential)
  name: string;
  age?: number | string;
  dateOfBirth: string;
  gender: 'male' | 'female';
  phone: string;
  email?: string;
  address?: string;
  bloodType?: string;
  allergies?: string[];
  insuranceProvider?: string;
  insuranceNumber?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  created_at: any;
}

export interface Appointment extends BaseSyncable {
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  date: any; // Timestamp
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'checked-in' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
  type: 'consultation' | 'follow-up' | 'emergency' | 'procedure';
  reason?: string;
  notes?: string;
  created_at: any;
}

export interface MedicalRecord extends BaseSyncable {
  patientId: string;
  doctorId: string;
  date: any;
  vitals?: {
    height?: number;
    weight?: number;
    temperature?: number;
    bloodPressure?: string;
    heartRate?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
  };
  complaint: string;
  diagnosis: string;
  treatmentPlan: string;
  notes?: string;
  prescriptions?: string[]; // IDs
  labRequests?: string[]; // IDs
  radiologyRequests?: string[]; // IDs
  created_at: any;
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface Prescription extends BaseSyncable {
  patientId: string;
  doctorId: string;
  date: any;
  medications: Medication[];
  status: 'pending' | 'dispensed' | 'cancelled';
  notes?: string;
  created_at: any;
}

export interface LabTest {
  name: string;
  result?: string;
  unit?: string;
  referenceRange?: string;
  status: 'pending' | 'completed';
  items?: {
    name: string;
    result?: string;
    unit?: string;
    normalRange?: string;
  }[];
}

export interface LabRequest extends BaseSyncable {
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  date: any;
  tests: LabTest[];
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  notes?: string;
  technicianId?: string;
  completedAt?: any;
  created_at: any;
}

export interface RadiologyRequest extends BaseSyncable {
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  date: any;
  type: string; // X-Ray, MRI, CT, etc.
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  images?: string[]; // URLs
  report?: string;
  technicianId?: string;
  completedAt?: any;
  created_at: any;
}

export interface InventoryItem extends BaseSyncable {
  name: string;
  scientificName: string;
  commercialName?: string;
  barcode?: string;
  category: 'medication' | 'supply' | 'equipment';
  quantity: number;
  unit: string;
  minThreshold: number;
  expiryDate?: any;
  supplier?: string;
  price: number;
}

export interface BillItem {
  description: string;
  amount: number;
  quantity: number;
  serviceId?: string;
  costCenter?: string;
}

export interface Bill extends BaseSyncable {
  patientId: string;
  patientName: string;
  doctorId?: string;
  doctorName?: string;
  costCenter?: string;
  date: any;
  items: BillItem[];
  description?: string;
  totalAmount: number;
  taxAmount: number;
  discountAmount: number;
  finalAmount: number;
  paidAmount: number;
  status: 'unpaid' | 'partially-paid' | 'paid' | 'void';
  paymentMethod?: 'cash' | 'card' | 'insurance' | 'bank-transfer';
  type: 'pharmacy' | 'lab' | 'radiology' | 'clinic' | 'other';
  insuranceProvider?: string;
  insuranceCoverage?: number; // percentage
  created_at: any;
}

export interface LabCatalogItem extends BaseSyncable {
  name: string;
  category: string;
  price: number;
  costCenter?: string;
  items: {
    name: string;
    unit: string;
    normalRange: string;
  }[];
  created_at: any;
}

export interface Message extends BaseSyncable {
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  content: string;
  read: boolean;
  created_at: any;
}

export interface ServiceCatalogItem extends BaseSyncable {
  name: string;
  category: string;
  price: number;
  costCenter?: string;
  description?: string;
  created_at: any;
}

export interface ServiceRequest extends BaseSyncable {
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  serviceId: string;
  serviceName: string;
  price: number;
  costCenter?: string;
  status: 'pending' | 'completed' | 'cancelled';
  billed?: boolean;
  notes?: string;
  created_at: any;
}

export interface AuditLog extends BaseSyncable {
    userId: string;
    userName: string;
    userRole: UserRole;
    action: string;
    entityType: 'patient' | 'record' | 'bill' | 'prescription' | 'lab' | 'radiology' | 'inventory' | 'user' | 'appointment';
    entityId: string;
    details: string;
    metadata?: any;
    created_at: any;
}