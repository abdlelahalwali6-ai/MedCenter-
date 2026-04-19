/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where, orderBy, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/context/AuthContext';
import { toast } from 'sonner';
import { 
  Plus, 
  Bed, 
  MapPin, 
  Users, 
  UserPlus, 
  CheckCircle2, 
  AlertCircle, 
  MoreVertical,
  LogOut,
  Settings,
  Pill,
  Activity,
  ClipboardList
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from 'motion/react';

interface WardBed {
  id: string;
  bedNumber: string;
  roomNumber: string;
  floor: string;
  type: 'standard' | 'icu' | 'vip' | 'pediatric';
  status: 'available' | 'occupied' | 'maintenance' | 'cleaning';
  patientId?: string;
  patientName?: string;
  admissionDate?: any;
  lastNursingCheck?: any;
}

export default function Wards() {
  const { profile } = useAuth();
  const [beds, setBeds] = useState<WardBed[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterFloor, setFilterFloor] = useState('all');
  const [isAdmissionOpen, setIsAdmissionOpen] = useState(false);
  const [selectedBed, setSelectedBed] = useState<WardBed | null>(null);

  const [formData, setFormData] = useState({
    bedNumber: '',
    roomNumber: '',
    floor: '1',
    type: 'standard' as WardBed['type']
  });

  const [admissionData, setAdmissionData] = useState({
    patientName: '',
    patientId: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'wards'), orderBy('floor'), orderBy('roomNumber'), orderBy('bedNumber'));
    const unsub = onSnapshot(q, (snap) => {
      setBeds(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as WardBed));
    }, (error) => {
      console.error("Wards fetch error:", error);
      toast.error('فشل في مزامنة بيانات الأسرة');
    });
    return () => unsub();
  }, []);

  const handleAddBed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.bedNumber || !formData.roomNumber) {
      toast.error('يرجى إدخال رقم السرير والغرفة');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'wards'), {
        ...formData,
        status: 'available',
        createdAt: serverTimestamp()
      });
      setIsOpen(false);
      setFormData({ bedNumber: '', roomNumber: '', floor: '1', type: 'standard' });
      toast.success('تم إضافة السرير بنجاح');
    } catch (error) {
      toast.error('فشل في الإضافة');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdmission = async () => {
    if (!selectedBed || !admissionData.patientName) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'wards', selectedBed.id), {
        status: 'occupied',
        patientName: admissionData.patientName,
        patientId: admissionData.patientId,
        admissionDate: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setIsAdmissionOpen(false);
      setAdmissionData({ patientName: '', patientId: '' });
      toast.success('تم تنويم المريض بنجاح');
    } catch (error) {
      toast.error('فشل في التنويم');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDischarge = async (bed: WardBed) => {
    if (!confirm('هل أنت متأكد من رغبتك في خروج المريض وتحرير السرير؟')) return;
    try {
      await updateDoc(doc(db, 'wards', bed.id), {
        status: 'cleaning',
        patientName: null,
        patientId: null,
        admissionDate: null,
        updatedAt: serverTimestamp()
      });
      toast.success('تم البدء في إجراءات الخروج والتعقيم');
    } catch (error) {
      toast.error('فشل الإجراء');
    }
  };

  const setMaintenance = async (id: string, status: WardBed['status']) => {
    try {
      await updateDoc(doc(db, 'wards', id), { status, updatedAt: serverTimestamp() });
      toast.success('تم تحديث حالة السرير');
    } catch (error) {
      toast.error('فشل التحديث');
    }
  };

  const filteredBeds = beds.filter(b => filterFloor === 'all' || b.floor === filterFloor);

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-3 bg-sky-500 text-white rounded-2xl shadow-lg shadow-sky-200">
              <Bed size={28} />
            </div>
            أقسام التنويم والأسرة
          </h1>
          <p className="text-slate-500 font-medium mt-1">إدارة غرف المرضى وتوافر الأسرة في الوقت الفعلي</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterFloor} onValueChange={setFilterFloor}>
            <SelectTrigger className="w-[120px] h-12 rounded-xl">
              <SelectValue placeholder="الدور" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأدوار</SelectItem>
              <SelectItem value="1">الدور 1</SelectItem>
              <SelectItem value="2">الدور 2</SelectItem>
              <SelectItem value="3">الدور 3</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={() => setIsOpen(true)} 
            className="rounded-xl h-12 px-6 font-bold gap-2"
          >
            <Plus size={20} />
            إضافة سرير جديد
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="stat-card">
          <div className="flex justify-between items-start mb-2">
            <span className="stat-label">الأسرة الشاغرة</span>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <span className="stat-value text-emerald-600">{beds.filter(b => b.status === 'available').length}</span>
        </div>
        <div className="stat-card">
          <div className="flex justify-between items-start mb-2">
            <span className="stat-label">الأسرة المشغولة</span>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
              <Users size={18} />
            </div>
          </div>
          <span className="stat-value text-rose-600">{beds.filter(b => b.status === 'occupied').length}</span>
        </div>
        <div className="stat-card">
          <div className="flex justify-between items-start mb-2">
            <span className="stat-label">قيد التعقيم/الصيانة</span>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <Settings size={18} />
            </div>
          </div>
          <span className="stat-value text-amber-600">{beds.filter(b => b.status === 'cleaning' || b.status === 'maintenance').length}</span>
        </div>
        <div className="stat-card">
          <div className="flex justify-between items-start mb-2">
            <span className="stat-label">إجمالي الأسرة</span>
            <div className="p-2.5 bg-slate-50 text-slate-600 rounded-xl">
              <Bed size={18} />
            </div>
          </div>
          <span className="stat-value">{beds.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredBeds.map((bed) => (
          <motion.div
            key={bed.id}
            layout
            className={`
              p-5 rounded-3xl border-2 transition-all flex flex-col gap-4 relative
              ${bed.status === 'available' ? 'bg-white border-emerald-100 hover:border-emerald-300' :
                bed.status === 'occupied' ? 'bg-white border-rose-100 hover:border-rose-300' :
                'bg-slate-50 border-slate-200'}
            `}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-slate-900">Bed {bed.bedNumber}</span>
                  <span className={`px-2 py-0.5 rounded-md text-[0.6rem] font-bold uppercase ${
                    bed.type === 'icu' ? 'bg-rose-500 text-white' :
                    bed.type === 'vip' ? 'bg-amber-500 text-white' :
                    'bg-slate-200 text-slate-700'
                  }`}>
                    {bed.type}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 mt-1">
                  <MapPin size={12} />
                  <span className="text-xs font-bold">Floor {bed.floor}, Room {bed.roomNumber}</span>
                </div>
              </div>
              <div className={`p-2 rounded-xl ${
                bed.status === 'available' ? 'bg-emerald-100 text-emerald-600' :
                bed.status === 'occupied' ? 'bg-rose-100 text-rose-600' :
                'bg-slate-200 text-slate-500'
              }`}>
                <Bed size={20} />
              </div>
            </div>

            {bed.status === 'occupied' ? (
              <div className="mt-2 space-y-3">
                <div className="p-3 bg-rose-50/50 rounded-2xl">
                  <p className="text-[0.65rem] font-black text-rose-600 uppercase tracking-widest">المريض المنوم</p>
                  <p className="text-sm font-bold text-slate-800 mt-1 truncate">{bed.patientName}</p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 rounded-xl h-9 border-rose-100 text-rose-600 hover:bg-rose-50"
                    onClick={() => handleDischarge(bed)}
                  >
                    خروج
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-400">
                    <Activity size={16} />
                  </Button>
                </div>
              </div>
            ) : bed.status === 'available' ? (
              <div className="mt-auto space-y-3">
                <p className="text-[0.7rem] font-bold text-emerald-600 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  جاهز للاستقبال
                </p>
                <div className="flex gap-2">
                  <Button 
                    className="flex-1 rounded-xl h-9 bg-emerald-500 hover:bg-emerald-600"
                    onClick={() => {
                      setSelectedBed(bed);
                      setIsAdmissionOpen(true);
                    }}
                  >
                    تنويم مريض
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 rounded-xl text-slate-400"
                    onClick={() => setMaintenance(bed.id, 'maintenance')}
                  >
                    <Settings size={16} />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-auto">
                <Badge variant="outline" className="mb-2">قيد {bed.status === 'cleaning' ? 'التعقيم' : 'الصيانة'}</Badge>
                <Button 
                  variant="outline" 
                  className="w-full rounded-xl h-9 text-xs"
                  onClick={() => setMaintenance(bed.id, 'available')}
                >
                  تغيير الجاهزية
                </Button>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة سرير جديد للقسم</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddBed} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>رقم السرير</Label>
                <Input value={formData.bedNumber} onChange={e => setFormData({...formData, bedNumber: e.target.value})} placeholder="مثلاً: 101-A" />
              </div>
              <div className="space-y-2">
                <Label>رقم الغرفة</Label>
                <Input value={formData.roomNumber} onChange={e => setFormData({...formData, roomNumber: e.target.value})} placeholder="مثلاً: 101" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الدور / الطابق</Label>
                <Select value={formData.floor} onValueChange={val => setFormData({...formData, floor: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">الدور الأول</SelectItem>
                    <SelectItem value="2">الدور الثاني</SelectItem>
                    <SelectItem value="3">الدور الثالث</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>نوع السرير</Label>
                <Select value={formData.type} onValueChange={(val: any) => setFormData({...formData, type: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">استاندرد</SelectItem>
                    <SelectItem value="icu">عناية مركزة (ICU)</SelectItem>
                    <SelectItem value="vip">جناح ملكي (VIP)</SelectItem>
                    <SelectItem value="pediatric">أطفال</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" className="w-full h-12 font-bold" disabled={isSubmitting}>إضافة السرير لمخزون الأقسام</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAdmissionOpen} onOpenChange={setIsAdmissionOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تنويم مريض في السرير {selectedBed?.bedNumber}</DialogTitle>
            <DialogDescription>يرجى اختيار المريض لبدء إجراءات التنويم الطبي.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>اسم المريض الكامل</Label>
              <Input 
                value={admissionData.patientName} 
                onChange={e => setAdmissionData({...admissionData, patientName: e.target.value})} 
                placeholder="ابحث أو أدخل الاسم..."
              />
            </div>
            <div className="space-y-2">
              <Label>الرقم الطبي (اختياري)</Label>
              <Input 
                value={admissionData.patientId} 
                onChange={e => setAdmissionData({...admissionData, patientId: e.target.value})} 
              />
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl text-[0.7rem] text-slate-500 font-medium">
              * سيتم إنشاء ملف متابعة تمريض (Nurses Chart) تلقائياً لهذا المريض بمجرد التنويم.
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full h-12 font-bold" onClick={handleAdmission} disabled={isSubmitting}>
              إتمام التنويم
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
