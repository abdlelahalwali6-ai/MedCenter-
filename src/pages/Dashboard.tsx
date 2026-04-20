/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  const { profile, isPatient } = useAuth();
  const navigate = useNavigate();

  if (isPatient) return null;

  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({
    patients: 0,
    appointments: 0,
    prescriptions: 0,
    radiology: 0,
    revenue: 0
  });
  const [recentAppointments, setRecentAppointments] = useState<any[]>([]);
  const [chartView, setChartView] = useState<'patients' | 'revenue'>('patients');
  
  // Refactored chart data states for accuracy
  const [patientTrend, setPatientTrend] = useState<any[]>([]);
  const [revenueTrend, setRevenueTrend] = useState<any[]>([]);

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

  const chartData = useMemo(() => {
    const baseline = [8, 10, 12, 14, 16, 18, 20].map(h => ({
      name: `${h > 12 ? h - 12 : h} ${h >= 12 ? 'PM' : 'AM'}`
    }));

    return baseline.map(point => {
      const patientData = patientTrend.find(p => p.name === point.name);
      const revenueData = revenueTrend.find(r => r.name === point.name);
      return {
        name: point.name,
        patients: patientData?.patients || 0,
        revenue: revenueData?.revenue || 0
      };
    });
  }, [patientTrend, revenueTrend]);

  useEffect(() => {
    if (!profile || profile.role === 'patient') return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTS = Timestamp.fromDate(today);

    const unsubscribers: (() => void)[] = [];

    // Real-time counts
    unsubscribers.push(onSnapshot(collection(db, 'patients'), (snap) => {
      setCounts(prev => ({ ...prev, patients: snap.size }));
    }));

    // Appointments for today + list + patient trend
    unsubscribers.push(onSnapshot(
      query(collection(db, 'appointments'), where('date', '>=', todayTS)),
      (snap) => {
        setCounts(prev => ({ ...prev, appointments: snap.size }));
        setRecentAppointments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).slice(0, 5));
        
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
          patients: (hourlyPatients[h] || 0) + (hourlyPatients[h + 1] || 0),
        }));
        setPatientTrend(trend);
      }
    ));

    // Revenue tracking (Bills) + revenue trend
    unsubscribers.push(onSnapshot(
      query(collection(db, 'bills'), where('createdAt', '>=', todayTS)),
      (snap) => {
        let totalRev = 0;
        const hourlyRev: { [key: number]: number } = {};
        
        snap.docs.forEach(doc => {
          const data = doc.data();
          const amount = data.finalAmount || data.totalAmount || 0;
          totalRev += amount;
          
          if (data.createdAt) {
            const date = data.createdAt.toDate();
            const hour = date.getHours();
            hourlyRev[hour] = (hourlyRev[hour] || 0) + amount;
          }
        });
        
        setCounts(prev => ({ ...prev, revenue: totalRev }));
        
        const trend = [8, 10, 12, 14, 16, 18, 20].map(h => ({
          name: `${h > 12 ? h - 12 : h} ${h >= 12 ? 'PM' : 'AM'}`,
          revenue: (hourlyRev[h] || 0) + (hourlyRev[h + 1] || 0)
        }));
        setRevenueTrend(trend);
      }
    ));

    // Pending Prescriptions
    unsubscribers.push(onSnapshot(
      query(collection(db, 'prescriptions'), where('status', '==', 'pending')),
      (snap) => setCounts(prev => ({ ...prev, prescriptions: snap.size }))
    ));

    // Pending Radiology
    unsubscribers.push(onSnapshot(
      query(collection(db, 'radiology_requests'), where('status', '==', 'pending')),
      (snap) => setCounts(prev => ({ ...prev, radiology: snap.size }))
    ));

    // Stop loading after a short delay to allow snapshots to deliver initial data
    const timer = setTimeout(() => setLoading(false), 1500);

    return () => {
      unsubscribers.forEach(unsub => unsub());
      clearTimeout(timer);
    };
  }, [profile]);
  
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (quickSearch.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      try {
        const q = query(collection(db, 'patients'), where('name', '>=', quickSearch), where('name', '<=', quickSearch + '\uf8ff'), limit(5));
        const snap = await getDocs(q);
        const results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

  const handleQuickSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSearch.trim()) return;
    setIsSearching(true);
    try {
      let q = query(collection(db, 'patients'), where('phone', '==', quickSearch), limit(1));
      let snap = await getDocs(q);
      if (snap.empty) {
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
        const isNumeric = /^\d+$/.test(quickSearch);
        setNewPatientData({ name: isNumeric ? '' : quickSearch, age: '', phone: isNumeric ? quickSearch : '', gender: 'male' });
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
      const docRef = await addDoc(collection(db, 'patients'), { ...newPatientData, mrn, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
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

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {/* Header */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/20 flex flex-col lg:flex-row items-center justify-between gap-6 relative group">
        <div className="relative flex items-center gap-5">
            <div className="p-4 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20">
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
                    <Input placeholder="رقم الهاتف أو اسم المريض..." className="w-full pr-10 h-12 bg-slate-50 border-slate-200 rounded-xl" value={quickSearch} onChange={e => setQuickSearch(e.target.value)} />
                </div>
                <Button type="submit" size="lg" className="rounded-xl px-8 font-bold shadow-md shadow-primary/20" disabled={isSearching}>
                    {isSearching ? <Loader2 className="animate-spin" /> : 'بحث'}
                </Button>
            </form>
            {showSuggestions && <div className="absolute z-50 w-full bg-white mt-2 rounded-2xl border shadow-2xl p-2"> {suggestions.map(p => <button key={p.id} onClick={() => handleSelectPatient(p)} className="w-full text-right p-3 hover:bg-slate-50 rounded-lg">{p.name} - {p.phone}</button>)}</div>}
        </div>
    </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Stat Cards */}
        {[ { title: 'إجمالي المرضى', value: counts.patients, icon: Users, color: 'sky' }, { title: 'مواعيد اليوم', value: counts.appointments, icon: Calendar, color: 'emerald' }, { title: 'إيرادات اليوم', value: counts.revenue.toLocaleString(), unit: 'ر.ي', icon: CreditCard, color: 'amber' }, { title: 'المهام الطبية المعلقة', value: counts.prescriptions + counts.radiology, icon: Activity, color: 'rose' } ].map((stat, i) => (
            <div key={i} className="stat-card group">
                <div className="flex justify-between items-start mb-2">
                    <span className="stat-label">{stat.title}</span>
                    <div className={`p-2.5 bg-${stat.color}-50 text-${stat.color}-600 rounded-xl group-hover:bg-${stat.color}-500 group-hover:text-white transition-all`}>
                        <stat.icon size={18} strokeWidth={2.5} />
                    </div>
                </div>
                {loading ? <Loader2 className={`animate-spin text-${stat.color}-500 mt-2`} /> : <span className="stat-value">{stat.value} {stat.unit}</span>}
            </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3 flex-1">
        <div className="panel lg:col-span-2">
          <div className="panel-header flex justify-between items-center">
            <span className="font-bold">إحصائيات المراجعات اليومية</span>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button onClick={() => setChartView('patients')} className={`px-3 py-1 text-xs font-bold rounded ${chartView === 'patients' ? 'bg-white shadow text-primary' : 'text-secondary'}`}>المرضى</button>
              <button onClick={() => setChartView('revenue')} className={`px-3 py-1 text-xs font-bold rounded ${chartView === 'revenue' ? 'bg-white shadow text-primary' : 'text-secondary'}`}>الإيرادات</button>
            </div>
          </div>
          <div className="flex-1 p-4 min-h-[300px] relative">
            {loading ? <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={32} /></div> : (
                <ResponsiveContainer width="100%" height={300}>
                {chartView === 'patients' ? (
                    <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="patients" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="عدد المرضى" />
                    </BarChart>
                ) : (
                    <AreaChart data={chartData}>
                    <defs><linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#colorRev)" name="الإيرادات (ر.ي)" />
                    </AreaChart>
                )}
                </ResponsiveContainer>
            )}
          </div>
        </div>
        
        <div className="panel">
          <div className="panel-header flex justify-between items-center">
            <span className="font-bold">قائمة المواعيد الحالية</span>
            <Link to="/appointments" className="text-xs text-slate-500 hover:text-primary">عرض الكل</Link>
          </div>
          <div className="overflow-auto p-2 h-full min-h-[300px]">
            {loading ? <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-primary" /></div> : recentAppointments.length > 0 ? (
              <table className="w-full text-right">
                <tbody>
                  {recentAppointments.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-3"><span className="font-semibold">{row.patientName}</span><br/><span className="text-xs text-slate-500">{row.doctorName}</span></td>
                      <td className="p-3 text-left"><span className={`px-2 py-1 rounded text-xs font-bold ${row.status === 'scheduled' ? 'bg-sky-100 text-sky-700' : 'bg-green-100 text-green-700'}`}>{row.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">لا يوجد مواعيد</div>
            )}
          </div>
        </div>
      </div>
      {/* Dialog for Quick Action */}
      <Dialog open={showQuickAction} onOpenChange={setShowQuickAction}><DialogContent dir="rtl"><DialogHeader><DialogTitle>{isRegistering ? 'تسجيل مريض جديد':'إجراء سريع'}</DialogTitle><DialogDescription>{isRegistering ? 'لم يتم العثور على المريض.':`المريض: ${searchResult?.name}`}</DialogDescription></DialogHeader>{isRegistering ? <div className="py-4 space-y-2"><Label>الاسم</Label><Input value={newPatientData.name} onChange={e => setNewPatientData({...newPatientData, name: e.target.value})}/><Label>الهاتف</Label><Input value={newPatientData.phone} onChange={e => setNewPatientData({...newPatientData, phone: e.target.value})}/></div> : <div className="py-4 grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => navigate(`/clinic?patientId=${searchResult.id}`)}>معاينة</Button><Button variant="outline" onClick={() => navigate(`/appointments?patientId=${searchResult.id}`)}>موعد</Button></div>}<DialogFooter>{isRegistering && <Button onClick={handleRegisterPatient} disabled={isSubmitting}>{isSubmitting ? 'جاري التسجيل...':'تسجيل'}</Button>}</DialogFooter></DialogContent></Dialog>
    </div>
  );
}
