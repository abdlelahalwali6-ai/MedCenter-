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
import { localDB } from '@/src/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { DataService } from '@/src/lib/dataService';
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
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/src/context/AuthContext';
import { APPOINTMENT_STATUS } from '@/src/lib/constants';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Appointments() {
  const { profile, isAdmin, isPatient } = useAuth();

  if (isPatient) return null;

  const appointments = useLiveQuery(() => localDB.appointments.toArray(), []) || [];
  const patients = useLiveQuery(() => localDB.patients.toArray(), []) || [];
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
    if (!profile || profile.role === 'patient') return;

    // Fetch Appointments
    const qApp = query(collection(db, 'appointments'), orderBy('date', 'asc'));
    const unsubApp = onSnapshot(qApp, (snapshot) => {
      // Sync handled by SyncService
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'appointments'));

    // Fetch Patients
    const qPat = query(collection(db, 'patients'), orderBy('name', 'asc'));
    const unsubPat = onSnapshot(qPat, (snapshot) => {
      // Sync handled by SyncService
    });

    // Fetch Doctors
    const qDoc = query(collection(db, 'users')); 
    const unsubDoc = onSnapshot(qDoc, (snapshot) => {
      setDoctors(snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() }))
        .filter((u: any) => u.role === 'doctor') as UserProfile[]);
    });

    return () => { unsubApp(); unsubPat(); unsubDoc(); };
  }, [profile]);

  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    const patient = patients.find(p => p.id === newAppointment.patientId);
    const doctor = doctors.find(d => d.uid === newAppointment.doctorId);

    if (!patient || !doctor) return;

    try {
      await DataService.create('appointments', {
        patientId: patient.id,
        patientName: patient.name,
        doctorId: doctor.uid,
        doctorName: doctor.displayName,
        date: new Date(newAppointment.date),
        startTime: newAppointment.startTime,
        status: 'scheduled',
        type: newAppointment.type,
      });
      toast.success('تم حجز الموعد بنجاح');
      setIsAddDialogOpen(false);
      setNewAppointment({ patientId: '', doctorId: '', date: '', startTime: '', type: 'consultation' });
    } catch (error) {
      toast.error('فشل حجز الموعد');
    }
  };

  const handleUpdateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment) return;
    try {
      await DataService.update('appointments', selectedAppointment.id, {
        ...selectedAppointment,
        date: selectedAppointment.date instanceof Date ? selectedAppointment.date : selectedAppointment.date
      });
      toast.success('تم تحديث الموعد');
      setIsEditDialogOpen(false);
    } catch (error) {
      toast.error('فشل تحديث الموعد');
    }
  };

  const handleQuickStatusChange = async (id: string, status: string) => {
    try {
      await DataService.update('appointments', id, {
        status
      });
      toast.success('تم تحديث حالة الموعد');
    } catch (error) {
      toast.error('فشل التحديث');
    }
  };

