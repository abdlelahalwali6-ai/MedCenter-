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
  orderBy
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { DataService } from '@/src/lib/dataService';
import { formatArabicDate, toDate } from '@/src/lib/dateUtils';
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
  DialogTrigger
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Search, 
  UserPlus, 
  Edit, 
  Trash2, 
  Eye,
  MoreVertical,
  Loader2,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/src/context/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from 'framer-motion';
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

  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isMedicalRecordOpen, setIsMedicalRecordOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newPatient, setNewPatient] = useState({
    name: '',
    phone: '',
    age: '',
    gender: 'male' as 'male' | 'female',
    bloodType: ''
  });

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'patients'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const patientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Patient[];
        setPatients(patientsData);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'patients');
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const mrn = await DataService.getNextSequentialId('patient_mrn', 'AM-');
      await DataService.create('patients', { 
        ...newPatient, 
        mrn, 
        dateOfBirth: `${new Date().getFullYear() - parseInt(newPatient.age)}-01-01` 
      });
      toast.success(`تم إضافة المريض بنجاح بالرقم الطبي: ${mrn}`);
      setIsAddDialogOpen(false);
      setNewPatient({ name: '', phone: '', age: '', gender: 'male', bloodType: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'patient');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    setIsSubmitting(true);
    try {
      await DataService.update('patients', selectedPatient.id, selectedPatient);
      toast.success('تم تحديث بيانات المريض');
      setIsEditDialogOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'patient');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePatient = async (id: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا المريض؟ سيتم حذف جميع سجلاته المرتبطة.")) return;
    try {
      await DataService.delete('patients', id);
      toast.success('تم حذف المريض بنجاح');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'patient');
    }
  };

  const filteredPatients = patients.filter(p => {
    const searchLower = searchTerm.toLowerCase();
    return (p.name || '').toLowerCase().includes(searchLower) || 
           (p.phone || '').includes(searchTerm) || 
           (p.mrn || '').toLowerCase().includes(searchLower);
  });

  return (
    <div className="p-6 space-y-8 min-h-screen" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">سجل المرضى</h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><UserPlus size={18} /> تسجيل مريض جديد</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>تسجيل مريض جديد</DialogTitle></DialogHeader>
            <form onSubmit={handleAddPatient} className="space-y-4 py-4">
              <Input placeholder="الاسم الكامل" value={newPatient.name} onChange={e => setNewPatient({...newPatient, name: e.target.value})} required />
              <Input placeholder="رقم الجوال" value={newPatient.phone} onChange={e => setNewPatient({...newPatient, phone: e.target.value})} required />
              <Input type="number" placeholder="العمر" value={newPatient.age} onChange={e => setNewPatient({...newPatient, age: e.target.value})} required />
              <Select value={newPatient.gender} onValueChange={(value) => setNewPatient({...newPatient, gender: value as 'male' | 'female'})}>
                <SelectTrigger><SelectValue placeholder="الجنس" /></SelectTrigger>
                <SelectContent><SelectItem value="male">ذكر</SelectItem><SelectItem value="female">أنثى</SelectItem></SelectContent>
              </Select>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : 'إتمام التسجيل'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white p-4 rounded-xl border">
        <Input placeholder="البحث بالاسم، الرقم الطبي، أو الجوال..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      {loading ? (
        <div className="text-center py-20"><Loader2 className="mx-auto animate-spin text-primary" size={48} /></div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <Table>
            <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>الرقم الطبي</TableHead><TableHead>العمر</TableHead><TableHead>إدارة</TableHead></TableRow></TableHeader>
            <TableBody>
              {filteredPatients.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell><Badge variant="secondary">{p.mrn}</Badge></TableCell>
                  <TableCell>{p.dateOfBirth ? new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear() : ''}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical size={16}/></Button></DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => { setSelectedPatient(p); setIsMedicalRecordOpen(true); }}>فتح السجل</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelectedPatient(p); setIsEditDialogOpen(true); }}>تعديل</DropdownMenuItem>
                        {isAdmin && <DropdownMenuItem onClick={() => handleDeletePatient(p.id)} className="text-danger">حذف</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filteredPatients.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-10">لا توجد نتائج</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      )}

      <AnimatePresence>
        {isMedicalRecordOpen && selectedPatient && (
          <MedicalRecordView patient={selectedPatient} onClose={() => setIsMedicalRecordOpen(false)} />
        )}
      </AnimatePresence>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>تعديل بيانات المريض</DialogTitle></DialogHeader>
          {selectedPatient && (
            <form onSubmit={handleEditPatient} className="space-y-4 py-4">
              <Input value={selectedPatient.name} onChange={e => setSelectedPatient(sp => sp ? {...sp, name: e.target.value} : null)} required />
              <Input value={selectedPatient.phone} onChange={e => setSelectedPatient(sp => sp ? {...sp, phone: e.target.value} : null)} required />
              <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin"/> : 'تحديث'}</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
