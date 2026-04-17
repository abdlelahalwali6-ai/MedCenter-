/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { formatArabicDate } from '@/src/lib/dateUtils';
import { useAuth } from '@/src/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { FileText, FlaskConical, Image as ImageIcon, Pill, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PatientRecords() {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [labs, setLabs] = useState<any[]>([]);
  const [radiology, setRadiology] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const qRec = query(collection(db, 'medical_records'), where('patientId', '==', user.uid), orderBy('date', 'desc'));
    const qLab = query(collection(db, 'lab_requests'), where('patientId', '==', user.uid), orderBy('createdAt', 'desc'));
    const qRad = query(collection(db, 'radiology_requests'), where('patientId', '==', user.uid), orderBy('createdAt', 'desc'));
    const qPre = query(collection(db, 'prescriptions'), where('patientId', '==', user.uid), orderBy('createdAt', 'desc'));

    const unsubRec = onSnapshot(qRec, (snap) => setRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubLab = onSnapshot(qLab, (snap) => setLabs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubRad = onSnapshot(qRad, (snap) => setRadiology(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubPre = onSnapshot(qPre, (snap) => setPrescriptions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));

    setLoading(false);

    return () => {
      unsubRec();
      unsubLab();
      unsubRad();
      unsubPre();
    };
  }, [user]);

  if (loading) return <div className="p-12 text-center">جاري تحميل السجلات...</div>;

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">سجلاتي الطبية</h1>
        <p className="text-muted-foreground">الوصول إلى نتائج الفحوصات، التقارير الطبية، والوصفات.</p>
      </div>

      <Tabs defaultValue="emr" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-12">
          <TabsTrigger value="emr" className="gap-2"><FileText size={16} /> الزيارات</TabsTrigger>
          <TabsTrigger value="labs" className="gap-2"><FlaskConical size={16} /> المختبر</TabsTrigger>
          <TabsTrigger value="radiology" className="gap-2"><ImageIcon size={16} /> الأشعة</TabsTrigger>
          <TabsTrigger value="prescriptions" className="gap-2"><Pill size={16} /> الوصفات</TabsTrigger>
        </TabsList>

        <TabsContent value="emr" className="mt-6 space-y-4">
          {records.length > 0 ? records.map(record => (
            <Card key={record.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{record.diagnosis}</CardTitle>
                    <CardDescription>{formatArabicDate(record.date)}</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Download size={14} /> تحميل التقرير
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="font-bold mb-1">الشكوى:</p>
                    <p className="text-muted-foreground">{record.complaint}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="font-bold mb-1">خطة العلاج:</p>
                    <p className="text-muted-foreground">{record.treatmentPlan}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )) : <div className="text-center py-12 text-muted-foreground">لا توجد سجلات زيارات.</div>}
        </TabsContent>

        <TabsContent value="labs" className="mt-6 space-y-4">
          {labs.length > 0 ? labs.map(lab => (
            <Card key={lab.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">طلب مختبر #{lab.id.substring(0, 6)}</CardTitle>
                    <CardDescription>{formatArabicDate(lab.createdAt)}</CardDescription>
                  </div>
                  <Badge variant={lab.status === 'completed' ? 'success' : 'outline'}>
                    {lab.status === 'completed' ? 'مكتمل' : 'قيد الانتظار'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {lab.tests?.map((test: any, i: number) => (
                    <div key={i} className="flex justify-between p-2 border-b last:border-0 text-sm">
                      <span>{test.name}</span>
                      <span className="font-bold text-primary">{test.result || 'قيد الفحص'}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )) : <div className="text-center py-12 text-muted-foreground">لا توجد نتائج مختبر.</div>}
        </TabsContent>

        <TabsContent value="radiology" className="mt-6 space-y-4">
          {radiology.length > 0 ? radiology.map(rad => (
            <Card key={rad.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{rad.type}</CardTitle>
                    <CardDescription>{formatArabicDate(rad.createdAt)}</CardDescription>
                  </div>
                  <Badge variant={rad.status === 'completed' ? 'success' : 'outline'}>
                    {rad.status === 'completed' ? 'مكتمل' : 'قيد الانتظار'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{rad.report || 'التقرير قيد الإعداد...'}</p>
                {rad.status === 'completed' && (
                  <Button variant="outline" size="sm" className="gap-2">
                    <ExternalLink size={14} /> عرض الصور الطبية
                  </Button>
                )}
              </CardContent>
            </Card>
          )) : <div className="text-center py-12 text-muted-foreground">لا توجد تقارير أشعة.</div>}
        </TabsContent>

        <TabsContent value="prescriptions" className="mt-6 space-y-4">
          {prescriptions.length > 0 ? prescriptions.map(pre => (
            <Card key={pre.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">وصفة طبية</CardTitle>
                    <CardDescription>{formatArabicDate(pre.createdAt)}</CardDescription>
                  </div>
                  <Badge variant={pre.status === 'dispensed' ? 'success' : 'outline'}>
                    {pre.status === 'dispensed' ? 'تم الصرف' : 'بانتظار الصرف'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pre.medications?.map((med: any, i: number) => (
                    <div key={i} className="p-3 bg-slate-50 rounded-lg flex justify-between items-center">
                      <div>
                        <p className="font-bold">{med.name}</p>
                        <p className="text-xs text-muted-foreground">{med.dosage} - {med.frequency}</p>
                      </div>
                      <span className="text-xs font-medium">{med.duration}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )) : <div className="text-center py-12 text-muted-foreground">لا توجد وصفات طبية.</div>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
