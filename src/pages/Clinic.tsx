/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  where,
  serverTimestamp,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { logAction } from '@/src/lib/audit';
import { Patient, MedicalRecord, Appointment, LabTest, LabRequest, RadiologyRequest, Prescription, LabCatalogItem, ServiceCatalogItem } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, FileText, Plus, History, ClipboardList, Pill, FlaskConical, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/src/context/AuthContext';

export default function Clinic() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const patientIdFromUrl = searchParams.get('patientId');

  if (profile?.role === 'patient') return null;

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [activeTab, setActiveTab] = useState('new-visit');
  
  const [newRecord, setNewRecord] = useState({
    complaint: '',
    diagnosis: '',
    treatmentPlan: '',
    vitals: {
      temperature: '',
      bloodPressure: '',
      weight: ''
    }
  });

  const [prescription, setPrescription] = useState<{name: string, dosage: string, frequency: string, duration: string}[]>([]);
  const [labTests, setLabTests] = useState<string[]>([]);
  const [labCatalog, setLabCatalog] = useState<LabCatalogItem[]>([]);
  const [servicesCatalog, setServicesCatalog] = useState<ServiceCatalogItem[]>([]);
  const [radiologyCatalog, setRadiologyCatalog] = useState<any[]>([]);
  const [radType, setRadType] = useState('');
  const [requestedServices, setRequestedServices] = useState<string[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'patients'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const patientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Patient[];
      setPatients(patientsData);
      
      // Auto-select patient from URL if provided
      if (patientIdFromUrl) {
        const patient = patientsData.find(p => p.id === patientIdFromUrl);
        if (patient) setSelectedPatient(patient);
      }
    });
    return () => unsub();
  }, [patientIdFromUrl]);

  useEffect(() => {
    if (selectedPatient) {
      const qRec = query(
        collection(db, 'medical_records'), 
        where('patientId', '==', selectedPatient.id),
        orderBy('createdAt', 'desc')
      );
      const unsubRec = onSnapshot(qRec, (snapshot) => {
        setRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MedicalRecord[]);
      });
      return () => unsubRec();
    }
  }, [selectedPatient]);

  useEffect(() => {
    const unsubCatalog = onSnapshot(collection(db, 'lab_catalog'), (snap) => {
      setLabCatalog(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LabCatalogItem[]);
    });
    
    const unsubServices = onSnapshot(collection(db, 'services_catalog'), (snap) => {
      setServicesCatalog(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ServiceCatalogItem[]);
    });

    const unsubRadiology = onSnapshot(collection(db, 'radiology_catalog'), (snap) => {
      setRadiologyCatalog(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    
    return () => { unsubCatalog(); unsubServices(); unsubRadiology(); };
  }, []);

  const handleSaveVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !profile) return;

    try {
      // 1. Save Medical Record
      const recordRef = await addDoc(collection(db, 'medical_records'), {
        patientId: selectedPatient.id,
        doctorId: profile.uid,
        doctorName: profile.displayName,
        ...newRecord,
        createdAt: serverTimestamp()
      });

      await logAction(
        profile,
        'إضافة سجل طبي',
        'record',
        recordRef.id,
        `زيارة جديدة للمريض: ${selectedPatient.name}`,
        { diagnosis: newRecord.diagnosis }
      );

      // 2. Save Prescription if any
      if (prescription.length > 0) {
        await addDoc(collection(db, 'prescriptions'), {
          patientId: selectedPatient.id,
          patientName: selectedPatient.name,
          doctorId: profile.uid,
          doctorName: profile.displayName,
          medications: prescription,
          status: 'pending',
          createdAt: serverTimestamp()
        });
      }

      // 3. Save Lab Request if any
      if (labTests.length > 0) {
        const selectedTests = labCatalog.filter(c => labTests.includes(c.id));
        await addDoc(collection(db, 'lab_requests'), {
          patientId: selectedPatient.id,
          patientName: selectedPatient.name,
          doctorId: profile.uid,
          doctorName: profile.displayName,
          tests: selectedTests.map(t => ({ 
            name: t.name, 
            status: 'pending',
            items: t.items || []
          })),
          status: 'pending',
          createdAt: serverTimestamp()
        });
      }

      // 4. Save Radiology Request if any
      if (radType) {
        await addDoc(collection(db, 'radiology_requests'), {
          patientId: selectedPatient.id,
          patientName: selectedPatient.name,
          doctorId: profile.uid,
          doctorName: profile.displayName,
          type: radType,
          status: 'pending',
          createdAt: serverTimestamp()
        });
      }

      // 5. Save Service Requests if any
      if (requestedServices.length > 0) {
        for (const serviceId of requestedServices) {
          const service = servicesCatalog.find(s => s.id === serviceId);
          if (service) {
            await addDoc(collection(db, 'service_requests'), {
              patientId: selectedPatient.id,
              patientName: selectedPatient.name,
              doctorId: profile.uid,
              doctorName: profile.displayName,
              serviceId: service.id,
              serviceName: service.name,
              price: service.price,
              status: 'pending',
              createdAt: serverTimestamp()
            });
          }
        }
      }

      // 6. Create Bill automatically
      let billAmount = profile.consultationFee || 150;
      let billDescription = 'رسوم كشفية طبية - ' + newRecord.diagnosis;

      // Check for free follow-up
      if (profile.freeFollowUps && profile.freeFollowUps > 0) {
        const recentRecords = records.filter(r => r.doctorId === profile.uid);
        if (recentRecords.length > 0 && recentRecords.length <= profile.freeFollowUps) {
          billAmount = 0;
          billDescription = 'زيارة عودة مجانية - ' + newRecord.diagnosis;
        }
      }

      // Add services to bill amount
      const selectedServices = servicesCatalog.filter(s => requestedServices.includes(s.id));
      const servicesTotal = selectedServices.reduce((acc, s) => acc + s.price, 0);
      billAmount += servicesTotal;
      if (selectedServices.length > 0) {
        billDescription += ' + خدمات: ' + selectedServices.map(s => s.name).join(', ');
      }

      // Add Lab tests to bill amount
      const selectedLabTests = labCatalog.filter(t => labTests.includes(t.id));
      const labTotal = selectedLabTests.reduce((acc, t) => acc + (t.price || 0), 0);
      billAmount += labTotal;
      if (selectedLabTests.length > 0) {
        billDescription += ' + فحوصات مخبرية: ' + selectedLabTests.map(t => t.name).join(', ');
      }

      // Add Radiology to bill amount
      const selectedRad = radiologyCatalog.find(r => r.id === radType || r.name === radType);
      if (selectedRad) {
        billAmount += selectedRad.price || 0;
        billDescription += ' + أشعة: ' + selectedRad.name;
      }

      await addDoc(collection(db, 'bills'), {
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        totalAmount: billAmount,
        description: billDescription,
        paymentMethod: 'cash',
        status: billAmount === 0 ? 'paid' : 'unpaid',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast.success('تم حفظ الزيارة والطلبات وإنشاء الفاتورة بنجاح');
      setNewRecord({ complaint: '', diagnosis: '', treatmentPlan: '', vitals: { temperature: '', bloodPressure: '', weight: '' } });
      setPrescription([]);
      setLabTests([]);
      setRequestedServices([]);
      setRadType('');
    } catch (error) {
      toast.error('فشل حفظ البيانات');
    }
  };

  const addMedication = () => {
    setPrescription([...prescription, { name: '', dosage: '', frequency: '', duration: '' }]);
  };

  const filteredPatients = patients.filter(p => 
    p.name.includes(searchTerm) || 
    (p.mrn && p.mrn.includes(searchTerm)) ||
    (p.phone && p.phone.includes(searchTerm))
  );

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-4 gap-6" dir="rtl">
      {/* Sidebar and Header same as before... */}
      <Card className="lg:col-span-1 h-[calc(100vh-180px)] flex flex-col">
        <CardHeader className="p-4 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <Search size={18} />
            البحث عن مريض
          </CardTitle>
          <Input 
            placeholder="الاسم أو الرقم الطبي أو الجوال..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="mt-2"
          />
        </CardHeader>
        <CardContent className="p-0 overflow-auto flex-1">
          {filteredPatients.map(patient => (
            <button
              key={patient.id}
              onClick={() => setSelectedPatient(patient)}
              className={`w-full text-right p-4 border-b hover:bg-muted transition-colors ${selectedPatient?.id === patient.id ? 'bg-sky-50 border-r-4 border-primary' : ''}`}
            >
              <p className="font-bold text-sm">{patient.name}</p>
              <p className="text-xs text-muted-foreground">{patient.mrn}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Main Clinical Area */}
      <div className="lg:col-span-3 space-y-6">
        {selectedPatient ? (
          <>
            <Card className="border-t-4 border-t-primary">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">{selectedPatient.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">الرقم الطبي: {selectedPatient.mrn} | الجوال: {selectedPatient.phone}</p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1"
                    onClick={() => setActiveTab('history')}
                  >
                    <History size={16} /> التاريخ المرضي
                  </Button>
                  <Button 
                    size="sm" 
                    className="gap-1"
                    onClick={() => setActiveTab('new-visit')}
                  >
                    <Plus size={16} /> إنشاء سجل طبي جديد
                  </Button>
                </div>
              </CardHeader>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4 h-12">
                <TabsTrigger value="new-visit" className="gap-2">
                  <Plus size={16} /> معاينة جديدة
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-2">
                  <ClipboardList size={16} /> السجلات السابقة
                </TabsTrigger>
                <TabsTrigger value="prescriptions" className="gap-2">
                  <Pill size={16} /> الوصفات
                </TabsTrigger>
                <TabsTrigger value="requests" className="gap-2">
                  <FlaskConical size={16} /> طلبات الفحص
                </TabsTrigger>
              </TabsList>

              <TabsContent value="new-visit" className="mt-6">
                <form onSubmit={handleSaveVisit} className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>الحرارة (°C)</Label>
                      <Input value={newRecord.vitals.temperature} onChange={e => setNewRecord({...newRecord, vitals: {...newRecord.vitals, temperature: e.target.value}})} />
                    </div>
                    <div className="space-y-2">
                      <Label>ضغط الدم</Label>
                      <Input value={newRecord.vitals.bloodPressure} onChange={e => setNewRecord({...newRecord, vitals: {...newRecord.vitals, bloodPressure: e.target.value}})} />
                    </div>
                    <div className="space-y-2">
                      <Label>الوزن (kg)</Label>
                      <Input value={newRecord.vitals.weight} onChange={e => setNewRecord({...newRecord, vitals: {...newRecord.vitals, weight: e.target.value}})} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>الشكوى الرئيسية</Label>
                    <Textarea 
                      placeholder="وصف شكوى المريض..." 
                      value={newRecord.complaint}
                      onChange={e => setNewRecord({...newRecord, complaint: e.target.value})}
                      className="min-h-[80px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>التشخيص</Label>
                    <Textarea 
                      placeholder="التشخيص الطبي..." 
                      value={newRecord.diagnosis}
                      onChange={e => setNewRecord({...newRecord, diagnosis: e.target.value})}
                    />
                  </div>

                  <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
                    <div className="flex justify-between items-center">
                      <Label className="text-lg font-bold">الوصفة الطبية</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addMedication}>
                        <Plus size={14} /> إضافة دواء
                      </Button>
                    </div>
                    {prescription.map((med, idx) => (
                      <div key={idx} className="grid grid-cols-4 gap-2">
                        <Input placeholder="اسم الدواء" value={med.name} onChange={e => {
                          const newP = [...prescription];
                          newP[idx].name = e.target.value;
                          setPrescription(newP);
                        }} />
                        <Input placeholder="الجرعة" value={med.dosage} onChange={e => {
                          const newP = [...prescription];
                          newP[idx].dosage = e.target.value;
                          setPrescription(newP);
                        }} />
                        <Input placeholder="التكرار" value={med.frequency} onChange={e => {
                          const newP = [...prescription];
                          newP[idx].frequency = e.target.value;
                          setPrescription(newP);
                        }} />
                        <Input placeholder="المدة" value={med.duration} onChange={e => {
                          const newP = [...prescription];
                          newP[idx].duration = e.target.value;
                          setPrescription(newP);
                        }} />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="font-bold">طلبات المختبر</Label>
                      <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border rounded-md bg-white">
                        {labCatalog.map(item => (
                          <label key={item.id} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={labTests.includes(item.id)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setLabTests([...labTests, item.id]);
                                } else {
                                  setLabTests(labTests.filter(id => id !== item.id));
                                }
                              }}
                              className="rounded border-slate-300 text-primary focus:ring-primary"
                            />
                            <span className="text-xs">{item.name}</span>
                          </label>
                        ))}
                      </div>
                      {labCatalog.length === 0 && <p className="text-[10px] text-muted-foreground">لا توجد فحوصات متاحة في القائمة.</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold">خدمات تمريضية / أخرى</Label>
                      <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border rounded-md bg-white">
                        {servicesCatalog.map(item => (
                          <label key={item.id} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={requestedServices.includes(item.id)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setRequestedServices([...requestedServices, item.id]);
                                } else {
                                  setRequestedServices(requestedServices.filter(id => id !== item.id));
                                }
                              }}
                              className="rounded border-slate-300 text-primary focus:ring-primary"
                            />
                            <span className="text-xs">{item.name}</span>
                          </label>
                        ))}
                      </div>
                      {servicesCatalog.length === 0 && <p className="text-[10px] text-muted-foreground">لا توجد خدمات متاحة في القائمة.</p>}
                    </div>
                  </div>

                    <div className="space-y-2">
                      <Label className="font-bold">طلب الأشعة</Label>
                      <Select value={radType} onValueChange={setRadType}>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر نوع الأشعة..." />
                        </SelectTrigger>
                        <SelectContent>
                          {radiologyCatalog.map(item => (
                            <SelectItem key={item.id} value={item.id}>{item.name} ({item.price} ر.ي)</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                  <div className="flex justify-end gap-3">
                    <Button type="submit" className="w-full md:w-auto">حفظ وإنهاء الزيارة</Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="history" className="mt-6 space-y-4">
                {records.length === 0 ? (
                  <div className="text-center py-12 bg-muted/20 rounded-lg border-2 border-dashed">
                    <History size={48} className="mx-auto text-muted-foreground mb-4 opacity-20" />
                    <p className="text-muted-foreground mb-4">لا توجد سجلات طبية سابقة لهذا المريض</p>
                    <Button onClick={() => setActiveTab('new-visit')} className="gap-2">
                      <Plus size={16} /> إنشاء أول سجل طبي
                    </Button>
                  </div>
                ) : (
                  records.map(record => (
                  <Card key={record.id}>
                    <CardHeader className="py-3 bg-muted/30">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-primary">زيارة بتاريخ: {record.createdAt?.toDate().toLocaleDateString('ar-SA')}</span>
                        <span className="text-xs text-muted-foreground">الطبيب: {record.doctorName || record.doctorId}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="py-4 space-y-2">
                      <p><strong>الشكوى:</strong> {record.complaint}</p>
                      <p><strong>التشخيص:</strong> {record.diagnosis}</p>
                      <p><strong>العلاج:</strong> {record.treatmentPlan}</p>
                    </CardContent>
                  </Card>
                )))}
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-white rounded-xl border border-dashed border-border p-20">
            <FileText size={64} className="mb-4 opacity-20" />
            <p className="text-xl font-medium">يرجى اختيار مريض من القائمة الجانبية للبدء</p>
          </div>
        )}
      </div>
    </div>
  );
}
