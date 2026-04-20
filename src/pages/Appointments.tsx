/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  serverTimestamp,
  Timestamp,
  where
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { formatArabicDate, toDate } from '@/src/lib/dateUtils';
import { Appointment, Patient, UserProfile } from '@/src/types';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  UserCheck, 
  Edit, 
  Trash2, 
  AlertCircle, 
  DollarSign, 
  ChevronRight, 
  Search,
  CheckCircle2,
  XCircle,
  Timer,
  CalendarDays,
  Filter,
  Users,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/src/context/AuthContext';
import { APPOINTMENT_STATUS } from '@/src/lib/constants';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataService } from '@/src/lib/dataService';

export default function Appointments() {
  const { profile, isAdmin, isPatient } = useAuth();

  if (isPatient) return null;

  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<UserProfile[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStatusTab, setActiveStatusTab] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [filterDoctorId, setFilterDoctorId] = useState('all');
  
  const [newAppointment, setNewAppointment] = useState({
    patientId: '',
    doctorId: '',
    date: '',
    startTime: '',
    type: 'consultation' as any
  });

  useEffect(() => {
    if (!profile) return;

    const unsubscribers: (()=>void)[] = [];
    setLoading(true);

    // Fetch Appointments directly from Firestore
    const qApp = query(collection(db, 'appointments'), orderBy('date', 'desc'));
    unsubscribers.push(onSnapshot(qApp, (snapshot) => {
      const appList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Appointment[];
      setAppointments(appList);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'appointments');
      setLoading(false);
    }));

    // Fetch Patients
    const qPat = query(collection(db, 'patients'), orderBy('name', 'asc'));
    unsubscribers.push(onSnapshot(qPat, (snapshot) => {
      setPatients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Patient[]);
    }));

    // Fetch Doctors
    const qDoc = query(collection(db, 'users'), where('role', '==', 'doctor')); 
    unsubscribers.push(onSnapshot(qDoc, (snapshot) => {
      setDoctors(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[]);
    }));

    return () => { unsubscribers.forEach(unsub => unsub()); };
  }, [profile]);

  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    const patient = patients.find(p => p.id === newAppointment.patientId);
    const doctor = doctors.find(d => d.uid === newAppointment.doctorId);

    if (!patient || !doctor) {
      toast.error("الرجاء التأكد من اختيار المريض والطبيب");
      return;
    }

    try {
      await DataService.create('appointments', {
        patientId: patient.id,
        patientName: patient.name,
        doctorId: doctor.uid,
        doctorName: doctor.displayName,
        date: Timestamp.fromDate(new Date(newAppointment.date)),
        startTime: newAppointment.startTime,
        status: 'scheduled',
        type: newAppointment.type,
      });
      toast.success('تم حجز الموعد بنجاح');
      setIsAddDialogOpen(false);
      setNewAppointment({ patientId: '', doctorId: '', date: '', startTime: '', type: 'consultation' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'appointments');
    }
  };

  const handleUpdateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment) return;
    try {
      const updateData = {
        ...selectedAppointment,
        date: selectedAppointment.date instanceof Timestamp ? selectedAppointment.date : Timestamp.fromDate(new Date(selectedAppointment.date))
      };
      await DataService.update('appointments', selectedAppointment.id, updateData);
      toast.success('تم تحديث الموعد');
      setIsEditDialogOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'appointments');
    }
  };

  const handleQuickStatusChange = async (id: string, status: string) => {
    try {
      await DataService.update('appointments', id, { status });
      toast.success(`تم تغيير حالة الموعد إلى: ${APPOINTMENT_STATUS[status]?.label || status}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'appointments');
    }
  };

  const handleDeleteAppointment = async (id: string) => {
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذا الموعد نهائياً؟")) return;
    try {
      await DataService.delete('appointments', id);
      toast.success('تم حذف الموعد نهائياً');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'appointments');
    }
  };

  const getStats = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayApps = appointments.filter(a => toDate(a.date).toISOString().split('T')[0] === today);

    return {
      total: appointments.length,
      today: todayApps.length,
      pending: appointments.filter(a => a.status === 'scheduled').length,
      completed: appointments.filter(a => a.status === 'completed').length
    };
  };

  const stats = getStats();

  const filteredAppointments = appointments.filter(app => {
    const patientNameStr = (app.patientName || '').toLowerCase();
    const doctorNameStr = (app.doctorName || '').toLowerCase();
    const queryStr = searchQuery.toLowerCase();

    const matchesSearch = patientNameStr.includes(queryStr) || doctorNameStr.includes(queryStr);
    const matchesStatus = activeStatusTab === 'all' || app.status === activeStatusTab;
    
    let matchesDate = true;
    if (filterDate) {
      const appDate = toDate(app.date).toISOString().split('T')[0];
      matchesDate = appDate === filterDate;
    }

    const matchesDoctor = filterDoctorId === 'all' || app.doctorId === filterDoctorId;

    return matchesSearch && matchesStatus && matchesDate && matchesDoctor;
  });

  return (
    <div className="p-6 space-y-8 bg-slate-50/30 min-h-screen" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">إدارة المواعيد</h1>
          <p className="text-slate-500 mt-1">تنظيم ومتابعة مواعيد المرضى والعيادات في مكان واحد</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 h-11 px-6 text-base">
              <CalendarIcon size={20} />
              حجز موعد جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[450px]" dir="rtl">
            <DialogHeader><DialogTitle className="text-xl">حجز موعد طبي جديد</DialogTitle></DialogHeader>
            <form onSubmit={handleAddAppointment} className="space-y-5 py-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">المريض</Label>
                  <select className="w-full h-11 rounded-lg border border-slate-200 bg-white px-3" value={newAppointment.patientId} onChange={e => setNewAppointment({...newAppointment, patientId: e.target.value})} required>
                    <option value="">اختر مريض...</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.name} (MRN: {p.mrn})</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">الطبيب</Label>
                  <select className="w-full h-11 rounded-lg border border-slate-200 bg-white px-3" value={newAppointment.doctorId} onChange={e => setNewAppointment({...newAppointment, doctorId: e.target.value})} required>
                    <option value="">اختر طبيب...</option>
                    {doctors.map(d => <option key={d.uid} value={d.uid}>{d.displayName} - {d.specialization}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>التاريخ</Label><Input type="date" className="h-11" value={newAppointment.date} onChange={e => setNewAppointment({...newAppointment, date: e.target.value})} required /></div>
                  <div className="space-y-2"><Label>الوقت</Label><Input type="time" className="h-11" value={newAppointment.startTime} onChange={e => setNewAppointment({...newAppointment, startTime: e.target.value})} required /></div>
                </div>
                <Button type="submit" className="w-full h-12 text-lg font-bold">تأكيد الحجز</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-slate-500">إجمالي المواعيد</p><h3 className="text-2xl font-bold">{loading ? <Loader2 className="animate-spin" /> : stats.total}</h3></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-slate-500">مواعيد اليوم</p><h3 className="text-2xl font-bold">{loading ? <Loader2 className="animate-spin" /> : stats.today}</h3></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-slate-500">مواعيد قادمة</p><h3 className="text-2xl font-bold text-amber-600">{loading ? <Loader2 className="animate-spin" /> : stats.pending}</h3></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-slate-500">مكتملة</p><h3 className="text-2xl font-bold text-primary">{loading ? <Loader2 className="animate-spin" /> : stats.completed}</h3></CardContent></Card>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 space-y-4">
          <Tabs value={activeStatusTab} onValueChange={setActiveStatusTab}><TabsList><TabsTrigger value="all">الكل</TabsTrigger><TabsTrigger value="scheduled">المجدولة</TabsTrigger><TabsTrigger value="checked-in">وصل</TabsTrigger><TabsTrigger value="in-progress">قيد الكشف</TabsTrigger><TabsTrigger value="completed">المكتملة</TabsTrigger></TabsList></Tabs>
          <div className="flex gap-4"><Input placeholder="البحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /><Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} /><select value={filterDoctorId} onChange={e => setFilterDoctorId(e.target.value)}><option value="all">كل الأطباء</option>{doctors.map(d=><option value={d.uid} key={d.uid}>{d.displayName}</option>)}</select></div>
        </div>

        <div className="overflow-x-auto">
          {loading ? <div className="text-center py-20"><Loader2 className="animate-spin mx-auto" size={48} /></div> : (
            <Table>
              <TableHeader><TableRow><TableHead>المريض</TableHead><TableHead>الطبيب</TableHead><TableHead>التاريخ</TableHead><TableHead>الحالة</TableHead><TableHead>إدارة</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredAppointments.map(app => (
                  <TableRow key={app.id}>
                    <TableCell>{app.patientName}</TableCell>
                    <TableCell>{app.doctorName}</TableCell>
                    <TableCell>{formatArabicDate(app.date)} {app.startTime}</TableCell>
                    <TableCell><span className={`p-2 rounded-lg ${APPOINTMENT_STATUS[app.status]?.color}`}>{APPOINTMENT_STATUS[app.status]?.label}</span></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedAppointment(app); setIsEditDialogOpen(true); }}><Edit size={16}/></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleQuickStatusChange(app.id, 'cancelled')}><XCircle size={16}/></Button>
                      {isAdmin && <Button variant="ghost" size="icon" onClick={() => handleDeleteAppointment(app.id)}><Trash2 size={16}/></Button>}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredAppointments.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-10">لا توجد مواعيد تطابق البحث</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>تعديل الموعد</DialogTitle></DialogHeader>
          {selectedAppointment && <form onSubmit={handleUpdateAppointment} className="space-y-4 py-4">
            <div><Label>الحالة</Label><select className="w-full h-11 border rounded-lg px-3" value={selectedAppointment.status} onChange={e => setSelectedAppointment({...selectedAppointment, status: e.target.value})}>{Object.entries(APPOINTMENT_STATUS).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>التاريخ</Label><Input type="date" value={toDate(selectedAppointment.date).toISOString().split('T')[0]} onChange={e => setSelectedAppointment({...selectedAppointment, date: e.target.value})} /></div>
              <div><Label>الوقت</Label><Input type="time" value={selectedAppointment.startTime} onChange={e => setSelectedAppointment({...selectedAppointment, startTime: e.target.value})} /></div>
            </div>
            <Button type="submit" className="w-full h-12">حفظ</Button>
          </form>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
