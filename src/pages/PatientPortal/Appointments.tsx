/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where, orderBy, Timestamp, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { toDate } from '@/src/lib/dateUtils';
import { useAuth } from '@/src/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Clock, Plus, XCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function PatientAppointments() {
  const { user, profile } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [newApp, setNewApp] = useState({
    doctorId: '',
    doctorName: '',
    type: 'consultation',
    date: '',
    time: ''
  });

  const doctors = [
    { id: 'doc1', name: 'د. فهد الجاسر', specialty: 'الأسنان' },
    { id: 'doc2', name: 'د. ريم خالد', specialty: 'العيادة العامة' },
    { id: 'doc3', name: 'د. سارة العتيبي', specialty: 'الأطفال' },
  ];

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'appointments'),
      where('patientId', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setAppointments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleBook = async () => {
    if (!newApp.doctorId || !newApp.date || !newApp.time) {
      toast.error('يرجى إكمال جميع الحقول');
      return;
    }

    setIsBooking(true);
    try {
      const selectedDoctor = doctors.find(d => d.id === newApp.doctorId);
      await addDoc(collection(db, 'appointments'), {
        patientId: user?.uid,
        patientName: profile?.displayName || 'مريض',
        doctorId: newApp.doctorId,
        doctorName: selectedDoctor?.name,
        date: Timestamp.fromDate(new Date(newApp.date)),
        startTime: newApp.time,
        status: 'scheduled',
        type: newApp.type,
        createdAt: serverTimestamp()
      });
      toast.success('تم حجز الموعد بنجاح');
      setNewApp({ doctorId: '', doctorName: '', type: 'consultation', date: '', time: '' });
    } catch (error) {
      toast.error('فشل حجز الموعد');
    } finally {
      setIsBooking(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await updateDoc(doc(db, 'appointments', id), {
        status: 'cancelled',
        updatedAt: serverTimestamp()
      });
      toast.success('تم إلغاء الموعد');
    } catch (error) {
      toast.error('فشل إلغاء الموعد');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">مجدول</Badge>;
      case 'completed': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">مكتمل</Badge>;
      case 'cancelled': return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">ملغي</Badge>;
      case 'in-progress': return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">قيد التنفيذ</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">مواعيدي</h1>
          <p className="text-muted-foreground">إدارة مواعيدك الطبية القادمة والسابقة.</p>
        </div>
        
        <Dialog>
          <DialogTrigger render={<Button className="gap-2" />}>
            <Plus size={18} />
            حجز موعد جديد
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]" dir="rtl">
            <DialogHeader>
              <DialogTitle>حجز موعد جديد</DialogTitle>
              <DialogDescription>
                اختر الطبيب والوقت المناسب لك.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>الطبيب</Label>
                <Select onValueChange={(v) => setNewApp({...newApp, doctorId: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الطبيب" />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map(doc => (
                      <SelectItem key={doc.id} value={doc.id}>{doc.name} - {doc.specialty}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>نوع الزيارة</Label>
                <Select onValueChange={(v) => setNewApp({...newApp, type: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="نوع الزيارة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultation">استشارة</SelectItem>
                    <SelectItem value="follow-up">متابعة</SelectItem>
                    <SelectItem value="emergency">طارئ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>التاريخ</Label>
                  <input 
                    type="date" 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    onChange={(e) => setNewApp({...newApp, date: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>الوقت</Label>
                  <input 
                    type="time" 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    onChange={(e) => setNewApp({...newApp, time: e.target.value})}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleBook} disabled={isBooking}>
                {isBooking ? 'جاري الحجز...' : 'تأكيد الحجز'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="text-center py-12">جاري التحميل...</div>
        ) : appointments.length > 0 ? (
          appointments.map((app) => (
            <Card key={app.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row">
                  <div className="bg-slate-50 p-6 flex flex-col items-center justify-center border-l md:w-48">
                    <CalendarIcon className="text-primary mb-2" size={24} />
                    <span className="font-bold text-lg">{toDate(app.date).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })}</span>
                    <span className="text-xs text-muted-foreground">{toDate(app.date).getFullYear()}</span>
                  </div>
                  <div className="flex-1 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg">{app.doctorName}</h3>
                        {getStatusBadge(app.status)}
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground gap-4">
                        <span className="flex items-center gap-1"><Clock size={14} /> {app.startTime}</span>
                        <span className="flex items-center gap-1"><CheckCircle2 size={14} /> {app.type === 'consultation' ? 'استشارة' : app.type === 'follow-up' ? 'متابعة' : 'طارئ'}</span>
                      </div>
                    </div>
                    
                    {app.status === 'scheduled' && (
                      <Button variant="ghost" className="text-danger hover:text-danger hover:bg-danger/10 gap-2" onClick={() => handleCancel(app.id)}>
                        <XCircle size={18} />
                        إلغاء الموعد
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="p-12 text-center border-dashed">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <CalendarIcon size={48} className="opacity-20" />
              <p>لا توجد مواعيد مسجلة حالياً.</p>
              <Button variant="link">احجز موعدك الأول الآن</Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
