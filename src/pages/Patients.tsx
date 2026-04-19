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
  serverTimestamp,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { DataService } from '@/src/lib/dataService';
import { formatArabicDate, toDate } from '@/src/lib/dateUtils';
import { localDB } from '@/src/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { logAction } from '@/src/lib/audit';
import { Patient } from '@/src/types';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Search, 
  UserPlus, 
  FileText, 
  Edit, 
  Trash2, 
  Eye, 
  Hash, 
  Filter, 
  X,
  User,
  Phone,
  Calendar,
  MoreVertical,
  Plus,
  Users,
  UserCheck,
  ClipboardList,
  Droplets,
  ScanLine
} from 'lucide-react';
import { BarcodeScanner } from '@/src/components/BarcodeScanner';
import { toast } from 'sonner';
import { useAuth } from '@/src/context/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent } from '@/components/ui/card';
import MedicalRecordView from '@/src/components/MedicalRecordView';
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Patients() {
  const { profile, isAdmin, isPatient } = useAuth();

  if (isPatient) return null;

  const patients = useLiveQuery(() => localDB.patients.reverse().toArray(), []) || [];
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isMedicalRecordOpen, setIsMedicalRecordOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Filter states
  const [filterGender, setFilterGender] = useState<string>('all');
  const [filterBloodType, setFilterBloodType] = useState<string>('all');
  
  const [newPatient, setNewPatient] = useState({
    name: '',
    phone: '',
    age: '',
    gender: 'male' as 'male' | 'female',
    bloodType: ''
  });

  // No longer need immediate useEffect for onSnapshot as useSync handles global replication
  // and useLiveQuery provides reactive local access

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const mrn = await DataService.getNextSequentialId('patient_mrn', 'AM-');
      
      const patientData: Partial<Patient> = {
        name: newPatient.name,
        phone: newPatient.phone,
        gender: newPatient.gender as 'male' | 'female',
        bloodType: newPatient.bloodType,
        dateOfBirth: `${new Date().getFullYear() - parseInt(newPatient.age)}-01-01`,
        mrn,
      };

      await DataService.create('patients', patientData);
      
      await logAction(
        profile,
        'إنشاء مريض جديد',
        'patient',
        mrn,
        `تم تسجيل مريض جديد: ${newPatient.name} (MRN: ${mrn})`
      );

      toast.success(`تم إضافة المريض بنجاح بالرقم الطبي: ${mrn}`);
      setIsAddDialogOpen(false);
      setNewPatient({ name: '', phone: '', age: '', gender: 'male', bloodType: '' });
    } catch (error) {
      console.error(error);
      toast.error('فشل إضافة المريض');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    try {
      await DataService.update('patients', selectedPatient.id, selectedPatient);

      await logAction(
        profile,
        'تعديل بيانات مريض',
        'patient',
        selectedPatient.id,
        `تم تحديث بيانات المريض: ${selectedPatient.name}`
      );

      toast.success('تم تحديث بيانات المريض');
      setIsEditDialogOpen(false);
    } catch (error) {
      toast.error('فشل تحديث البيانات');
    }
  };

  const handleDeletePatient = async (id: string) => {
    try {
      await DataService.delete('patients', id);
      await logAction(profile, 'حذف مريض', 'patient', id, `تم حذف سجل المريض`);
      toast.success('تم حذف المريض بنجاح');
    } catch (error) {
      toast.error('فشل حذف المريض');
    }
  };

  const filteredPatients = patients.filter(p => {
    const searchLower = searchTerm.toLowerCase();
    const nameStr = (p.name || '').toLowerCase();
    const phoneStr = (p.phone || '');
    const mrnStr = (p.mrn || '').toLowerCase();

    const matchesSearch = nameStr.includes(searchLower) || 
                          phoneStr.includes(searchTerm) ||
                          mrnStr.includes(searchLower);
    
    const matchesGender = filterGender === 'all' || p.gender === filterGender;
    const matchesBloodType = filterBloodType === 'all' || p.bloodType === filterBloodType;

    return matchesSearch && matchesGender && matchesBloodType;
  });

  const getStats = () => {
    const today = new Date().toISOString().split('T')[0];
    const newToday = patients.filter(p => {
      if (!p.createdAt) return false;
      const d = toDate(p.createdAt).toISOString().split('T')[0];
      return d === today;
    });

    return {
      total: patients.length,
      newToday: newToday.length,
      male: patients.filter(p => p.gender === 'male').length,
      female: patients.filter(p => p.gender === 'female').length
    };
  };

  const stats = getStats();

  const handleScan = (barcode: string) => {
    setSearchTerm(barcode);
    setIsScannerOpen(false);
    toast.info(`تم البحث بالباركود: ${barcode}`);
  };

  return (
    <div className="p-6 space-y-8 bg-slate-50/30 min-h-screen" dir="rtl">
      {isScannerOpen && (
        <BarcodeScanner onScan={handleScan} onClose={() => setIsScannerOpen(false)} title="مسح بطاقة المريض (MRN)" />
      )}
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">سجل المرضى</h1>
          <p className="text-slate-500 mt-1">إدارة الملفات الطبية الشاملة والبيانات الديموغرافية</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger render={<Button className="gap-2 bg-primary hover:bg-primary/90 h-11 px-6 text-base shadow-lg shadow-primary/20" />}>
              <UserPlus size={20} />
              تسجيل مريض جديد
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-xl">تسجيل مريض جديد بالنظام</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddPatient} className="space-y-5 py-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">الاسم الكامل (رباعي)</Label>
                  <Input 
                    className="h-11 rounded-lg"
                    placeholder="أدخل الاسم الكامل للمريض كما في الهوية" 
                    value={newPatient.name} 
                    onChange={e => setNewPatient({...newPatient, name: e.target.value})} 
                    required 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">رقم الجوال</Label>
                    <Input className="h-11 rounded-lg" value={newPatient.phone} onChange={e => setNewPatient({...newPatient, phone: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">الجنس</Label>
                    <select 
                      className="w-full h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                      value={newPatient.gender}
                      onChange={e => setNewPatient({...newPatient, gender: e.target.value as 'male' | 'female'})}
                    >
                      <option value="male">ذكر</option>
                      <option value="female">أنثى</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">العمر (بالسنوات)</Label>
                    <Input 
                      type="number" 
                      className="h-11 rounded-lg" 
                      placeholder="أدخل العمر"
                      value={newPatient.age} 
                      onChange={e => setNewPatient({...newPatient, age: e.target.value})} 
                      required 
                      min="0"
                      max="150"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">فصيلة الدم</Label>
                    <select 
                         className="w-full h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                         value={newPatient.bloodType}
                         onChange={e => setNewPatient({...newPatient, bloodType: e.target.value})}
                    >
                        <option value="">غير محدد</option>
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isSubmitting}>
                   {isSubmitting ? 'جاري التسجيل...' : 'إتمام عملية التسجيل'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي المرضى', val: stats.total, icon: Users, color: 'blue' },
          { label: 'سجلات اليوم', val: stats.newToday, icon: UserPlus, color: 'emerald' },
          { label: 'المرضى (ذكور)', val: stats.male, icon: User, color: 'indigo' },
          { label: 'المرضى (إناث)', val: stats.female, icon: User, color: 'rose' },
        ].map((s, idx) => (
          <motion.div key={idx} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}>
            <Card className="border-none shadow-sm hover:shadow-md transition-shadow cursor-default">
              <CardContent className="p-6">
                 <div className="flex justify-between items-center">
                    <div>
                        <p className="text-slate-500 text-sm font-medium">{s.label}</p>
                        <h3 className="text-3xl font-extrabold mt-1">{s.val}</h3>
                    </div>
                    <div className={`p-3 rounded-2xl bg-${s.color}-50 text-${s.color}-600`}>
                        <s.icon size={28} />
                    </div>
                 </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full flex gap-2">
             <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input 
                  placeholder="البحث بالاسم أو الرقم الطبي أو الجوال..."
                  className="pr-10 h-11 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
              />
             </div>
             <Button 
               variant="outline" 
               className="h-11 w-11 p-0 rounded-xl border-slate-200 flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary/30"
               onClick={() => setIsScannerOpen(true)}
             >
               <ScanLine size={18} />
             </Button>
          </div>
         <div className="flex gap-2 w-full md:w-auto">
            <Select value={filterGender} onValueChange={setFilterGender}>
                <SelectTrigger className="h-11 w-40 rounded-xl">
                    <div className="flex items-center gap-2"><Filter size={14} /> <SelectValue placeholder="الجنس" /></div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="male">ذكور</SelectItem>
                    <SelectItem value="female">إناث</SelectItem>
                </SelectContent>
            </Select>
            <Select value={filterBloodType} onValueChange={setFilterBloodType}>
                <SelectTrigger className="h-11 w-40 rounded-xl">
                    <div className="flex items-center gap-2"><Droplets size={14} /> <SelectValue placeholder="فصيلة الدم" /></div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
            </Select>
            <Button variant="ghost" className="h-11 text-slate-400 hover:text-danger" onClick={() => { setSearchTerm(''); setFilterGender('all'); setFilterBloodType('all'); }}>
                مسح
            </Button>
         </div>
      </div>

      {/* Patients List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-none">
                <TableHead className="py-5 text-slate-500 font-bold px-6">بيانات المريض</TableHead>
                <TableHead className="py-5 text-slate-500 font-bold px-6">الرقم الطبي</TableHead>
                <TableHead className="py-5 text-slate-500 font-bold px-6">العمر</TableHead>
                <TableHead className="py-5 text-slate-500 font-bold px-6">فصيلة الدم</TableHead>
                <TableHead className="py-5 text-slate-500 font-bold px-6 text-left">إدارة الملف</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {filteredPatients.map((p, idx) => (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={p.id} 
                    className="group hover:bg-slate-50/80 transition-colors border-b border-slate-50"
                  >
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-lg ${p.gender === 'male' ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'}`}>
                          {p.name.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 leading-tight">{p.name}</span>
                          <div className="flex items-center gap-3 mt-1 text-[0.7rem] text-slate-500">
                             <span className="flex items-center gap-1"><Phone size={12} /> {p.phone}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <Badge variant="outline" className="font-mono bg-slate-100/50 border-slate-200 text-primary px-3 py-1 rounded-lg">
                        {p.mrn}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-700">
                          {p.dateOfBirth ? (new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear()) : '-'} سنة
                        </span>
                        <span className="text-[0.6rem] text-slate-400">{p.dateOfBirth}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-center">
                        {p.bloodType ? (
                            <span className="px-2 py-1 rounded-md bg-red-50 text-red-600 text-xs font-bold border border-red-100">
                                {p.bloodType}
                            </span>
                        ) : <span className="text-slate-300">-</span>}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-left">
                      <div className="flex justify-end gap-2">
                         <Button 
                            className="bg-primary hover:bg-primary/90 gap-2 h-9 px-4 rounded-lg shadow-sm"
                            onClick={() => { setSelectedPatient(p); setIsMedicalRecordOpen(true); }}
                         >
                            <ClipboardList size={16} />
                            فتح السجل
                         </Button>
                         
                         <DropdownMenu>
                            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:bg-slate-100 rounded-lg" />}>
                                <MoreVertical size={18} />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 p-2 rounded-xl border-slate-100 shadow-xl" dir="rtl">
                                <DropdownMenuItem onClick={() => { setSelectedPatient(p); setIsDetailsDialogOpen(true); }} className="gap-2 p-3 rounded-lg cursor-pointer">
                                    <Eye size={16} className="text-slate-400" /> مشاهدة التفاصيل
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSelectedPatient(p); setIsEditDialogOpen(true); }} className="gap-2 p-3 rounded-lg cursor-pointer">
                                    <Edit size={16} className="text-slate-400" /> تعديل البيانات
                                </DropdownMenuItem>
                                {isAdmin && (
                                    <DropdownMenuItem onClick={() => handleDeletePatient(p.id)} className="gap-2 p-3 rounded-lg cursor-pointer text-danger hover:bg-danger/5">
                                        <Trash2 size={16} /> حذف السجل نهائياً
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                         </DropdownMenu>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
          
          {filteredPatients.length === 0 && (
             <div className="py-32 text-center">
                <div className="inline-flex p-6 rounded-full bg-slate-50 text-slate-200 mb-4">
                    <Search size={64} />
                </div>
                <h3 className="text-slate-400 font-medium text-xl">لا يوجد نتائج تطابق البحث الحالي</h3>
             </div>
          )}
        </div>
      </div>

      {/* Side Panel Patient Record */}
      <AnimatePresence>
        {isMedicalRecordOpen && selectedPatient && (
            <>
                <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }} 
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 overflow-hidden" 
                    onClick={() => setIsMedicalRecordOpen(false)}
                />
                <MedicalRecordView 
                    patient={selectedPatient} 
                    onClose={() => setIsMedicalRecordOpen(false)} 
                />
            </>
        )}
      </AnimatePresence>

      {/* Details/Edit Dialogs handled separately if needed for small tweaks */}
      {/* ... keeping the simple dialogs for quick edits as they were well integrated ... */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل بيانات مريض</DialogTitle>
          </DialogHeader>
          {selectedPatient && (
            <form onSubmit={handleEditPatient} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>الاسم الكامل</Label>
                <Input value={selectedPatient.name} onChange={e => setSelectedPatient({...selectedPatient, name: e.target.value})} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>الجوال</Label>
                    <Input value={selectedPatient.phone} onChange={e => setSelectedPatient({...selectedPatient, phone: e.target.value})} required />
                </div>
                <div className="space-y-2">
                    <Label>فصيلة الدم</Label>
                    <select 
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={selectedPatient.bloodType}
                        onChange={e => setSelectedPatient({...selectedPatient, bloodType: e.target.value})}
                    >
                        <option value="">غير محدد</option>
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>العمر (سنوات)</Label>
                    <Input 
                        type="number" 
                        value={selectedPatient.dateOfBirth ? (new Date().getFullYear() - new Date(selectedPatient.dateOfBirth).getFullYear()) : ''} 
                        onChange={e => {
                            const age = parseInt(e.target.value);
                            const dobYear = new Date().getFullYear() - age;
                            setSelectedPatient({...selectedPatient, dateOfBirth: `${dobYear}-01-01`});
                        }} 
                        required 
                    />
                </div>
                <div className="space-y-2">
                    <Label>الجنس</Label>
                    <select 
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={selectedPatient.gender}
                        onChange={e => setSelectedPatient({...selectedPatient, gender: e.target.value as 'male' | 'female'})}
                    >
                        <option value="male">ذكر</option>
                        <option value="female">أنثى</option>
                    </select>
                </div>
              </div>
              <Button type="submit" className="w-full">تحديث الملف</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Simple Stats & Info Modal */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[450px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>بطاقة المريض التعريفية</DialogTitle>
          </DialogHeader>
          {selectedPatient && (
            <div className="space-y-6 py-4">
               <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-2xl ${selectedPatient.gender === 'male' ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'}`}>
                    {selectedPatient.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{selectedPatient.name}</h3>
                    <Badge className="bg-primary mt-1">{selectedPatient.mrn}</Badge>
                  </div>
               </div>
               
               <div className="grid grid-cols-2 gap-y-4 text-sm">
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 font-medium">رقم الجوال</span>
                    <span className="font-bold">{selectedPatient.phone}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 font-medium">العمر</span>
                    <span className="font-bold">{new Date().getFullYear() - new Date(selectedPatient.dateOfBirth).getFullYear()} سنة</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 font-medium">تاريخ الميلاد</span>
                    <span className="font-bold">{selectedPatient.dateOfBirth}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 font-medium">فصيلة الدم</span>
                    <span className="font-bold text-red-600">{selectedPatient.bloodType || 'غير محدد'}</span>
                  </div>
               </div>
               
               <div className="pt-4 border-t">
                  <Button className="w-full h-11" variant="outline" onClick={() => setIsDetailsDialogOpen(false)}>إغلاق البطاقة</Button>
               </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
