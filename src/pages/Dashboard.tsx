/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where, Timestamp, getDocs, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, getNextMRN } from '@/src/lib/firebase';
import { useAuth } from '@/src/context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Users, 
  Calendar, 
  Activity, 
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  Search,
  UserPlus,
  Plus,
  ArrowLeft,
  FlaskConical,
  CreditCard
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area
} from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  if (profile?.role === 'patient') return null;

  const [counts, setCounts] = useState({
    patients: 0,
    appointments: 0,
    prescriptions: 0,
    radiology: 0
  });
  const [recentAppointments, setRecentAppointments] = useState<any[]>([]);
  const [chartView, setChartView] = useState<'patients' | 'revenue'>('patients');

  // Quick Search State
  const [quickSearch, setQuickSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [showQuickAction, setShowQuickAction] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [newPatientData, setNewPatientData] = useState({
    name: '',
    age: '',
    phone: '',
    gender: 'male' as 'male' | 'female'
  });

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (quickSearch.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      try {
        const q = query(
          collection(db, 'patients'),
          where('name', '>=', quickSearch),
          where('name', '<=', quickSearch + '\uf8ff'),
          limit(5)
        );
        const snap = await getDocs(q);
        const results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (results.length < 5) {
          const qPhone = query(
            collection(db, 'patients'),
            where('phone', '>=', quickSearch),
            where('phone', '<=', quickSearch + '\uf8ff'),
            limit(5 - results.length)
          );
          const snapPhone = await getDocs(qPhone);
          snapPhone.docs.forEach(doc => {
            if (!results.find(r => r.id === doc.id)) {
              results.push({ id: doc.id, ...doc.data() });
            }
          });
        }

        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch (error) {
        console.error("Search suggestions error:", error);
      }
    };

    const timer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timer);
  }, [quickSearch]);

  const handleSelectPatient = (patient: any) => {
    setSearchResult(patient);
    setIsRegistering(false);
    setShowQuickAction(true);
    setShowSuggestions(false);
    setQuickSearch('');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSuggestions && !(event.target as HTMLElement).closest('.relative.w-full.md\\:w-auto')) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSuggestions]);

  useEffect(() => {
    if (!profile || profile.role === 'patient') return;

    // Real-time counts
    const unsubPatients = onSnapshot(collection(db, 'patients'), (snap) => {
      setCounts(prev => ({ ...prev, patients: snap.size }));
    }, (err) => console.error("Patients count error:", err));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const unsubApp = onSnapshot(
      query(collection(db, 'appointments'), where('date', '>=', Timestamp.fromDate(today))),
      (snap) => {
        setCounts(prev => ({ ...prev, appointments: snap.size }));
        setRecentAppointments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).slice(0, 5));
      },
      (err) => console.error("Appointments count error:", err)
    );

    const unsubPres = onSnapshot(collection(db, 'prescriptions'), (snap) => {
      setCounts(prev => ({ ...prev, prescriptions: snap.size }));
    }, (err) => console.error("Prescriptions count error:", err));

    const unsubRad = onSnapshot(collection(db, 'radiology_requests'), (snap) => {
      setCounts(prev => ({ ...prev, radiology: snap.size }));
    }, (err) => console.error("Radiology count error:", err));

    return () => {
      unsubPatients();
      unsubApp();
      unsubPres();
      unsubRad();
    };
  }, [profile]);

  const handleQuickSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSearch.trim()) return;

    setIsSearching(true);
    try {
      // Search by Phone or Name
      let q = query(collection(db, 'patients'), where('phone', '==', quickSearch), limit(1));
      let snap = await getDocs(q);

      if (snap.empty) {
        // Try search by name (exact match for simplicity in quick search)
        q = query(collection(db, 'patients'), where('name', '==', quickSearch), limit(1));
        snap = await getDocs(q);
      }

      if (!snap.empty) {
        const patient = { id: snap.docs[0].id, ...snap.docs[0].data() };
        setSearchResult(patient);
        setIsRegistering(false);
      } else {
        setSearchResult(null);
        setIsRegistering(true);
        // Pre-fill based on input type
        const isNumeric = /^\d+$/.test(quickSearch);
        setNewPatientData({
          name: isNumeric ? '' : quickSearch,
          age: '',
          phone: isNumeric ? quickSearch : '',
          gender: 'male'
        });
      }
      setShowQuickAction(true);
    } catch (error) {
      toast.error('خطأ في البحث');
    } finally {
      setIsSearching(false);
    }
  };

  const handleRegisterPatient = async () => {
    if (!newPatientData.name || !newPatientData.phone) {
      toast.error('يرجى إكمال البيانات الأساسية (الاسم ورقم الجوال)');
      return;
    }

    setIsSubmitting(true);
    try {
      const mrn = await getNextMRN();
      const docRef = await addDoc(collection(db, 'patients'), {
        ...newPatientData,
        mrn,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      const patient = { id: docRef.id, ...newPatientData, mrn };
      setSearchResult(patient);
      setIsRegistering(false);
      toast.success(`تم تسجيل المريض بنجاح بالرقم الطبي: ${mrn}`);
    } catch (error) {
      toast.error('فشل تسجيل المريض');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAppointment = async () => {
    if (!searchResult) return;
    try {
      await addDoc(collection(db, 'appointments'), {
        patientId: searchResult.id,
        patientName: searchResult.name,
        doctorId: profile?.uid || '',
        doctorName: profile?.displayName || '',
        date: Timestamp.now(),
        startTime: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        status: 'scheduled',
        type: 'consultation',
        createdAt: serverTimestamp()
      });
      toast.success('تم حجز موعد سريع');
      setShowQuickAction(false);
    } catch (error) {
      toast.error('فشل حجز الموعد');
    }
  };

  const chartData = [
    { name: '8 AM', patients: 12, revenue: 1200 },
    { name: '10 AM', patients: 25, revenue: 2800 },
    { name: '12 PM', patients: 18, revenue: 1900 },
    { name: '2 PM', patients: 30, revenue: 3500 },
    { name: '4 PM', patients: 22, revenue: 2400 },
    { name: '6 PM', patients: 15, revenue: 1600 },
    { name: '8 PM', patients: 8, revenue: 900 },
  ];

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {/* Quick Search Header */}
      <div className="bg-white p-6 rounded-xl border border-border shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-lg text-primary">
            <Search size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold">البحث السريع والعمليات</h2>
            <p className="text-sm text-muted-foreground">ابحث برقم الهاتف أو الاسم لإجراء عملية سريعة</p>
          </div>
        </div>
        <div className="relative w-full md:w-auto">
          <form onSubmit={handleQuickSearch} className="flex w-full md:w-auto gap-2">
            <Input 
              placeholder="رقم الهاتف أو اسم المريض..." 
              className="w-full md:w-80"
              value={quickSearch}
              onChange={e => setQuickSearch(e.target.value)}
              onFocus={() => quickSearch.length >= 2 && setShowSuggestions(true)}
            />
            <Button type="submit" disabled={isSearching}>
              {isSearching ? 'جاري البحث...' : 'بحث'}
            </Button>
          </form>

          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 w-full bg-white mt-1 rounded-lg border border-border shadow-lg overflow-hidden">
              {suggestions.map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => handleSelectPatient(patient)}
                  className="w-full text-right px-4 py-3 hover:bg-slate-50 flex flex-col border-b border-slate-50 last:border-0 transition-colors"
                >
                  <span className="font-bold text-sm">{patient.name}</span>
                  <span className="text-xs text-muted-foreground">الهاتف: {patient.phone} | الرقم الطبي: {patient.mrn}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <div className="stat-card cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => navigate('/patients')}>
          <span className="stat-label">إجمالي المرضى</span>
          <span className="stat-value">{counts.patients}</span>
          <span className="text-success text-[0.75rem] font-medium flex items-center gap-1">
            <TrendingUp size={12} /> ↑ نشط
          </span>
        </div>
        <div className="stat-card cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => navigate('/appointments')}>
          <span className="stat-label">مواعيد اليوم</span>
          <span className="stat-value">{counts.appointments}</span>
          <span className="text-warning text-[0.75rem] font-medium">مجدول</span>
        </div>
        <div className="stat-card cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => navigate('/pharmacy')}>
          <span className="stat-label">الوصفات الطبية</span>
          <span className="stat-value">{counts.prescriptions}</span>
          <span className="text-primary text-[0.75rem] font-medium">نظام الصيدلية</span>
        </div>
        <div className="stat-card cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => navigate('/radiology')}>
          <span className="stat-label">طلبات الأشعة</span>
          <span className="stat-value">{counts.radiology}</span>
          <span className="text-danger text-[0.75rem] font-medium">تتطلب مراجعة</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 flex-1">
        <div className="panel lg:col-span-2 flex flex-col">
          <div className="panel-header flex justify-between items-center">
            <span>إحصائيات المراجعات اليومية</span>
            <div className="flex bg-slate-100 p-1 rounded-lg gap-1">
              <button 
                onClick={() => setChartView('patients')}
                className={`px-3 py-1 rounded-md text-[0.7rem] font-bold transition-all ${chartView === 'patients' ? 'bg-white shadow-sm text-primary' : 'text-secondary'}`}
              >
                المرضى
              </button>
              <button 
                onClick={() => setChartView('revenue')}
                className={`px-3 py-1 rounded-md text-[0.7rem] font-bold transition-all ${chartView === 'revenue' ? 'bg-white shadow-sm text-primary' : 'text-secondary'}`}
              >
                الإيرادات
              </button>
            </div>
          </div>
          <div className="flex-1 p-4 min-h-[300px]">
             <ResponsiveContainer width="99%" height="100%" minHeight={300}>
              {chartView === 'patients' ? (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    cursor={{ fill: '#f8fafc' }}
                  />
                  <Bar dataKey="patients" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={30} name="عدد المرضى" />
                </BarChart>
              ) : (
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRev)" name="الإيرادات (ر.ي)" />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="panel">
          <div className="panel-header">
            <span>قائمة المواعيد الحالية</span>
            <Link to="/appointments" className="text-[0.8rem] text-primary hover:underline font-medium flex items-center gap-1">
              عرض الكل <ChevronLeft size={14} />
            </Link>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="border-b border-border bg-slate-50/30">
                  <th className="px-5 py-3 text-[0.8rem] text-secondary font-semibold">المريض</th>
                  <th className="px-5 py-3 text-[0.8rem] text-secondary font-semibold">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {recentAppointments.length > 0 ? recentAppointments.map((row, i) => (
                  <tr key={i} className="border-b border-border hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 text-[0.85rem] font-medium">{row.patientName}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-1 rounded text-[0.7rem] font-bold ${
                        row.status === 'scheduled' ? 'bg-blue-50 text-blue-600' :
                        row.status === 'completed' ? 'bg-success/10 text-success' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {row.status === 'scheduled' ? 'مجدول' : row.status === 'completed' ? 'مكتمل' : row.status}
                      </span>
                    </td>
                  </tr>
                )) : (
                  [
                    { name: 'سارة محمد إبراهيم', status: 'في الفحص', statusColor: 'bg-success/10 text-success' },
                    { name: 'عبدالرحمن عبدالله', status: 'انتظار', statusColor: 'bg-slate-100 text-slate-600' },
                    { name: 'ليلى يوسف', status: 'سحب عينة', statusColor: 'bg-warning/10 text-warning' },
                    { name: 'محمد حسن علي', status: 'مكتمل', statusColor: 'bg-success/10 text-success' },
                    { name: 'نورة السبيعي', status: 'انتظار', statusColor: 'bg-slate-100 text-slate-600' },
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-border hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4 text-[0.85rem] font-medium">{row.name}</td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-1 rounded text-[0.7rem] font-bold ${row.statusColor}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="panel lg:col-span-2">
          <div className="panel-header">
            <span>الوصول السريع للأقسام</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-5">
            {[
              { icon: '🦷', label: 'مخطط الأسنان', path: '/clinic', color: 'hover:border-primary hover:bg-sky-50' },
              { icon: '🧪', label: 'نتائج المخبر', path: '/lab', color: 'hover:border-primary hover:bg-sky-50' },
              { icon: '💊', label: 'المخزون الدوائي', path: '/pharmacy', color: 'hover:border-primary hover:bg-sky-50' },
              { icon: '📁', label: 'السجل الطبي', path: '/patients', color: 'hover:border-primary hover:bg-sky-50' },
              { icon: '🖼️', label: 'نظام PACS', path: '/radiology', color: 'hover:border-primary hover:bg-sky-50' },
              { icon: '💳', label: 'الفواتير', path: '/billing', color: 'hover:border-primary hover:bg-sky-50' },
            ].map((module, i) => (
              <button 
                key={i} 
                onClick={() => navigate(module.path)}
                className={`p-4 rounded-lg border border-border flex flex-col items-center gap-2 transition-all bg-slate-50/30 ${module.color}`}
              >
                <span className="text-xl">{module.icon}</span>
                <span className="text-[0.85rem] font-semibold">{module.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span>حالة النظام الهجين</span>
          </div>
          <div className="p-5 flex flex-col h-full">
            <div className="flex-1 space-y-4">
              <div>
                <div className="flex justify-between text-[0.8rem] mb-1">
                  <span>تزامن السحابة</span>
                  <span className="text-success font-bold">95%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="w-[95%] h-full bg-success"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[0.8rem] mb-1">
                  <span>المساحة المستخدمة</span>
                  <span className="text-primary font-bold">42%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="w-[42%] h-full bg-primary"></div>
                </div>
              </div>
            </div>
            <div className="pt-4 border-t border-border mt-4">
              <p className="text-[0.7rem] text-secondary">آخر تزامن: قبل دقيقة واحدة</p>
              <p className="text-[0.7rem] text-secondary">إصدار النظام: v2.4.0-hybrid</p>
              <button 
                onClick={() => toast.success('جاري بدء مزامنة يدوية...')}
                className="mt-3 w-full py-2 bg-slate-100 hover:bg-slate-200 rounded-md text-[0.75rem] font-bold transition-colors"
              >
                مزامنة الآن
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Dialog */}
      <Dialog open={showQuickAction} onOpenChange={setShowQuickAction}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isRegistering ? <UserPlus className="text-primary" /> : <Activity className="text-primary" />}
              {isRegistering ? 'تسجيل مريض جديد' : 'إجراء سريع للمريض'}
            </DialogTitle>
            <DialogDescription>
              {isRegistering 
                ? 'لم يتم العثور على المريض، يرجى إكمال البيانات لتسجيله تلقائياً.' 
                : `تم العثور على المريض: ${searchResult?.name} (الرقم الطبي: ${searchResult?.mrn}). اختر الإجراء المطلوب.`}
            </DialogDescription>
          </DialogHeader>

          {isRegistering ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>اسم المريض</Label>
                <Input 
                  value={newPatientData.name} 
                  onChange={e => setNewPatientData({...newPatientData, name: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <Label>العمر</Label>
                <Input 
                  type="number"
                  placeholder="سنوات"
                  value={newPatientData.age} 
                  onChange={e => setNewPatientData({...newPatientData, age: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <Label>رقم الجوال</Label>
                <Input 
                  value={newPatientData.phone} 
                  onChange={e => setNewPatientData({...newPatientData, phone: e.target.value})} 
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 py-6">
              <Button variant="outline" className="flex flex-col h-24 gap-2" onClick={handleQuickAppointment}>
                <Calendar size={24} className="text-primary" />
                <span>موعد جديد</span>
              </Button>
              <Button variant="outline" className="flex flex-col h-24 gap-2" onClick={() => { navigate(`/clinic?patientId=${searchResult.id}`); setShowQuickAction(false); }}>
                <Activity size={24} className="text-success" />
                <span>معاينة طبية</span>
              </Button>
              <Button variant="outline" className="flex flex-col h-24 gap-2" onClick={() => { navigate(`/lab?patientId=${searchResult.id}`); setShowQuickAction(false); }}>
                <FlaskConical size={24} className="text-warning" />
                <span>طلب مختبر</span>
              </Button>
              <Button variant="outline" className="flex flex-col h-24 gap-2" onClick={() => { navigate(`/billing?patientId=${searchResult.id}`); setShowQuickAction(false); }}>
                <CreditCard size={24} className="text-danger" />
                <span>فاتورة جديدة</span>
              </Button>
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-start">
            <Button variant="secondary" onClick={() => setShowQuickAction(false)} disabled={isSubmitting}>إلغاء</Button>
            {isRegistering && (
              <Button onClick={handleRegisterPatient} disabled={isSubmitting}>
                {isSubmitting ? 'جاري التسجيل...' : 'تسجيل ومتابعة'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
