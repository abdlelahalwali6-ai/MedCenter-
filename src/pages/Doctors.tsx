import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { UserProfile } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Stethoscope, Clock, DollarSign, RotateCcw, Save, Search, Calendar as CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/src/context/AuthContext';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from '@/components/ui/dialog';

const DAYS = [
  { id: 'Saturday', label: 'السبت' },
  { id: 'Sunday', label: 'الأحد' },
  { id: 'Monday', label: 'الاثنين' },
  { id: 'Tuesday', label: 'الثلاثاء' },
  { id: 'Wednesday', label: 'الأربعاء' },
  { id: 'Thursday', label: 'الخميس' },
  { id: 'Friday', label: 'الجمعة' },
];

export default function Doctors() {
  const { profile: currentUserProfile, isAdmin } = useAuth();

  if (currentUserProfile?.role !== 'admin') return null;

  const doctors = useLiveQuery(() => localDB.profiles.filter(p => p.role === 'doctor').toArray(), []) || [];
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<UserProfile | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  const [editData, setEditData] = useState({
    consultationFee: 0,
    freeFollowUps: 0,
    availableDays: [] as string[],
    workingHours: {
      start: '08:00',
      end: '16:00'
    }
  });

  // Fetching moved to useLiveQuery above
  
  const handleEditClick = (doctor: UserProfile) => {
    setSelectedDoctor(doctor);
    setEditData({
      consultationFee: doctor.consultationFee || 0,
      freeFollowUps: doctor.freeFollowUps || 0,
      availableDays: doctor.availableDays || [],
      workingHours: doctor.workingHours || { start: '08:00', end: '16:00' }
    });
    setIsEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedDoctor) return;

    try {
      await DataService.update('profiles', selectedDoctor.uid, {
        ...editData,
      });
      toast.success('تم تحديث بيانات الطبيب بنجاح');
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error('Error updating doctor:', error);
      toast.error('فشل تحديث البيانات');
    }
  };

  const toggleDay = (dayId: string) => {
    setEditData(prev => ({
      ...prev,
      availableDays: prev.availableDays.includes(dayId)
        ? prev.availableDays.filter(d => d !== dayId)
        : [...prev.availableDays, dayId]
    }));
  };

  const filteredDoctors = doctors.filter(d => 
    d.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.specialization?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Stethoscope className="text-primary" />
          إدارة شؤون الأطباء والعيادات
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="bg-primary/10 p-3 rounded-xl text-primary">
              <Stethoscope size={24} />
            </div>
            <div>
              <p className="text-xs text-secondary">إجمالي الأطباء</p>
              <p className="text-xl font-bold text-primary">{doctors.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            placeholder="البحث عن طبيب بالاسم أو التخصص..." 
            className="pr-10"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="panel overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الطبيب</TableHead>
              <TableHead>التخصص</TableHead>
              <TableHead>التسعيرة</TableHead>
              <TableHead>العودة المجانية</TableHead>
              <TableHead>أيام العمل</TableHead>
              <TableHead className="text-left">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDoctors.map((doc) => (
              <TableRow key={doc.uid}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-primary">
                      {doc.displayName?.substring(0, 2)}
                    </div>
                    <div>
                      <p className="font-bold">{doc.displayName}</p>
                      <p className="text-[0.7rem] text-secondary">{doc.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs">
                    {doc.specialization || 'عام'}
                  </span>
                </TableCell>
                <TableCell className="font-bold text-primary">
                  {doc.consultationFee || 0} ر.ي
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-xs">
                    <RotateCcw size={12} className="text-secondary" />
                    {doc.freeFollowUps || 0} زيارات
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {doc.availableDays?.map(day => (
                      <span key={day} className="text-[0.65rem] bg-primary/5 text-primary px-1.5 py-0.5 rounded border border-primary/10">
                        {DAYS.find(d => d.id === day)?.label}
                      </span>
                    )) || <span className="text-xs text-muted-foreground">غير محدد</span>}
                  </div>
                </TableCell>
                <TableCell className="text-left">
                  <Button variant="outline" size="sm" onClick={() => handleEditClick(doc)} className="gap-1 h-8">
                    <Save size={14} /> ضبط الإعدادات
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="text-primary" />
              إعدادات الطبيب: {selectedDoctor?.displayName}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <DollarSign size={16} className="text-primary" />
                  رسوم الكشفية (ر.ي)
                </Label>
                <Input 
                  type="number" 
                  value={editData.consultationFee} 
                  onChange={e => setEditData({...editData, consultationFee: Number(e.target.value)})}
                />
              </div>
              
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <RotateCcw size={16} className="text-primary" />
                  عدد مرات العودة المجانية
                </Label>
                <Input 
                  type="number" 
                  value={editData.freeFollowUps} 
                  onChange={e => setEditData({...editData, freeFollowUps: Number(e.target.value)})}
                />
                <p className="text-[0.65rem] text-muted-foreground">عدد الزيارات المسموح بها مجاناً بعد الكشفية الأولى.</p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock size={16} className="text-primary" />
                  ساعات العمل
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[0.65rem]">من</Label>
                    <Input 
                      type="time" 
                      value={editData.workingHours.start} 
                      onChange={e => setEditData({...editData, workingHours: {...editData.workingHours, start: e.target.value}})}
                    />
                  </div>
                  <div>
                    <Label className="text-[0.65rem]">إلى</Label>
                    <Input 
                      type="time" 
                      value={editData.workingHours.end} 
                      onChange={e => setEditData({...editData, workingHours: {...editData.workingHours, end: e.target.value}})}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="flex items-center gap-2">
                <CalendarIcon size={16} className="text-primary" />
                أيام العمل المتاحة
              </Label>
              <div className="grid grid-cols-2 gap-2 border p-3 rounded-lg bg-slate-50">
                {DAYS.map(day => (
                  <label key={day.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer transition-colors">
                    <input 
                      type="checkbox"
                      checked={editData.availableDays.includes(day.id)}
                      onChange={() => toggleDay(day.id)}
                      className="rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm">{day.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} className="gap-2">
              <Save size={18} /> حفظ الإعدادات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
