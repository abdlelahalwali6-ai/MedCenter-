import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  Timestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { Patient, MedicalRecord, Appointment, Prescription, LabRequest, RadiologyRequest } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { 
  FileText, 
  Activity, 
  Pill, 
  Beaker, 
  Stethoscope, 
  Plus, 
  Calendar,
  X,
  User,
  Thermometer,
  Heart,
  Droplets,
  Wind,
  PlusCircle,
  History,
  TrendingUp,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/src/context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface MedicalRecordViewProps {
  patient: Patient;
  onClose: () => void;
}

export default function MedicalRecordView({ patient, onClose }: MedicalRecordViewProps) {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('clinical');
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [labs, setLabs] = useState<LabRequest[]>([]);
  const [isAddingRecord, setIsAddingRecord] = useState(false);
  
  const [newRecord, setNewRecord] = useState({
    complaint: '',
    diagnosis: '',
    treatmentPlan: '',
    vitals: {
      temperature: 37,
      bloodPressure: '',
      heartRate: 80,
      weight: 0
    }
  });

  useEffect(() => {
    if (!patient.id) return;

    const qRecords = query(collection(db, 'medical_records'), where('patientId', '==', patient.id), orderBy('createdAt', 'desc'));
    const unsubRecords = onSnapshot(qRecords, (snap) => {
      setRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MedicalRecord[]);
    });

    const qApps = query(collection(db, 'appointments'), where('patientId', '==', patient.id), orderBy('date', 'desc'));
    const unsubApps = onSnapshot(qApps, (snap) => {
      setAppointments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Appointment[]);
    });

    const qPresc = query(collection(db, 'prescriptions'), where('patientId', '==', patient.id), orderBy('createdAt', 'desc'));
    const unsubPresc = onSnapshot(qPresc, (snap) => {
      setPrescriptions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Prescription[]);
    });

    return () => { unsubRecords(); unsubApps(); unsubPresc(); };
  }, [patient.id]);

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      await addDoc(collection(db, 'medical_records'), {
        ...newRecord,
        patientId: patient.id,
        doctorId: profile.uid,
        doctorName: profile.displayName,
        createdAt: serverTimestamp()
      });
      toast.success('تمت إضافة السجل الطبي بنجاح');
      setIsAddingRecord(false);
      setNewRecord({ complaint: '', diagnosis: '', treatmentPlan: '', vitals: { temperature: 37, bloodPressure: '', heartRate: 80, weight: 0 } });
    } catch (error) {
      toast.error('فشل إضافة السجل');
    }
  };

  const vitalsData = records
    .filter(r => r.vitals)
    .map(r => ({
      date: r.createdAt instanceof Timestamp ? r.createdAt.toDate().toLocaleDateString('ar-SA') : '',
      temp: r.vitals?.temperature,
      heart: r.vitals?.heartRate,
      weight: r.vitals?.weight
    }))
    .reverse();

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-y-0 right-0 w-full md:w-[800px] bg-white shadow-2xl z-50 flex flex-col"
      dir="rtl"
    >
      {/* Header */}
      <div className="p-6 border-b bg-primary flex justify-between items-center text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center font-bold text-xl">
            {patient.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-bold">{patient.name}</h2>
            <p className="text-white/70 text-sm">الرقم الطبي: {patient.mrn} • {patient.gender === 'male' ? 'ذكر' : 'أنثى'} • {patient.bloodType}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10 rounded-full">
          <X size={24} />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6 pb-20">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full grid grid-cols-5 h-12 bg-slate-100 p-1 rounded-xl">
              <TabsTrigger value="clinical" className="rounded-lg gap-2"><Stethoscope size={16} /> سريري</TabsTrigger>
              <TabsTrigger value="vitals" className="rounded-lg gap-2"><Activity size={16} /> العلامات</TabsTrigger>
              <TabsTrigger value="prescriptions" className="rounded-lg gap-2"><Pill size={16} /> للأدوية</TabsTrigger>
              <TabsTrigger value="appointments" className="rounded-lg gap-2"><Calendar size={16} /> مواعيد</TabsTrigger>
              <TabsTrigger value="info" className="rounded-lg gap-2"><User size={16} /> أساسيات</TabsTrigger>
            </TabsList>

            <TabsContent value="clinical" className="mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold flex items-center gap-2"><History className="text-primary" /> الزيارات السريرية</h3>
                <Button onClick={() => setIsAddingRecord(!isAddingRecord)} className="gap-2 rounded-full px-5">
                  <PlusCircle size={18} />
                  تسجيل زيارة جديدة
                </Button>
              </div>

              <AnimatePresence>
                {isAddingRecord && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <Card className="border-primary/20 bg-primary/5">
                      <CardContent className="p-6 space-y-4">
                        <form onSubmit={handleAddRecord} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>الشكوى الرئيسية</Label>
                              <Input value={newRecord.complaint} onChange={e => setNewRecord({...newRecord, complaint: e.target.value})} required />
                            </div>
                            <div className="space-y-2">
                              <Label>التشخيص الأول</Label>
                              <Input value={newRecord.diagnosis} onChange={e => setNewRecord({...newRecord, diagnosis: e.target.value})} required />
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-1"><Thermometer size={14} /> حرارة</Label>
                                <Input type="number" step="0.1" value={newRecord.vitals.temperature} onChange={e => setNewRecord({...newRecord, vitals: {...newRecord.vitals, temperature: parseFloat(e.target.value)}})} />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-1"><Activity size={14} /> ضغط</Label>
                                <Input placeholder="120/80" value={newRecord.vitals.bloodPressure} onChange={e => setNewRecord({...newRecord, vitals: {...newRecord.vitals, bloodPressure: e.target.value}})} />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-1"><Heart size={14} /> نبض</Label>
                                <Input type="number" value={newRecord.vitals.heartRate} onChange={e => setNewRecord({...newRecord, vitals: {...newRecord.vitals, heartRate: parseInt(e.target.value)}})} />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-1"><TrendingUp size={14} /> وزن</Label>
                                <Input type="number" value={newRecord.vitals.weight} onChange={e => setNewRecord({...newRecord, vitals: {...newRecord.vitals, weight: parseInt(e.target.value)}})} />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>خطة العلاج</Label>
                            <Textarea value={newRecord.treatmentPlan} onChange={e => setNewRecord({...newRecord, treatmentPlan: e.target.value})} required className="min-h-[100px]" />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button type="button" variant="outline" onClick={() => setIsAddingRecord(false)}>إلغاء</Button>
                            <Button type="submit">حفظ السجل</Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {records.map((record, index) => (
                <Card key={record.id} className="border-none shadow-sm hover:shadow-md transition-shadow group">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase flex items-center gap-1">
                                <Clock size={12} /> {record.createdAt instanceof Timestamp ? record.createdAt.toDate().toLocaleDateString('ar-SA') : ''}
                            </span>
                            <span className="text-primary font-bold text-sm">د. {record.doctorId.substring(0, 8)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-10">
                            <div>
                                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-tight">الشكوى</h4>
                                <p className="text-slate-900 mt-1">{record.complaint}</p>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-tight">التشخيص</h4>
                                <p className="text-primary font-semibold mt-1">{record.diagnosis}</p>
                            </div>
                        </div>
                        {record.vitals && (
                            <div className="flex gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="flex items-center gap-2 text-xs">
                                    <Thermometer size={14} className="text-amber-500" />
                                    <span className="font-bold">{record.vitals.temperature}°C</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                    <Activity size={14} className="text-emerald-500" />
                                    <span className="font-bold">{record.vitals.bloodPressure || 'N/A'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                    <Heart size={14} className="text-red-500" />
                                    <span className="font-bold">{record.vitals.heartRate} bpm</span>
                                </div>
                            </div>
                        )}
                        <div className="pt-2">
                             <h4 className="text-sm font-bold text-slate-500 uppercase tracking-tight">خطة العلاج</h4>
                             <p className="text-slate-700 text-sm mt-1 leading-relaxed bg-white p-3 rounded-lg border border-slate-100">{record.treatmentPlan}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {records.length === 0 && !isAddingRecord && (
                <div className="text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <History size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500 font-medium">لا توجد زيارات سابقة مسجلة لهذا المريض</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="vitals" className="mt-6 space-y-6">
               <Card className="border-none shadow-sm bg-white">
                 <CardHeader>
                   <CardTitle className="text-lg">تتبع العلامات الحيوية</CardTitle>
                   <CardDescription>رسم بياني لتاريخ الحرارة والنبض والوزن</CardDescription>
                 </CardHeader>
                 <CardContent>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={vitalsData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip />
                                <Line type="monotone" dataKey="temp" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="الحرارة" />
                                <Line type="monotone" dataKey="heart" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="النبض" />
                                <Line type="monotone" dataKey="weight" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="الوزن" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                 </CardContent>
               </Card>
            </TabsContent>

            <TabsContent value="prescriptions" className="mt-6 space-y-4">
              <h3 className="text-lg font-bold">الوصفات الطبية</h3>
              {prescriptions.map(p => (
                <Card key={p.id}>
                  <CardContent className="p-4 flex justify-between items-center">
                    <div>
                      <p className="font-bold flex items-center gap-2"><Pill size={16} className="text-primary" /> {p.createdAt instanceof Timestamp ? p.createdAt.toDate().toLocaleDateString('ar-SA') : ''}</p>
                      <ul className="text-sm text-slate-500 mt-2">
                        {p.medications.map((m, i) => <li key={i}>{m.name} - {m.dosage} ({m.frequency})</li>)}
                      </ul>
                    </div>
                    <Badge variant={p.status === 'dispensed' ? 'default' : 'secondary'}>
                      {p.status === 'dispensed' ? 'تم الصرف' : 'قيد الانتظار'}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
              {prescriptions.length === 0 && (
                <div className="text-center py-20 bg-slate-50 rounded-2xl">
                    <Pill size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500">لا توجد وصفات طبية مسجلة</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="appointments" className="mt-6 space-y-4">
              <h3 className="text-lg font-bold">تاريخ المواعيد</h3>
              {appointments.map(app => (
                <Card key={app.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-slate-100 rounded-xl text-primary">
                        <Calendar size={18} />
                      </div>
                      <div>
                        <p className="font-bold">{app.date instanceof Timestamp ? app.date.toDate().toLocaleDateString('ar-SA') : ''} • {app.startTime}</p>
                        <p className="text-xs text-slate-500">مع د. {app.doctorName}</p>
                      </div>
                    </div>
                    <Badge variant={app.status === 'completed' ? 'default' : 'outline'}>
                      {app.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="info" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle className="text-base">معلومات شخصية</CardTitle></CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="flex justify-between border-b pb-2">
                        <span className="text-slate-500">الاسم الكامل</span>
                        <span className="font-bold">{patient.name}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                        <span className="text-slate-500">العمر</span>
                        <span className="font-bold">{patient.age}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                        <span className="text-slate-500">رقم الهاتف</span>
                        <span className="font-bold">{patient.phone}</span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">معلومات طبية أساسية</CardTitle></CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="flex justify-between border-b pb-2">
                        <span className="text-slate-500">فصيلة الدم</span>
                        <span className="font-bold text-red-600">{patient.bloodType || 'غير محدد'}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                        <span className="text-slate-500">الحساسية</span>
                        <span className="font-bold text-amber-600">{patient.allergies?.join(', ') || 'لا يوجد'}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                        <span className="text-slate-500">شركة التأمين</span>
                        <span className="font-bold">{patient.insuranceProvider || 'دفع نقدي'}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </motion.div>
  );
}
