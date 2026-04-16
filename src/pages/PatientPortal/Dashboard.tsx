/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
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
    <div className="flex flex-col gap-6" dir="rtl">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">لوحة تحكم المريض</h1>
        <p className="text-muted-foreground">مرحباً بك في بوابتك الصحية الشخصية.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Next Appointment Card */}
        <Card className="border-t-4 border-t-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">الموعد القادم</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {nextAppointment ? (
              <div className="space-y-3">
                <div className="text-2xl font-bold">{nextAppointment.doctorName}</div>
                <div className="flex items-center text-sm text-muted-foreground gap-2">
                  <Clock size={14} />
                  {nextAppointment.date?.toDate().toLocaleDateString('ar-SA')} - {nextAppointment.startTime}
                </div>
                <Button render={<Link to="/patient/appointments" />} variant="outline" size="sm" className="w-full mt-2">
                  عرض التفاصيل
                </Button>
              </div>
            ) : (
              <div className="py-4 text-center text-muted-foreground">
                <p className="text-sm">لا توجد مواعيد قادمة</p>
                <Button render={<Link to="/patient/appointments" />} variant="link" size="sm">
                  حجز موعد جديد
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Messages Card */}
        <Card className="border-t-4 border-t-success">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">الرسائل</CardTitle>
            <MessageSquare className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unreadMessages} رسائل جديدة</div>
            <p className="text-xs text-muted-foreground mt-1">تواصل مع فريقك الطبي بأمان.</p>
            <Button render={<Link to="/patient/messages" />} variant="outline" size="sm" className="w-full mt-4">
              فتح البريد الوارد
            </Button>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-t-4 border-t-warning">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجراءات سريعة</CardTitle>
            <Activity className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Button render={<Link to="/patient/records" />} variant="ghost" size="sm" className="justify-start gap-2 h-auto py-2">
              <FileText size={14} />
              <span>تقاريري</span>
            </Button>
            <Button render={<Link to="/patient/profile" />} variant="ghost" size="sm" className="justify-start gap-2 h-auto py-2">
              <Users size={14} />
              <span>الملف الشخصي</span>
            </Button>
          </CardContent>
        </Card>
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
                      <span className="text-xs text-muted-foreground">{record.date?.toDate().toLocaleDateString('ar-SA')}</span>
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
