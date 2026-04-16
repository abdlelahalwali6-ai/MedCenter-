/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'admin' | 'doctor' | 'nurse' | 'pharmacist' | 'lab_tech' | 'radiologist' | 'receptionist' | 'patient';

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
  createdAt: any;
}

export interface Patient {
  id: string;
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
  createdAt: any;
  updatedAt: any;
}

export interface Appointment {
  id: string;
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
  createdAt: any;
}

export interface MedicalRecord {
  id: string;
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
  createdAt: any;
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  doctorId: string;
  date: any;
  medications: Medication[];
  status: 'pending' | 'dispensed' | 'cancelled';
  notes?: string;
  createdAt: any;
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

export interface LabRequest {
  id: string;
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
  createdAt: any;
}

export interface RadiologyRequest {
  id: string;
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
  createdAt: any;
}

export interface InventoryItem {
  id: string;
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
  updatedAt: any;
}

export interface BillItem {
  description: string;
  amount: number;
  quantity: number;
}

export interface Bill {
  id: string;
  patientId: string;
  patientName: string;
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
  createdAt: any;
  updatedAt: any;
}

export interface LabCatalogItem {
  id: string;
  name: string;
  category: string;
  price: number;
  items: {
    name: string;
    unit: string;
    normalRange: string;
  }[];
  createdAt: any;
  updatedAt: any;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  content: string;
  read: boolean;
  createdAt: any;
}

export interface ServiceCatalogItem {
  id: string;
  name: string;
  category: string;
  price: number;
  description?: string;
  createdAt: any;
  updatedAt: any;
}

export interface ServiceRequest {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  serviceId: string;
  serviceName: string;
  price: number;
  status: 'pending' | 'completed' | 'cancelled';
  billed?: boolean;
  notes?: string;
  createdAt: any;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  entityType: 'patient' | 'record' | 'bill' | 'prescription' | 'lab' | 'radiology' | 'inventory' | 'user' | 'appointment';
  entityId: string;
  details: string;
  metadata?: any;
  createdAt: any;
}
