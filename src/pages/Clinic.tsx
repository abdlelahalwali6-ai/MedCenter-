import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { localDB } from '@/src/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { DataService } from '@/src/lib/dataService';
import { SyncService } from '@/src/lib/syncService';
import { formatArabicDate, toDate } from '@/src/lib/dateUtils';
import { logAction } from '@/src/lib/audit';
import { Patient, MedicalRecord, Appointment, LabCatalogItem, ServiceCatalogItem } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, FileText, Plus, History, ClipboardList, Pill, FlaskConical, Stethoscope, Thermometer, Activity, Weight, Heart, Trash2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/src/context/AuthContext';

export default function Clinic() {
  const { profile, isPatient } = useAuth();
  const [searchParams] = useSearchParams();
  const patientIdFromUrl = searchParams.get('patientId');

  if (isPatient) return null;

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const patients = useLiveQuery(() => localDB.patients.orderBy('name').toArray(), []) || [];
  const appointments = useLiveQuery(() => localDB.appointments.toArray(), []) || [];
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('new-visit');
  
  // Catalogs from localDB (synced by SyncService)
  const labCatalog = useLiveQuery(() => localDB.labCatalog.toArray(), []) || [];
  const servicesCatalog = useLiveQuery(() => localDB.serviceCatalog.where('category').notEqual('radiology').toArray(), []) || [];
  const radiologyCatalog = useLiveQuery(() => localDB.serviceCatalog.where('category').equals('radiology').toArray(), []) || [];

  const [newRecord, setNewRecord] = useState({
    complaint: '',
    diagnosis: '',
    treatmentPlan: '',
    vitals: {
      temperature: '',
      bloodPressure: '',
      weight: '',
      pulse: '',
      spO2: ''
    }
  });

  const [prescription, setPrescription] = useState<{name: string, dosage: string, frequency: string, duration: string}[]>([]);
  const [labTests, setLabTests] = useState<string[]>([]);
  const [radType, setRadType] = useState('');
  const [requestedServices, setRequestedServices] = useState<string[]>([]);

  // Selected patient's records
  const records = useLiveQuery(
    () => selectedPatient ? localDB.medicalRecords.where('patientId').equals(selectedPatient.id).reverse().toArray() : Promise.resolve([]),
    [selectedPatient]
  ) || [];

  useEffect(() => {
    if (patientIdFromUrl && patients.length > 0) {
      const patient = patients.find(p => p.id === patientIdFromUrl);
      if (patient) setSelectedPatient(patient);
    }
  }, [patientIdFromUrl, patients]);

  const handleSaveVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !profile) return;

    try {
      // 1. Save Medical Record
      const recordId = await DataService.create('medicalRecords', {
        patientId: selectedPatient.id,
        doctorId: profile.uid,
        doctorName: profile.displayName,
        ...newRecord,
      });

      await logAction(
        profile,
        'إضافة سجل طبي',
        'record',
        recordId,
        `زيارة جديدة للمريض: ${selectedPatient.name}`,
        { diagnosis: newRecord.diagnosis }
      );

      // 2. Save Prescription if any
      if (prescription.length > 0) {
        await DataService.create('prescriptions', {
          patientId: selectedPatient.id,
          patientName: selectedPatient.name,
          doctorId: profile.uid,
          doctorName: profile.displayName,
          medications: prescription,
          status: 'pending',
        });
      }

      // 3. Save Lab Request if any
      if (labTests.length > 0) {
        const selectedTests = labCatalog.filter(c => labTests.includes(c.id));
        await DataService.create('labRequests', {
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
        });
      }

      // 4. Save Radiology Request if any
      if (radType) {
        const selectedRad = radiologyCatalog.find(r => r.id === radType);
        await DataService.create('radiologyRequests', {
          patientId: selectedPatient.id,
          patientName: selectedPatient.name,
          doctorId: profile.uid,
          doctorName: profile.displayName,
          type: selectedRad?.name || radType,
          status: 'pending',
        });
      }

      // 5. Save Service Requests if any
      if (requestedServices.length > 0) {
        for (const serviceId of requestedServices) {
          const service = servicesCatalog.find(s => s.id === serviceId);
          if (service) {
            await DataService.create('serviceRequests', {
              patientId: selectedPatient.id,
              patientName: selectedPatient.name,
              doctorId: profile.uid,
              doctorName: profile.displayName,
              serviceId: service.id,
              serviceName: service.name,
              price: service.price,
              status: 'pending',
            });
          }
        }
      }

      // 6. Create Bill automatically
      let billAmount = profile.consultationFee || 150;
      let billDescription = 'رسوم كشفية طبية - ' + newRecord.diagnosis;

      // Handle follow-ups etc logic here...

      await DataService.create('bills', {
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        totalAmount: billAmount,
        description: billDescription,
        paymentMethod: 'cash',
        status: billAmount === 0 ? 'paid' : 'unpaid',
      });

      toast.success('تم حفظ الزيارة والطلبات وإنشاء الفاتورة بنجاح');
      setNewRecord({ complaint: '', diagnosis: '', treatmentPlan: '', vitals: { temperature: '', bloodPressure: '', weight: '', pulse: '', spO2: '' } });
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
      {/* Sidebar and Header */}
      <Card className="lg:col-span-1 h-[calc(100vh-120px)] flex flex-col border-none shadow-xl bg-slate-50/50">
        <CardHeader className="p-5 border-b bg-white rounded-t-xl">
          <CardTitle className="text-xl font-black flex items-center gap-2 text-slate-800">
            <Search size={22} className="text-primary" />
            انتظار العيادة
          </CardTitle>
          <div className="relative mt-3">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <Input 
              placeholder="ابحث عن مريض..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pr-10 bg-slate-50 border-none h-11 rounded-xl focus-visible:ring-primary/20"
            />
          </div>
        </CardHeader>
        <CardContent className="p-2 overflow-auto flex-1 no-scrollbar">
          <div className="space-y-2">
            {filteredPatients.map(patient => {
              const app = appointments.find(a => a.patientId === patient.id && a.status === 'checked-in');
              return (
                <button
                  key={patient.id}
                  onClick={() => setSelectedPatient(patient)}
                  className={`
                    w-full text-right p-4 rounded-xl transition-all duration-300 border flex flex-col gap-1 relative overflow-hidden group
                    ${selectedPatient?.id === patient.id 
                      ? 'bg-white border-primary shadow-lg shadow-primary/5 ring-1 ring-primary/20' 
                      : 'bg-white border-transparent hover:border-slate-200 hover:shadow-md'}
                  `}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-sm text-slate-800">{patient.name}</span>
                    {app && (
                      <span className="flex items-center gap-1 text-[0.6rem] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-black animate-pulse">
                        <CheckCircle2 size={10} /> وصل العيادة
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[0.65rem] text-slate-400 font-bold bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider">{patient.mrn}</span>
                    <span className="text-[0.65rem] text-slate-400 font-bold">{patient.phone}</span>
                  </div>
                  {selectedPatient?.id === patient.id && (
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Main Clinical Area */}
      <div className="lg:col-span-3 space-y-6">
        {selectedPatient ? (
          <>
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-white p-6 rounded-2xl border shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-sky-600 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-primary/20">
                  {selectedPatient.name.substring(0, 2)}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-800">{selectedPatient.name}</h2>
                  <div className="flex items-center gap-3 mt-1 text-slate-500 font-medium text-sm">
                    <span className="flex items-center gap-1"><FileText size={14} /> MRN: {selectedPatient.mrn}</span>
                    <div className="w-1 h-1 rounded-full bg-slate-300" />
                    <span className="flex items-center gap-1 uppercase tracking-tighter">{selectedPatient.gender === 'male' ? 'ذكر' : 'أنثى'} • {selectedPatient.bloodType || 'N/A'}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <Button variant="outline" size="sm" className="flex-1 md:flex-none gap-2 rounded-xl h-11 px-5 border-slate-200 hover:bg-slate-50" onClick={() => setActiveTab('history')}>
                  <History size={18} className="text-slate-400" /> السجل التاريخي
                </Button>
                <Button className="flex-1 md:flex-none gap-2 rounded-xl h-11 px-5 shadow-lg shadow-primary/25" onClick={() => setActiveTab('new-visit')}>
                  <Plus size={18} /> جلسة جديدة
                </Button>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full h-14 bg-slate-100/50 p-1.5 rounded-2xl gap-1">
                <TabsTrigger value="new-visit" className="flex-1 h-full gap-2 rounded-xl text-xs font-black data-[state=active]:shadow-md">
                  <Stethoscope size={18} /> معاينة سريرية
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1 h-full gap-2 rounded-xl text-xs font-black data-[state=active]:shadow-md">
                  <ClipboardList size={18} /> الأرشيف الطبي
                </TabsTrigger>
                <TabsTrigger value="prescriptions" className="flex-1 h-full gap-2 rounded-xl text-xs font-black data-[state=active]:shadow-md">
                  <Pill size={18} /> روشتات دوائية
                </TabsTrigger>
                <TabsTrigger value="requests" className="flex-1 h-full gap-2 rounded-xl text-xs font-black data-[state=active]:shadow-md">
                  <FlaskConical size={18} /> الفحوصات
                </TabsTrigger>
              </TabsList>

              <TabsContent value="new-visit" className="mt-6 space-y-6">
                <form onSubmit={handleSaveVisit} className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                      { label: 'الحرارة', unit: '°C', icon: Thermometer, key: 'temperature', color: 'text-orange-500', bg: 'bg-orange-50' },
                      { label: 'النبض', unit: 'BPM', icon: Activity, key: 'pulse', color: 'text-rose-500', bg: 'bg-rose-50' },
                      { label: 'الضغط', unit: 'mmHg', icon: Heart, key: 'bloodPressure', color: 'text-indigo-500', bg: 'bg-indigo-50' },
                      { label: 'الأكسجين', unit: '%', icon: Heart, key: 'spO2', color: 'text-sky-500', bg: 'bg-sky-50' },
                      { label: 'الوزن', unit: 'kg', icon: Weight, key: 'weight', color: 'text-emerald-500', bg: 'bg-emerald-50' },
                    ].map(v => (
                      <div key={v.key} className={`p-4 rounded-2xl border transition-all ${v.bg} border-transparent hover:border-slate-200 group`}>
                        <div className="flex items-center gap-2 mb-2">
                          <v.icon size={16} className={`${v.color} group-hover:scale-110 transition-transform`} />
                          <Label className="text-[0.65rem] font-black text-slate-500 uppercase tracking-wider">{v.label}</Label>
                        </div>
                        <div className="flex items-center gap-1">
                          <Input 
                            value={(newRecord.vitals as any)[v.key]} 
                            onChange={e => setNewRecord({...newRecord, vitals: {...newRecord.vitals, [v.key]: e.target.value}})} 
                            className="bg-white border-none h-9 text-center font-black text-lg focus-visible:ring-1 ring-primary/20"
                            placeholder="0"
                          />
                          <span className="text-[0.6rem] font-bold text-slate-400">{v.unit}</span>
                        </div>
                      </div>
                    ))}
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
                            <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                  <div className="flex justify-end gap-3">
                    <Button type="submit" className="w-full md:w-auto h-12 px-10 text-lg font-bold">حفظ وإنهاء الزيارة</Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="history" className="mt-6 space-y-4">
                {records.length === 0 ? (
                  <div className="text-center py-24 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                    <History size={64} className="mx-auto text-slate-200 mb-4" />
                    <p className="text-slate-400 mb-4 font-bold">لا توجد سجلات طبية سابقة لهذا المريض</p>
                    <Button onClick={() => setActiveTab('new-visit')} className="gap-2 rounded-xl">
                      <Plus size={16} /> إنشاء أول سجل طبي
                    </Button>
                  </div>
                ) : (
                  records.map(record => (
                  <Card key={record.id} className="border-none shadow-sm hover:shadow-md transition-shadow rounded-2xl overflow-hidden">
                    <CardHeader className="py-4 bg-slate-50/80">
                      <div className="flex justify-between items-center">
                        <span className="font-black text-primary text-sm flex items-center gap-2">
                          <History size={16} /> زيارة بتاريخ: {formatArabicDate(record.createdAt)}
                        </span>
                        <span className="text-[0.65rem] font-bold text-slate-400 bg-white px-2 py-1 rounded-lg border">الطبيب: {record.doctorName || 'غير محدد'}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="py-6 space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 border-b pb-4 border-slate-50">
                         {Object.entries(record.vitals || {}).map(([k, v]) => (
                           <div key={k} className="flex flex-col">
                             <span className="text-[0.6rem] text-slate-400 font-bold uppercase">{k}</span>
                             <span className="font-black text-slate-800">{v as string || '-'}</span>
                           </div>
                         ))}
                      </div>
                      <div className="grid gap-4">
                        <div>
                          <Label className="text-[0.7rem] font-black text-slate-400 uppercase mb-1 block">الشكوى</Label>
                          <p className="text-slate-700 leading-relaxed">{record.complaint}</p>
                        </div>
                        <div>
                          <Label className="text-[0.7rem] font-black text-slate-400 uppercase mb-1 block">التشخيص</Label>
                          <p className="text-slate-800 font-bold leading-relaxed">{record.diagnosis}</p>
                        </div>
                        {record.treatmentPlan && (
                          <div>
                            <Label className="text-[0.7rem] font-black text-slate-400 uppercase mb-1 block">الخطة العلاجية</Label>
                            <p className="text-slate-700 leading-relaxed">{record.treatmentPlan}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )))}
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 bg-white rounded-3xl border border-dashed border-slate-200 p-20">
            <Stethoscope size={80} className="mb-6 opacity-20" />
            <h3 className="text-2xl font-black text-slate-400 mb-2">بوابة المعاينة السريرية</h3>
            <p className="text-slate-400 font-medium">يرجى اختيار مريض من قائمة الانتظار للبدء</p>
          </div>
        )}
      </div>
    </div>
  );
}
