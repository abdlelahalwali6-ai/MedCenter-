/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Phone, Mail, MapPin, ShieldCheck, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PatientProfile() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patientData, setPatientData] = useState<any>({
    name: '',
    phone: '',
    email: '',
    address: '',
    gender: 'male',
    dateOfBirth: '',
    bloodType: '',
    insuranceProvider: '',
    insuranceNumber: ''
  });

  useEffect(() => {
    if (!user) return;

    const fetchPatientData = async () => {
      try {
        const docRef = doc(db, 'patients', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setPatientData({ ...patientData, ...docSnap.data() });
        } else {
          // Initialize with profile data
          setPatientData({
            ...patientData,
            name: profile?.displayName || '',
            email: profile?.email || '',
            uid: user.uid
          });
        }
      } catch (error) {
        console.error('Error fetching patient data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPatientData();
  }, [user, profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const docRef = doc(db, 'patients', user.uid);
      const docSnap = await getDoc(docRef);
      
      const dataToSave = {
        ...patientData,
        uid: user.uid,
        updatedAt: serverTimestamp()
      };

      if (docSnap.exists()) {
        await updateDoc(docRef, dataToSave);
      } else {
        await setDoc(docRef, {
          ...dataToSave,
          createdAt: serverTimestamp()
        });
      }
      
      toast.success('تم تحديث الملف الشخصي بنجاح');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('فشل تحديث الملف الشخصي');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-12 text-center">جاري تحميل البيانات...</div>;

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">الملف الشخصي</h1>
        <p className="text-muted-foreground">إدارة معلوماتك الشخصية وتفاصيل التأمين الطبي.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Basic Info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="text-primary" size={20} />
              المعلومات الشخصية
            </CardTitle>
            <CardDescription>تأكد من صحة بياناتك الشخصية للتواصل الفعال.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الاسم الكامل</Label>
                <Input 
                  value={patientData.name} 
                  onChange={e => setPatientData({...patientData, name: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <Label>رقم الجوال</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input 
                    className="pl-10"
                    value={patientData.phone} 
                    onChange={e => setPatientData({...patientData, phone: e.target.value})} 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input 
                    className="pl-10"
                    value={patientData.email} 
                    disabled 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>تاريخ الميلاد</Label>
                <Input 
                  type="date"
                  value={patientData.dateOfBirth} 
                  onChange={e => setPatientData({...patientData, dateOfBirth: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <Label>الجنس</Label>
                <Select value={patientData.gender} onValueChange={v => setPatientData({...patientData, gender: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الجنس" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">ذكر</SelectItem>
                    <SelectItem value="female">أنثى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>العنوان</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 text-muted-foreground" size={16} />
                <Input 
                  className="pl-10"
                  value={patientData.address} 
                  onChange={e => setPatientData({...patientData, address: e.target.value})} 
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Insurance Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="text-success" size={20} />
                التأمين الطبي
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>شركة التأمين</Label>
                <Input 
                  value={patientData.insuranceProvider} 
                  onChange={e => setPatientData({...patientData, insuranceProvider: e.target.value})} 
                  placeholder="مثال: بوبا، التعاونية..."
                />
              </div>
              <div className="space-y-2">
                <Label>رقم بطاقة التأمين</Label>
                <Input 
                  value={patientData.insuranceNumber} 
                  onChange={e => setPatientData({...patientData, insuranceNumber: e.target.value})} 
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>فصيلة الدم</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={patientData.bloodType} onValueChange={v => setPatientData({...patientData, bloodType: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر فصيلة الدم" />
                </SelectTrigger>
                <SelectContent>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Button onClick={handleSave} disabled={saving} className="w-full h-12 gap-2 shadow-lg">
            {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            حفظ التغييرات
          </Button>
        </div>
      </div>
    </div>
  );
}