// ... inside getStats ...

  const getStats = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayApps = appointments.filter(a => {
      if (!a.date) return false;
      const d = toDate(a.date).toISOString().split('T')[0];
      return d === today;
    });

    return {
      total: appointments.length,
      today: todayApps.length,
      pending: appointments.filter(a => a.status === 'scheduled').length,
      completed: appointments.filter(a => a.status === 'completed').length
    };
  };

  const handleCancelAppointment = async (id: string) => {
    try {
      await DataService.update('appointments', id, {
        status: 'cancelled'
      });
      toast.success('تم إلغاء الموعد');
    } catch (error) {
      toast.error('فشل إلغاء الموعد');
    }
  };

  const handleDeleteAppointment = async (id: string) => {
    try {
      await DataService.delete('appointments', id);
      toast.success('تم حذف الموعد نهائياً');
    } catch (error) {
      toast.error('فشل حذف الموعد');
    }
  };

  const stats = getStats();

  const filteredAppointments = appointments.filter(app => {
    const matchesSearch = app.patientName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          app.doctorName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = activeStatusTab === 'all' || app.status === activeStatusTab;
    
    // Date filter
    let matchesDate = true;
    if (filterDate) {
      const appDate = toDate(app.date).toISOString().split('T')[0];
      matchesDate = appDate === filterDate;
    }

    // Doctor filter
    const matchesDoctor = filterDoctorId === 'all' || app.doctorId === filterDoctorId;

    return matchesSearch && matchesStatus && matchesDate && matchesDoctor;
  }).sort((a, b) => {
    // Sort by date and then by start time
    const dateA = toDate(a.date).getTime();
    const dateB = toDate(b.date).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return a.startTime.localeCompare(b.startTime);
  });

  return (
    <div className="p-6 space-y-8 bg-slate-50/30 min-h-screen" dir="rtl">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">إدارة المواعيد</h1>
          <p className="text-slate-500 mt-1">تنظيم ومتابعة مواعيد المرضى والعيادات في مكان واحد</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger render={<Button className="gap-2 bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 h-11 px-6 text-base" />}>
              <CalendarIcon size={20} />
              حجز موعد جديد
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px]" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-xl">حجز موعد طبي جديد</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddAppointment} className="space-y-5 py-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">المريض المستهدف</Label>
                  <select 
                    className="w-full h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    value={newAppointment.patientId}
                    onChange={e => setNewAppointment({...newAppointment, patientId: e.target.value})}
                    required
                  >
                    <option value="">اختر المريض من القائمة...</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.name} (MRN: {p.mrn})</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">الطبيب المعالج</Label>
                  <select 
                    className="w-full h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    value={newAppointment.doctorId}
                    onChange={e => setNewAppointment({...newAppointment, doctorId: e.target.value})}
                    required
                  >
                    <option value="">اختر الطبيب المتوفر...</option>
                    {doctors.map(d => <option key={d.uid} value={d.uid}>{d.displayName} - {d.specialization}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">تاريخ الموعد</Label>
                    <Input type="date" className="h-11 rounded-lg" value={newAppointment.date} onChange={e => setNewAppointment({...newAppointment, date: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">الوقت المفضل</Label>
                    <Input type="time" className="h-11 rounded-lg" value={newAppointment.startTime} onChange={e => setNewAppointment({...newAppointment, startTime: e.target.value})} required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">نوع الزيارة</Label>
                  <select 
                    className="w-full h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    value={newAppointment.type}
                    onChange={e => setNewAppointment({...newAppointment, type: e.target.value as any})}
                    required
                  >
                    <option value="consultation">استشارة طبية</option>
                    <option value="follow-up">متابعة</option>
                    <option value="emergency">حالة طارئة</option>
                    <option value="procedure">إجراء طبي</option>
                  </select>
                </div>

                <Button type="submit" className="w-full h-12 text-lg font-bold">تأكيد حجز الموعد</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-slate-500">إجمالي المواعيد</p>
                  <h3 className="text-2xl font-bold mt-1">{stats.total}</h3>
                </div>
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform">
                  <CalendarDays size={24} />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-slate-500">مواعيد اليوم</p>
                  <h3 className="text-2xl font-bold mt-1">{stats.today}</h3>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:scale-110 transition-transform">
                  <Timer size={24} />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-slate-500">مواعيد قادمة</p>
                  <h3 className="text-2xl font-bold mt-1 text-amber-600">{stats.pending}</h3>
                </div>
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl group-hover:scale-110 transition-transform">
                  <Users size={24} />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-slate-500">مكتملة</p>
                  <h3 className="text-2xl font-bold mt-1 text-primary">{stats.completed}</h3>
                </div>
                <div className="p-3 bg-sky-50 text-primary rounded-2xl group-hover:scale-110 transition-transform">
                  <CheckCircle2 size={24} />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Main filter and list section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 space-y-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <Tabs value={activeStatusTab} onValueChange={setActiveStatusTab} className="w-full lg:w-auto">
              <TabsList className="bg-slate-100/50 p-1 rounded-xl h-auto flex-wrap">
                <TabsTrigger value="all" className="rounded-lg py-2 px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm">الكل</TabsTrigger>
                <TabsTrigger value="scheduled" className="rounded-lg py-2 px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm">المجدولة</TabsTrigger>
                <TabsTrigger value="checked-in" className="rounded-lg py-2 px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm">وصل المريض</TabsTrigger>
                <TabsTrigger value="in-progress" className="rounded-lg py-2 px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm">قيد الكشف</TabsTrigger>
                <TabsTrigger value="completed" className="rounded-lg py-2 px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm">المكتملة</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <div className="relative flex-1 lg:w-64 min-w-[200px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input 
                  placeholder="البحث عن مريض..." 
                  className="pr-10 h-10 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all text-sm"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <Button 
                variant="outline" 
                size="icon" 
                className={`h-10 w-10 rounded-xl transition-colors ${(filterDate || filterDoctorId !== 'all') ? 'bg-primary/10 border-primary text-primary' : 'bg-slate-50/50 border-slate-200'}`}
                onClick={() => {
                  setFilterDate('');
                  setFilterDoctorId('all');
                }}
                title="إعادة تعيين الفلاتر"
              >
                <Filter size={18} />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-2">
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
              <CalendarIcon size={16} className="text-slate-400" />
              <Input 
                type="date" 
                value={filterDate} 
                onChange={e => setFilterDate(e.target.value)}
                className="h-8 border-none bg-transparent focus-visible:ring-0 p-0 text-sm w-32"
              />
            </div>
            
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
              <Users size={16} className="text-slate-400" />
              <select 
                className="bg-transparent border-none text-sm outline-none cursor-pointer min-w-[120px]"
                value={filterDoctorId}
                onChange={e => setFilterDoctorId(e.target.value)}
              >
                <option value="all">كل الأطباء</option>
                {doctors.map(d => (
                  <option key={d.uid} value={d.uid}>{d.displayName}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-none">
                <TableHead className="py-4 text-xs font-bold text-slate-500 uppercase tracking-widest px-6">المريض</TableHead>
                <TableHead className="py-4 text-xs font-bold text-slate-500 uppercase tracking-widest px-6">الطبيب المختص</TableHead>
                <TableHead className="py-4 text-xs font-bold text-slate-500 uppercase tracking-widest px-6">التاريخ والوقت</TableHead>
                <TableHead className="py-4 text-xs font-bold text-slate-500 uppercase tracking-widest px-6">نوع الزيارة</TableHead>
                <TableHead className="py-4 text-xs font-bold text-slate-500 uppercase tracking-widest px-6">حالة الموعد</TableHead>
                <TableHead className="py-4 text-xs font-bold text-slate-500 uppercase tracking-widest px-6 text-left">إدارة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {filteredAppointments.map((app, index) => (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    key={app.id} 
                    className="group hover:bg-slate-50/80 transition-colors border-b border-slate-50"
                  >
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                          {app.patientName.substring(0, 2)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{app.patientName}</span>
                          <span className="text-xs text-slate-500 font-mono tracking-tighter">ID: {app.patientId.substring(0, 8)}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-slate-400" />
                        <span className="text-slate-700 font-medium">د. {app.doctorName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-sm text-slate-700 font-semibold">
                          <CalendarIcon size={14} className="text-primary" />
                          {formatArabicDate(app.date, { day: '2-digit', month: 'long' })}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Clock size={14} />
                          {app.startTime}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <span className="px-2 py-1 rounded-md text-[0.7rem] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                        {app.type === 'consultation' ? 'استشارة' : app.type === 'follow-up' ? 'متابعة' : app.type === 'emergency' ? 'طوارئ' : 'إجراء'}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${APPOINTMENT_STATUS[app.status]?.color?.replace('bg-', 'bg-') || 'bg-slate-300'}`} />
                          <span className={`text-[0.75rem] font-bold ${APPOINTMENT_STATUS[app.status]?.color?.replace('bg-', 'text-') || 'text-slate-600'}`}>
                            {APPOINTMENT_STATUS[app.status]?.label}
                          </span>
                        </div>
                        {/* Quick status controls for staff */}
                        {app.status === 'scheduled' && (
                          <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleQuickStatusChange(app.id, 'checked-in')}
                              className="text-[0.65rem] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded border border-emerald-100 hover:bg-emerald-100 transition-colors"
                            >
                              وصول
                            </button>
                          </div>
                        )}
                        {app.status === 'checked-in' && (
                          <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleQuickStatusChange(app.id, 'in-progress')}
                              className="text-[0.65rem] bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100 hover:bg-blue-100 transition-colors"
                            >
                              بدء الكشف
                            </button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-left">
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                            setSelectedAppointment(app);
                            setIsEditDialogOpen(true);
                          }}
                          className="h-9 w-9 text-slate-400 hover:text-primary hover:bg-primary/5"
                        >
                          <Edit size={16} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-9 w-9 text-slate-400 hover:text-warning hover:bg-warning/5"
                          onClick={() => handleCancelAppointment(app.id)}
                        >
                          <XCircle size={16} />
                        </Button>
                        {isAdmin && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 text-slate-400 hover:text-danger hover:bg-danger/5" 
                            onClick={() => handleDeleteAppointment(app.id)}
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
              
              {filteredAppointments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 bg-slate-50 rounded-full text-slate-300">
                        <Filter size={48} />
                      </div>
                      <p className="text-slate-500 font-medium text-lg">لا توجد مواعيد تطابق الفلترة الحالية</p>
                      <Button variant="link" onClick={() => { setActiveStatusTab('all'); setSearchQuery(''); }}>إعادة تعيين البحث</Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل بيانات وحالة الموعد</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <form onSubmit={handleUpdateAppointment} className="space-y-5 py-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">تغيير الحالة</Label>
                <select 
                  className="w-full h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  value={selectedAppointment.status}
                  onChange={e => setSelectedAppointment({...selectedAppointment, status: e.target.value})}
                >
                  {Object.entries(APPOINTMENT_STATUS).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">تاريخ معدل</Label>
                  <Input 
                    type="date" 
                    className="h-11 rounded-lg"
                    value={selectedAppointment.date ? toDate(selectedAppointment.date).toISOString().split('T')[0] : ''} 
                    onChange={e => setSelectedAppointment({...selectedAppointment, date: new Date(e.target.value)})} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">وقت جديد</Label>
                  <Input type="time" className="h-11 rounded-lg" value={selectedAppointment.startTime} onChange={e => setSelectedAppointment({...selectedAppointment, startTime: e.target.value})} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">ملاحظات إضافية</Label>
                <textarea 
                  className="w-full min-h-[100px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  value={selectedAppointment.notes || ''}
                  onChange={e => setSelectedAppointment({...selectedAppointment, notes: e.target.value})}
                  placeholder="أي تعليمات أو ملاحظات للموعد..."
                />
              </div>
              <Button type="submit" className="w-full h-12 text-lg font-bold">حفظ التغييرات</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
