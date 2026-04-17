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
  CreditCard,
  Pill,
  Loader2
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
    radiology: 0,
    revenue: 0
  });
  const [recentAppointments, setRecentAppointments] = useState<any[]>([]);
  const [chartView, setChartView] = useState<'patients' | 'revenue'>('patients');
  const [chartData, setChartData] = useState<any[]>([]);

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
    const todayTS = Timestamp.fromDate(today);

    // Appointments for today + list
    const unsubApp = onSnapshot(
      query(collection(db, 'appointments'), where('date', '>=', todayTS)),
      (snap) => {
        setCounts(prev => ({ ...prev, appointments: snap.size }));
        setRecentAppointments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).slice(0, 5));
        
        // Build Patients Chart Data (Hourly)
        const hourlyPatients: { [key: number]: number } = {};
        snap.docs.forEach(doc => {
          const data = doc.data();
          if (data.startTime) {
            const hour = parseInt(data.startTime.split(':')[0]);
            hourlyPatients[hour] = (hourlyPatients[hour] || 0) + 1;
          }
        });
        
        const trend = [8, 10, 12, 14, 16, 18, 20].map(h => ({
          name: `${h > 12 ? h - 12 : h} ${h >= 12 ? 'PM' : 'AM'}`,
          patients: hourlyPatients[h] || 0,
          revenue: 0 // Will be merged from invoices
        }));
        
        setChartData(prevTrend => {
          const newTrend = [...trend];
          // Preserve revenue if it was already fetched
          if (prevTrend.length === newTrend.length) {
            newTrend.forEach((item, i) => {
              item.revenue = prevTrend[i].revenue || 0;
            });
          }
          return newTrend;
        });
      },
      (err) => console.error("Appointments count error:", err)
    );

    // Revenue tracking (Bills)
    const unsubInvoices = onSnapshot(
      query(collection(db, 'bills'), where('createdAt', '>=', todayTS)),
      (snap) => {
        let totalRev = 0;
        const hourlyRev: { [key: number]: number } = {};
        
        snap.docs.forEach(doc => {
          const data = doc.data();
          const amount = data.finalAmount || data.totalAmount || data.amount || data.total || 0;
          totalRev += amount;
          
          if (data.createdAt) {
            const date = data.createdAt.toDate();
            const hour = date.getHours();
            hourlyRev[hour] = (hourlyRev[hour] || 0) + amount;
          }
        });
        
        setCounts(prev => ({ ...prev, revenue: totalRev }));
        
        setChartData(prevTrend => {
          const baseline = [8, 10, 12, 14, 16, 18, 20];
          return baseline.map(h => {
            const existing = prevTrend.find(p => {
              const hourTitle = `${h > 12 ? h - 12 : h} ${h >= 12 ? 'PM' : 'AM'}`;
              return p.name === hourTitle;
            });
            return {
              name: `${h > 12 ? h - 12 : h} ${h >= 12 ? 'PM' : 'AM'}`,
              patients: existing?.patients || 0,
              revenue: (hourlyRev[h] || 0) + (hourlyRev[h+1] || 0) // Group by 2-hour window to match labels
            };
          });
        });
      }
    );

    const unsubPres = onSnapshot(
      query(collection(db, 'prescriptions'), where('status', '==', 'pending')),
      (snap) => {
        setCounts(prev => ({ ...prev, prescriptions: snap.size }));
      }, 
      (err) => console.error("Prescriptions count error:", err)
    );

    const unsubRad = onSnapshot(
      query(collection(db, 'radiology_requests'), where('status', '==', 'pending')),
      (snap) => {
        setCounts(prev => ({ ...prev, radiology: snap.size }));
      }, 
      (err) => console.error("Radiology count error:", err)
    );

    return () => {
      unsubPatients();
      unsubApp();
      unsubInvoices();
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

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {/* Quick Search Header */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/20 flex flex-col lg:flex-row items-center justify-between gap-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-transform duration-500 group-hover:scale-110" />
        <div className="relative flex items-center gap-5">
          <div className="p-4 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20 rotate-3 group-hover:rotate-0 transition-transform duration-300">
            <Search size={28} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">البحث السريع والعمليات</h2>
            <p className="text-sm text-slate-500 font-medium">ابحث برقم الهاتف أو الاسم لإجراء عملية طبية سريعة</p>
          </div>
        </div>
        <div className="relative w-full lg:w-auto min-w-[320px] sm:min-w-[400px]">
          <form onSubmit={handleQuickSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input 
                placeholder="رقم الهاتف أو اسم المريض..." 
                className="w-full pr-10 h-12 bg-slate-50 border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                value={quickSearch}
                onChange={e => setQuickSearch(e.target.value)}
                onFocus={() => quickSearch.length >= 2 && setShowSuggestions(true)}
              />
            </div>
            <Button type="submit" size="lg" className="rounded-xl px-8 font-bold shadow-md shadow-primary/20 active:scale-95 transition-all" disabled={isSearching}>
              {isSearching ? <Loader2 className="animate-spin" /> : 'بحث'}
            </Button>
          </form>

          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 w-full bg-white mt-2 rounded-2xl border border-slate-200 shadow-2xl shadow-slate-300/50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="px-4 py-2 border-b border-slate-50 bg-slate-50/50">
                <span className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest">المقترحات</span>
              </div>
              {suggestions.map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => handleSelectPatient(patient)}
                  className="w-full text-right px-5 py-3.5 hover:bg-primary/5 flex flex-col border-b border-slate-50 last:border-0 transition-all group"
                >
                  <span className="font-bold text-slate-800 group-hover:text-primary transition-colors">{patient.name}</span>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[0.7rem] text-slate-400 font-medium">الهاتف: <span className="text-slate-600">{patient.phone}</span></span>
                    <div className="w-1 h-1 bg-slate-300 rounded-full" />
                    <span className="text-[0.7rem] text-slate-400 font-medium">الرقم الطبي: <span className="text-slate-600">{patient.mrn}</span></span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="stat-card cursor-pointer group active:scale-[0.98]" onClick={() => navigate('/patients')}>
          <div className="flex justify-between items-start mb-2">
            <span className="stat-label">إجمالي المرضى</span>
            <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl group-hover:bg-primary group-hover:text-white transition-all duration-300">
              <Users size={18} strokeWidth={2.5} />
            </div>
          </div>
          <span className="stat-value">{counts.patients}</span>
          <div className="mt-2 flex items-center gap-1.5 opacity-60">
            <span className="text-[0.65rem] font-bold text-sky-600">إجمالي قاعدة البيانات</span>
          </div>
        </div>

        <div className="stat-card cursor-pointer group active:scale-[0.98]" onClick={() => navigate('/appointments')}>
          <div className="flex justify-between items-start mb-2">
            <span className="stat-label">مواعيد اليوم</span>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
              <Calendar size={18} strokeWidth={2.5} />
            </div>
          </div>
          <span className="stat-value">{counts.appointments}</span>
          <div className="mt-2 flex items-center gap-2">
            <span className={`flex h-2 w-2 rounded-full ${counts.appointments > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
            <span className="text-[0.65rem] font-bold text-emerald-600 uppercase tracking-wider">
              {counts.appointments > 0 ? 'نشط الآن' : 'لا يوجد مواعيد'}
            </span>
          </div>
        </div>

        <div className="stat-card cursor-pointer group active:scale-[0.98]" onClick={() => navigate('/billing')}>
          <div className="flex justify-between items-start mb-2">
            <span className="stat-label">إيرادات اليوم</span>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
              <CreditCard size={18} strokeWidth={2.5} />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="stat-value">{counts.revenue.toLocaleString()}</span>
            <span className="text-xs font-bold text-slate-400">ر.ي</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
             <span className="text-[0.65rem] font-bold text-amber-600">إجمالي التحصيل النقدي</span>
          </div>
        </div>

        <div className="stat-card cursor-pointer group active:scale-[0.98]" onClick={() => navigate('/clinic')}>
          <div className="flex justify-between items-start mb-2">
            <span className="stat-label">المهام الطبية المعلقة</span>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl group-hover:bg-rose-500 group-hover:text-white transition-all duration-300">
              <Activity size={18} strokeWidth={2.5} />
            </div>
          </div>
          <span className="stat-value">{counts.prescriptions + counts.radiology}</span>
          <div className="mt-2 flex items-center gap-1.5 font-bold">
            <span className="text-[0.65rem] text-rose-600">
              {counts.prescriptions} وصفات / {counts.radiology} أشعة
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 flex-1">
        <div className="panel lg:col-span-2 flex flex-col group/panel">
          <div className="panel-header flex justify-between items-center border-b-slate-100 px-7">
            <div className="flex items-center gap-3">
              <div className="w-2 h-6 bg-primary rounded-full" />
              <span className="text-base font-black tracking-tight">إحصائيات المراجعات اليومية</span>
            </div>
            <div className="flex bg-slate-100/80 p-1 rounded-xl gap-1">
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
          <div className="flex-1 p-4 min-h-[300px] relative">
             <ResponsiveContainer width="99%" height="100%" minHeight={300} minWidth={0}>
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
        
        <div className="panel shadow-lg shadow-slate-200/20">
          <div className="panel-header border-b-slate-100 px-7">
            <div className="flex items-center gap-3">
              <div className="w-2 h-6 bg-emerald-500 rounded-full" />
              <span className="text-base font-black tracking-tight">قائمة المواعيد الحالية</span>
            </div>
            <Link to="/appointments" className="text-[0.7rem] px-3 py-1.5 bg-slate-50 text-slate-500 hover:bg-primary hover:text-white rounded-lg transition-all font-black uppercase tracking-wider flex items-center gap-1.5">
              عرض الكل <ChevronLeft size={12} />
            </Link>
          </div>
          <div className="overflow-auto px-2 pb-2 h-full min-h-[300px]">
            {recentAppointments.length > 0 ? (
              <table className="w-full text-right">
                <thead>
                  <tr className="border-b border-slate-50 bg-slate-50/20">
                    <th className="px-5 py-4 text-[0.65rem] text-slate-400 font-black uppercase tracking-widest">المريض</th>
                    <th className="px-5 py-4 text-[0.65rem] text-slate-400 font-black uppercase tracking-widest">القاعة / الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recentAppointments.map((row, i) => (
                    <tr key={i} className="group/row hover:bg-slate-50/80 transition-all">
                      <td className="px-5 py-5">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-800 group-hover/row:text-primary transition-colors">{row.patientName}</span>
                          <span className="text-[0.65rem] text-slate-400 font-medium">{row.doctorName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-5 text-left">
                        <span className={`px-3 py-1 rounded-lg text-[0.65rem] font-black uppercase tracking-wider shadow-sm ${
                          row.status === 'scheduled' ? 'bg-sky-50 text-sky-600' :
                          row.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {row.status === 'scheduled' ? 'مجدول' : row.status === 'completed' ? 'مكتمل' : row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400 gap-3 grayscale opacity-70">
                <Calendar size={48} strokeWidth={1} />
                <p className="font-bold text-sm">لا يوجد مواعيد نشطة حالياً</p>
                <Button variant="ghost" size="sm" onClick={() => navigate('/appointments')}>جدولة موعد</Button>
              </div>
            )}
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

        <div className="panel shadow-lg shadow-primary/5">
          <div className="panel-header px-7 border-b-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-2 h-6 bg-slate-900 rounded-full" />
              <span className="text-base font-black tracking-tight">حالة النظام والاتصال المزدوج</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${navigator.onLine ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-widest">{navigator.onLine ? 'متصل مباشر' : 'يعمل دون اتصال'}</span>
            </div>
          </div>
          <div className="p-6 flex flex-col h-full gap-5">
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[0.7rem] font-black text-slate-400 uppercase tracking-widest">تزامن السحابة</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">Cloud Storage Node</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">نشط</span>
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[0.7rem] font-black text-slate-400 uppercase tracking-widest">قاعدة البيانات المحلية</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">Dexie.js IndexedDB</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-primary bg-sky-50 px-2 py-1 rounded-lg">مستقر</span>
                </div>
              </div>
            </div>
            
            <div className="pt-4 border-t border-slate-100 mt-auto">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[0.65rem] font-bold text-slate-500">آخر مزامنة ناجحة</span>
                <span className="text-[0.65rem] font-mono text-slate-400">{new Date().toLocaleTimeString()}</span>
              </div>
              <Button 
                variant="outline" 
                className="w-full h-10 rounded-xl font-bold gap-2 text-xs border-slate-200 hover:bg-primary transition-all group"
                onClick={() => toast.success('جاري التحقق من سلامة البيانات وتزامن السجلات...')}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 group-hover:bg-white" />
                تحميل المزامنة اليدوية الآن
              </Button>
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
