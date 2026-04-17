/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { formatArabicDate } from '@/src/lib/dateUtils';
import { useAuth } from '@/src/context/AuthContext';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { 
  Calendar, 
  FileText, 
  MessageSquare, 
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Users
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function PatientDashboard() {
  const { user } = useAuth();
  const [nextAppointment, setNextAppointment] = useState<any>(null);
  const [recentRecords, setRecentRecords] = useState<any[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (!user) return;

    // Next Appointment
    const qApp = query(
      collection(db, 'appointments'),
      where('patientId', '==', user.uid),
      where('date', '>=', Timestamp.now()),
      orderBy('date', 'asc'),
      limit(1)
    );
    const unsubApp = onSnapshot(qApp, (snap) => {
      if (!snap.empty) {
        setNextAppointment({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setNextAppointment(null);
      }
    });

    // Recent Medical Records
    const qRec = query(
      collection(db, 'medical_records'),
      where('patientId', '==', user.uid),
      orderBy('date', 'desc'),
      limit(3)
    );
    const unsubRec = onSnapshot(qRec, (snap) => {
      setRecentRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Unread Messages
    const qMsg = query(
      collection(db, 'messages'),
      where('receiverId', '==', user.uid),
      where('read', '==', false)
    );
    const unsubMsg = onSnapshot(qMsg, (snap) => {
      setUnreadMessages(snap.size);
    });

    return () => {
      unsubApp();
      unsubRec();
      unsubMsg();
    };
  }, [user]);

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto" dir="rtl">
      <div className="flex flex-col gap-3 relative overflow-hidden p-8 rounded-3xl bg-gradient-to-br from-primary/10 via-sky-50 to-white border border-primary/10 shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl animate-pulse" />
        <h1 className="text-3xl font-black text-slate-900 tracking-tight relative">لوحة تحكم المريض</h1>
        <p className="text-slate-600 font-medium relative flex items-center gap-2">
          <Activity size={16} className="text-primary" />
          مرحباً بك في بوابتك الصحية الشخصية المتكاملة.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Next Appointment Card */}
        <div className="stat-card group border-t-4 border-t-primary">
          <div className="flex justify-between items-center mb-4">
            <span className="stat-label">الموعد القادم</span>
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <Calendar size={18} strokeWidth={2.5} />
            </div>
          </div>
          {nextAppointment ? (
            <div className="space-y-4">
              <div className="stat-value text-xl">{nextAppointment.doctorName}</div>
              <div className="flex items-center text-sm text-slate-500 font-medium gap-2 bg-slate-50 p-2 rounded-lg">
                <Clock size={16} className="text-primary" />
                {formatArabicDate(nextAppointment.date)} - {nextAppointment.startTime}
              </div>
              <Button render={<Link to="/patient/appointments" />} size="sm" className="w-full h-11 rounded-xl font-bold shadow-md shadow-primary/20">
                إدارة المواعيد
              </Button>
            </div>
          ) : (
            <div className="py-6 text-center">
              <p className="text-sm font-bold text-slate-400 mb-4">لا توجد مواعيد قادمة</p>
              <Button render={<Link to="/patient/appointments" />} variant="outline" size="sm" className="w-full h-11 rounded-xl border-dashed border-2 hover:bg-primary/5 hover:border-primary transition-all">
                حجز موعد الآن
              </Button>
            </div>
          )}
        </div>

        {/* Messages Card */}
        <div className="stat-card group border-t-4 border-t-emerald-500">
          <div className="flex justify-between items-center mb-4">
            <span className="stat-label">الرسائل</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <MessageSquare size={18} strokeWidth={2.5} />
            </div>
          </div>
          <div className="stat-value">{unreadMessages} <span className="text-sm font-bold text-slate-400">رسائل جديدة</span></div>
          <p className="text-xs text-slate-500 font-medium mt-1">تواصل مع فريقك الطبي بأمان وسرية تامة.</p>
          <Button render={<Link to="/patient/messages" />} variant="outline" size="sm" className="w-full h-11 rounded-xl mt-4 font-bold active:scale-95 transition-all">
            فتح صندوق الوارد
          </Button>
        </div>

        {/* Quick Actions Card */}
        <div className="stat-card group border-t-4 border-t-amber-500">
          <div className="flex justify-between items-center mb-4">
            <span className="stat-label">إجراءات سريعة</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Activity size={18} strokeWidth={2.5} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 mt-2">
            <Button render={<Link to="/patient/records" />} variant="ghost" className="justify-start gap-4 h-12 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all font-bold">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <FileText size={16} />
              </div>
              <span>تقاريري الطبية</span>
            </Button>
            <Button render={<Link to="/patient/profile" />} variant="ghost" className="justify-start gap-4 h-12 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all font-bold">
              <div className="w-8 h-8 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center">
                <Users size={16} />
              </div>
              <span>تعديل الملف الشخصي</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Medical Records */}
        <Card>
          <CardHeader>
            <CardTitle>آخر السجلات الطبية</CardTitle>
            <CardDescription>ملخص لآخر زياراتك للعيادة.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentRecords.length > 0 ? (
                recentRecords.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-3 rounded-lg border bg-slate-50/50">
                    <div className="flex flex-col">
                      <span className="font-semibold">{record.diagnosis}</span>
                      <span className="text-xs text-muted-foreground">{formatArabicDate(record.date)}</span>
                    </div>
                    <Button render={<Link to="/patient/records" />} variant="ghost" size="icon">
                      <ArrowRight size={18} className="rotate-180" />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-center py-6 text-muted-foreground">لا توجد سجلات طبية متاحة.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Health Tips or Info */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-primary">نصيحة صحية اليوم</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">
              شرب كميات كافية من الماء (8 أكواب يومياً) يساعد في تحسين وظائف الكلى، الحفاظ على نضارة البشرة، وزيادة مستويات الطاقة والتركيز.
            </p>
            <div className="mt-6 p-4 bg-white rounded-lg border border-primary/10 flex items-start gap-3">
              <AlertCircle className="text-primary shrink-0" size={20} />
              <div className="text-xs">
                <p className="font-bold mb-1">تذكير:</p>
                <p className="text-muted-foreground">تأكد من تحديث معلومات التأمين الخاصة بك قبل موعدك القادم لتجنب أي تأخير.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
