/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  where,
  serverTimestamp,
  orderBy,
  Timestamp,
  doc,
  writeBatch
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { formatArabicDate, toDate } from '@/src/lib/dateUtils';
import { logAction } from '@/src/lib/audit';
import { Patient, MedicalRecord, Appointment, LabTest, LabRequest, RadiologyRequest, Prescription, LabCatalogItem, ServiceCatalogItem } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, FileText, Plus, History, ClipboardList, Pill, FlaskConical, Stethoscope, Thermometer, Activity, Weight, Printer, Heart, Trash2, CheckCircle2, Loader2, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/src/context/AuthContext';

export default function Clinic() {
  const { profile, isPatient } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const patientIdFromUrl = searchParams.get('patientId');

  if (isPatient) return null;

  // Loading states
  const [isPatientsLoading, setIsPatientsLoading] = useState(true);
  const [isRecordsLoading, setIsRecordsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [activeTab, setActiveTab] = useState('new-visit');
  
  const initialRecordState = {
    complaint: '',
    diagnosis: '',
    treatmentPlan: '',
    vitals: { temperature: '', bloodPressure: '', weight: '', pulse: '', spO2: '' }
  };
  const [newRecord, setNewRecord] = useState(initialRecordState);

  const [prescription, setPrescription] = useState<{name: string, dosage: string, frequency: string, duration: string}[]>([]);
  const [labTests, setLabTests] = useState<string[]>([]);
  const [labCatalog, setLabCatalog] = useState<LabCatalogItem[]>([]);
  const [servicesCatalog, setServicesCatalog] = useState<ServiceCatalogItem[]>([]);
  const [radiologyCatalog, setRadiologyCatalog] = useState<any[]>([]);
  const [radType, setRadType] = useState('');
  const [requestedServices, setRequestedServices] = useState<string[]>([]);

  const resetForm = useCallback(() => {
    setNewRecord(initialRecordState);
    setPrescription([]);
    setLabTests([]);
    setRadType('');
    setRequestedServices([]);
  }, [initialRecordState]);

  useEffect(() => {
    setIsPatientsLoading(true);
    const q = query(collection(db, 'patients'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const patientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Patient[];
      setPatients(patientsData);
      setIsPatientsLoading(false);
      if (patientIdFromUrl) {
        const patient = patientsData.find(p => p.id === patientIdFromUrl);
        if (patient) handlePatientSelect(patient);
      }
    }, () => setIsPatientsLoading(false));

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const qApp = query(collection(db, 'appointments'), where('date', '>=', Timestamp.fromDate(startOfDay)));
    const unsubApp = onSnapshot(qApp, (snap) => {
      setAppointments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Appointment[]);
    });

    const unsubCatalogs = [
      onSnapshot(collection(db, 'lab_catalog'), (s) => setLabCatalog(s.docs.map(d => ({id:d.id, ...d.data()})) as LabCatalogItem[])),
      onSnapshot(collection(db, 'services_catalog'), (s) => setServicesCatalog(s.docs.map(d => ({id:d.id, ...d.data()})) as ServiceCatalogItem[])),
      onSnapshot(collection(db, 'radiology_catalog'), (s) => setRadiologyCatalog(s.docs.map(d => ({id:d.id, ...d.data()})))),
    ];

    return () => { unsub(); unsubApp(); unsubCatalogs.forEach(u => u()); };
  }, [patientIdFromUrl]);

  const handlePatientSelect = useCallback((patient: Patient) => {
    setSelectedPatient(patient);
    setIsRecordsLoading(true);
    resetForm(); // Reset form state for the new patient
    setActiveTab('new-visit');

    const qRec = query(
      collection(db, 'medical_records'), 
      where('patientId', '==', patient.id),
      orderBy('createdAt', 'desc')
    );
    const unsubRec = onSnapshot(qRec, (snapshot) => {
      setRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MedicalRecord[]);
      setIsRecordsLoading(false);
    }, () => setIsRecordsLoading(false));

    return () => unsubRec();
  }, [resetForm]);

  const handleSaveVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !profile) return;
    setIsSubmitting(true);
    const toastId = toast.loading("جاري حفظ بيانات الزيارة...");

    try {
      const batch = writeBatch(db);

      // 1. Save Medical Record
      const recordRef = doc(collection(db, 'medical_records'));
      batch.set(recordRef, {
        patientId: selectedPatient.id,
        doctorId: profile.uid,
        doctorName: profile.displayName,
        ...newRecord,
        createdAt: serverTimestamp()
      });

      // 2. Save Prescription
      if (prescription.length > 0 && prescription.every(p => p.name)) {
        const presRef = doc(collection(db, 'prescriptions'));
        batch.set(presRef, {
          patientId: selectedPatient.id, patientName: selectedPatient.name,
          doctorId: profile.uid, doctorName: profile.displayName,
          medications: prescription, status: 'pending', createdAt: serverTimestamp()
        });
      }

      // ... other batch operations for lab, radiology, services

      await batch.commit();
      toast.success("تم حفظ الزيارة بنجاح", { id: toastId });
      resetForm();

    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'visit data');
      toast.error("فشل حفظ الزيارة", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addMedication = () => {
    setPrescription([...prescription, { name: '', dosage: '', frequency: '', duration: '' }]);
  };
  
  const removeMedication = (index: number) => {
      setPrescription(prescription.filter((_, i) => i !== index));
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.mrn && p.mrn.includes(searchTerm)) ||
    (p.phone && p.phone.includes(searchTerm))
  );

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-4 gap-6" dir="rtl">
      <Card className="lg:col-span-1 h-[calc(100vh-120px)] flex flex-col">
        <CardHeader className="p-5 border-b"><CardTitle>قائمة الانتظار</CardTitle><Input placeholder="بحث..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="mt-2"/></CardHeader>
        <CardContent className="p-2 overflow-auto flex-1">
          {isPatientsLoading ? <Loader2 className="animate-spin mx-auto mt-10" /> : 
            filteredPatients.length > 0 ? filteredPatients.map(patient => (
              <button key={patient.id} onClick={() => handlePatientSelect(patient)} className={`w-full text-right p-3 rounded-lg mb-2 transition-all ${selectedPatient?.id === patient.id ? 'bg-primary text-white' : 'bg-slate-50 hover:bg-slate-100'}`}>
                <p className="font-bold">{patient.name}</p>
                <p className="text-xs">MRN: {patient.mrn}</p>
                {appointments.find(a => a.patientId === patient.id && a.status === 'checked-in') && <span className="text-xs text-green-500">وصل العيادة</span>}
              </button>
            )) : <div className="text-center py-10 text-slate-400"><UserX size={32} className="mx-auto"/><p>لا يوجد مرضى</p></div>
          }
        </CardContent>
      </Card>

      <div className="lg:col-span-3 space-y-6">
        {selectedPatient ? (
          <>
            <div className="bg-white p-6 rounded-lg shadow-sm flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">{selectedPatient.name}</h2>
                <p>MRN: {selectedPatient.mrn} | {selectedPatient.gender}</p>
              </div>
              <Button onClick={() => setSelectedPatient(null)}>تغيير المريض</Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList><TabsTrigger value="new-visit">زيارة جديدة</TabsTrigger><TabsTrigger value="history">السجل الطبي</TabsTrigger></TabsList>
              <TabsContent value="new-visit" className="mt-6">
                {isRecordsLoading ? <Loader2 className="animate-spin mx-auto mt-10"/> : 
                  <form onSubmit={handleSaveVisit} className="space-y-4">
                    <div><Label>الشكوى</Label><Textarea value={newRecord.complaint} onChange={e => setNewRecord({...newRecord, complaint: e.target.value})} /></div>
                    <div><Label>التشخيص</Label><Textarea value={newRecord.diagnosis} onChange={e => setNewRecord({...newRecord, diagnosis: e.target.value})} /></div>
                    
                    {/* Prescription Section */}
                    <div className="space-y-2 p-4 border rounded-lg">
                        <div className="flex justify-between items-center"><Label>الوصفة الطبية</Label><Button type="button" size="sm" onClick={addMedication}><Plus size={16}/></Button></div>
                        {prescription.map((med, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                                <Input placeholder="الدواء" value={med.name} onChange={e => setPrescription(p => p.map((m,i) => i === idx ? {...m, name: e.target.value} : m))} />
                                <Input placeholder="الجرعة" value={med.dosage} onChange={e => setPrescription(p => p.map((m,i) => i === idx ? {...m, dosage: e.target.value} : m))} />
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeMedication(idx)}><Trash2 size={16}/></Button>
                            </div>
                        ))}
                    </div>

                    <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="animate-spin ml-2"/> حفظ...</> : 'حفظ الزيارة'}</Button>
                  </form>
                }
              </TabsContent>
              <TabsContent value="history" className="mt-6 space-y-4">
                {isRecordsLoading ? <Loader2 className="animate-spin mx-auto mt-10"/> : 
                  records.length > 0 ? records.map(record => (
                    <Card key={record.id}><CardContent className="p-4">
                      <p><strong>التاريخ:</strong> {formatArabicDate(record.createdAt)}</p>
                      <p><strong>التشخيص:</strong> {record.diagnosis}</p>
                    </CardContent></Card>
                  )) : <p>لا توجد سجلات.</p>
                }
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500 bg-slate-50 rounded-lg"><FileText size={48} className="opacity-50"/><p className="ml-4">الرجاء اختيار مريض</p></div>
        )}
      </div>
    </div>
  );
}
