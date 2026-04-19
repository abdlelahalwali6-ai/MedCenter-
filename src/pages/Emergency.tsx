/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where, orderBy, addDoc, serverTimestamp, Timestamp, updateDoc, doc } from 'firebase/firestore';
import { db, getNextMRN } from '@/src/lib/firebase';
import { useAuth } from '@/src/context/AuthContext';
import { toast } from 'sonner';
import { 
  Plus, 
  Search, 
  Activity, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  UserPlus, 
  MoreVertical, 
  Stethoscope, 
  FlaskConical, 
  ImageIcon, 
  CreditCard,
  Heart,
  Thermometer,
  Wind,
  LayoutDashboard,
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

interface TriageCase {
  id: string;
  patientName: string;
  patientId?: string;
  mrn?: string;
  phone: string;
  status: 'triage' | 'active' | 'observation' | 'discharged' | 'admitted';
  priority: 'emergency' | 'urgent' | 'standard' | 'non-urgent';
  vitals?: {
    bp?: string;
    temp?: string;
    hr?: string;
    spo2?: string;
  };
  complaint: string;
  createdAt: any;
  updatedAt: any;
}

export default function Emergency() {
  const { profile } = useAuth();
  const [cases, setCases] = useState<TriageCase[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCase, setSelectedCase] = useState<TriageCase | null>(null);
  const [isVitalsOpen, setIsVitalsOpen] = useState(false);

  const [formData, setFormData] = useState({
    patientName: '',
    phone: '',
    priority: 'standard' as TriageCase['priority'],
    complaint: ''
  });

  const [vitalsData, setVitalsData] = useState({
    bp: '',
    temp: '',
    hr: '',
    spo2: ''
  });

  useEffect(() => {
    const q = query(
      collection(db, 'emergency_cases'),
      where('status', 'in', ['triage', 'active', 'observation']),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setCases(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as TriageCase));
    }, (error) => {
      console.error("Emergency cases fetch error:", error);
      toast.error('فشل في مزامنة بيانات الطوارئ');
    });

    return () => unsub();
  }, []);

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patientName || !formData.complaint) {
      toast.error('يرجى إدخال اسم المريض والشكوى الرئيسية');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'emergency_cases'), {
        ...formData,
        status: 'triage',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: profile?.uid,
        createdByName: profile?.displayName
      });
      setIsOpen(false);
      setFormData({ patientName: '', phone: '', priority: 'standard', complaint: '' });
      toast.success('تم تسجيل حالة طوارئ جديدة بنجاح');
    } catch (error) {
      toast.error('فشل في تسجيل الحالة');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateVitals = async () => {
    if (!selectedCase) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'emergency_cases', selectedCase.id), {
        vitals: vitalsData,
        updatedAt: serverTimestamp()
      });
      setIsVitalsOpen(false);
      toast.success('تم تحديث العلامات الحيوية');
    } catch (error) {
      toast.error('فشل في التحديث');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: TriageCase['status']) => {
    try {
      await updateDoc(doc(db, 'emergency_cases', id), {
        status,
        updatedAt: serverTimestamp()
      });
      toast.success('تم تغيير حالة الحالة');
    } catch (error) {
      toast.error('فشل في تغيير الحالة');
    }
  };

  const filteredCases = cases.filter(c => {
    const name = c.patientName || '';
    const phone = c.phone || '';
    const search = searchTerm.toLowerCase();
    
    return name.toLowerCase().includes(search) ||
           phone.includes(searchTerm);
  });

  const getPriorityColor = (priority: TriageCase['priority']) => {
    switch (priority) {
      case 'emergency': return 'bg-rose-500 text-white';
      case 'urgent': return 'bg-amber-500 text-white';
      case 'standard': return 'bg-sky-500 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  const getStatusBadge = (status: TriageCase['status']) => {
    switch (status) {
      case 'triage': return <Badge variant="secondary">فرز طبي</Badge>;
      case 'active': return <Badge className="bg-emerald-500">تحت المعاينة</Badge>;
      case 'observation': return <Badge className="bg-amber-500">تحت الملاحظة</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-3 bg-rose-500 text-white rounded-2xl shadow-lg shadow-rose-200">
              <Activity size={28} />
            </div>
            قسم الطوارئ والفرز الطبي
          </h1>
          <p className="text-slate-500 font-medium mt-1">إدارة الحالات العاجلة والفرز الطبي الفوري</p>
        </div>
        <Button 
          onClick={() => setIsOpen(true)} 
          className="rounded-xl h-12 px-6 font-bold gap-2 bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-100"
        >
          <Plus size={20} />
          تسجيل حالة طارئة
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-none shadow-xl shadow-slate-200/50 bg-rose-50/50">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <span className="text-[0.7rem] font-black text-rose-600 uppercase tracking-widest">حالات حرجة</span>
              <AlertTriangle className="text-rose-500" size={18} />
            </div>
            <div className="mt-2 text-3xl font-black text-rose-700">
              {cases.filter(c => c.priority === 'emergency').length}
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-xl shadow-slate-200/50">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <span className="text-[0.7rem] font-black text-amber-600 uppercase tracking-widest">تحت الملاحظة</span>
              <Clock className="text-amber-500" size={18} />
            </div>
            <div className="mt-2 text-3xl font-black text-slate-900">
              {cases.filter(c => c.status === 'observation').length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl shadow-slate-200/50 lg:col-span-2">
          <div className="relative p-6">
            <Search className="absolute right-10 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input 
              placeholder="ابحث باسم المريض أو رقم الهاتف..." 
              className="pr-12 h-14 bg-white border-slate-200 rounded-2xl shadow-inner"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredCases.map((c) => (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-2xl ${getPriorityColor(c.priority)}`}>
                      <Activity size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-black text-slate-900 text-lg">{c.patientName}</h3>
                        {getStatusBadge(c.status)}
                      </div>
                      <p className="text-sm text-slate-500 font-medium mt-1">{c.complaint}</p>
                      
                      <div className="flex flex-wrap gap-4 mt-4">
                        <div className="flex items-center gap-1.5 text-[0.7rem] font-bold text-slate-400">
                          <Heart size={14} className="text-rose-500" />
                          نبض: <span className="text-slate-900">{c.vitals?.hr || '--'} bpm</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[0.7rem] font-bold text-slate-400">
                          <Thermometer size={14} className="text-amber-500" />
                          حرارة: <span className="text-slate-900">{c.vitals?.temp || '--'} °C</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[0.7rem] font-bold text-slate-400">
                          <Wind size={14} className="text-sky-500" />
                          أكسجين: <span className="text-slate-900">{c.vitals?.spo2 || '--'} %</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="rounded-xl font-bold h-9 bg-slate-50 border-slate-200"
                      onClick={() => {
                        setSelectedCase(c);
                        setVitalsData(c.vitals || { bp: '', temp: '', hr: '', spo2: '' });
                        setIsVitalsOpen(true);
                      }}
                    >
                      تحديث العلامات
                    </Button>
                    {c.status === 'triage' && (
                      <Button 
                        size="sm" 
                        className="rounded-xl font-bold h-9 bg-primary"
                        onClick={() => updateStatus(c.id, 'active')}
                      >
                        بدء المعاينة
                      </Button>
                    )}
                    {c.status === 'active' && (
                      <Button 
                        size="sm" 
                        className="rounded-xl font-bold h-9 bg-amber-500"
                        onClick={() => updateStatus(c.id, 'observation')}
                      >
                        تحويل للملاحظة
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="space-y-6">
          <Card className="rounded-[2rem] border-slate-200/50 shadow-2xl shadow-slate-200/20 overflow-hidden">
            <CardHeader className="bg-slate-50/50 px-7 py-6">
              <CardTitle className="text-lg font-black tracking-tight">إجراءات سريعة</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              <Button variant="ghost" className="w-full justify-start h-12 rounded-xl gap-3 font-bold hover:bg-rose-50 hover:text-rose-600 transition-all">
                <AlertTriangle size={18} />
                تنبيه فريق الإنعاش (Code Blue)
              </Button>
              <Button variant="ghost" className="w-full justify-start h-12 rounded-xl gap-3 font-bold hover:bg-sky-50 hover:text-sky-600 transition-all">
                <LayoutDashboard size={18} />
                مراجعة إشغال الأسرة
              </Button>
              <Button variant="ghost" className="w-full justify-start h-12 rounded-xl gap-3 font-bold hover:bg-emerald-50 hover:text-emerald-600 transition-all">
                <ClipboardList size={18} />
                سجل الدخول اليومي
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-slate-200/50 shadow-2xl shadow-slate-200/20">
            <CardHeader className="px-7 py-6">
              <CardTitle className="text-lg font-black tracking-tight">طلبات خارجية عاجلة</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                    <FlaskConical size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800">فحوصات دم عاجلة</p>
                    <p className="text-[0.6rem] text-slate-400 font-bold uppercase">قيد التنفيذ</p>
                  </div>
                </div>
                <span className="text-[0.6rem] font-bold text-slate-400">منذ 5 د</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sky-100 text-sky-600 rounded-lg">
                    <ImageIcon size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800">أشعة سينية (الصدر)</p>
                    <p className="text-[0.6rem] text-slate-400 font-bold uppercase">بانتظار النتائج</p>
                  </div>
                </div>
                <span className="text-[0.6rem] font-bold text-slate-400">منذ 12 د</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تسجيل حالة طارئة جديدة</DialogTitle>
            <DialogDescription>أدخل البيانات الأساسية للبدء في عملية الفرز الطبي.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCase} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>اسم المريض</Label>
              <Input 
                value={formData.patientName}
                onChange={e => setFormData({...formData, patientName: e.target.value})}
                placeholder="أدخل الاسم الرباعي إن أمكن"
                className="h-12"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>رقم الجوال</Label>
                <Input 
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="h-12"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>مستوى الأولوية</Label>
                <Select 
                  value={formData.priority} 
                  onValueChange={(val: any) => setFormData({...formData, priority: val})}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emergency">حراجة (أحمر)</SelectItem>
                    <SelectItem value="urgent">عاجل (برتقالي)</SelectItem>
                    <SelectItem value="standard">متوسط (أصفر)</SelectItem>
                    <SelectItem value="non-urgent">غير عاجل (أخضر)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>الشكوى الرئيسية</Label>
              <Input 
                value={formData.complaint}
                onChange={e => setFormData({...formData, complaint: e.target.value})}
                placeholder="ألم في الصدر، ضيق تنفس، إلخ..."
                className="h-12"
              />
            </div>
            <Button type="submit" className="w-full h-12 font-bold text-lg" disabled={isSubmitting}>
              {isSubmitting ? 'جاري التسجيل...' : 'تسجيل الحالة'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isVitalsOpen} onOpenChange={setIsVitalsOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تحديث العلامات الحيوية</DialogTitle>
            <DialogDescription>للمريض: {selectedCase?.patientName}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4 uppercase">
            <div className="space-y-2">
              <Label>ضغط الدم (BP)</Label>
              <Input value={vitalsData.bp} onChange={e => setVitalsData({...vitalsData, bp: e.target.value})} placeholder="120/80" className="h-12" />
            </div>
            <div className="space-y-2">
              <Label>الحرارة (Temp)</Label>
              <Input value={vitalsData.temp} onChange={e => setVitalsData({...vitalsData, temp: e.target.value})} placeholder="37.0" className="h-12" />
            </div>
            <div className="space-y-2">
              <Label>النبض (HR)</Label>
              <Input value={vitalsData.hr} onChange={e => setVitalsData({...vitalsData, hr: e.target.value})} placeholder="80" className="h-12" />
            </div>
            <div className="space-y-2">
              <Label>الأكسجين (SpO2)</Label>
              <Input value={vitalsData.spo2} onChange={e => setVitalsData({...vitalsData, spo2: e.target.value})} placeholder="98" className="h-12" />
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full h-12 font-bold" onClick={handleUpdateVitals} disabled={isSubmitting}>
              تحديث البيانات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
