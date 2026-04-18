/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileBarChart, Download, Users, TrendingUp, BarChart3, PieChart, ScanLine, FileText, FileSpreadsheet, Loader2, Calendar as CalendarIcon, Filter } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { localDB } from '@/src/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { exportToCSV, exportToExcel, exportToPDF } from '@/src/lib/exportUtils';
import { BarcodeScanner } from '@/src/components/BarcodeScanner';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatArabicDate } from '@/src/lib/dateUtils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart as RePieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444'];

export default function Reports() {
  const { profile } = useAuth();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ 
    start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0], 
    end: new Date().toISOString().split('T')[0] 
  });
  
  // Advanced Filters
  const [filters, setFilters] = useState({
    patientId: 'all',
    doctorId: 'all',
    serviceId: 'all',
    costCenter: 'all'
  });

  const [filterLists, setFilterLists] = useState({
    patients: [] as any[],
    doctors: [] as any[],
    services: [] as any[],
    costCenters: ['CC-001', 'CC-General', 'CC-Emergency']
  });

  const [reportData, setReportData] = useState<{
    patientsOverTime: any[];
    revenueByCategory: any[];
    appointmentsByStatus: any[];
    serviceEfficiency: any[];
  }>({
    patientsOverTime: [],
    revenueByCategory: [],
    appointmentsByStatus: [],
    serviceEfficiency: []
  });

  const patientsCount = useLiveQuery(() => localDB.patients.count()) || 0;
  const inventoryCount = useLiveQuery(() => localDB.inventory.count()) || 0;
  const labRequestsCount = useLiveQuery(() => localDB.labRequests.count()) || 0;

  const allPatients = useLiveQuery(() => localDB.patients.toArray()) || [];
  const allDoctors = useLiveQuery(() => localDB.profiles.filter(p => p.role === 'doctor').toArray()) || [];
  const allServices = useLiveQuery(() => localDB.serviceCatalog.toArray()) || [];
  const allBills = useLiveQuery(() => localDB.bills.toArray()) || [];
  const allAppointments = useLiveQuery(() => localDB.appointments.toArray()) || [];

  useEffect(() => {
    setFilterLists(prev => ({
      ...prev,
      patients: allPatients.map(p => ({ id: p.id, name: p.name })),
      doctors: allDoctors.map(d => ({ id: d.uid, name: d.displayName })),
      services: allServices.map(s => ({ id: s.id, name: s.name }))
    }));
  }, [allPatients, allDoctors, allServices]);

  useEffect(() => {
    const generateReports = async () => {
      setLoading(true);
      try {
        const start = new Date(dateRange.start).getTime();
        const end = new Date(dateRange.end).getTime() + (24 * 60 * 60 * 1000); // end of day

        // 1. Patients trend
        const filteredPatients = allPatients.filter(p => {
          const createdAt = p.createdAt ? new Date(p.createdAt).getTime() : 0;
          return createdAt >= start && createdAt <= end;
        });

        const patientTrend: {[key: string]: number} = {};
        filteredPatients.forEach(p => {
          const date = p.createdAt ? new Date(p.createdAt) : new Date();
          const day = date.toLocaleDateString('ar-SA', { weekday: 'long' });
          patientTrend[day] = (patientTrend[day] || 0) + 1;
        });

        // 2. Bills for revenue with filters
        const filteredBills = allBills.filter(b => {
          const createdAt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          if (createdAt < start || createdAt > end) return false;
          if (filters.patientId !== 'all' && b.patientId !== filters.patientId) return false;
          if (filters.costCenter !== 'all' && b.costCenter !== filters.costCenter) return false;
          if (filters.doctorId !== 'all' && b.doctorId !== filters.doctorId) return false;
          return true;
        });
        
        const revMap: {[key: string]: number} = {
          'عيادة': 0,
          'مختبر': 0,
          'أشعة': 0,
          'صيدلية': 0
        };
        
        filteredBills.forEach(b => {
          const type = b.type === 'clinic' ? 'عيادة' : 
                       b.type === 'lab' ? 'مختبر' : 
                       b.type === 'radiology' ? 'أشعة' : 
                       b.type === 'pharmacy' ? 'صيدلية' : 'أخرى';
          revMap[type] = (revMap[type] || 0) + (b.totalAmount || 0);
        });

        // 3. Appointments Status with filters
        const filteredAppointments = allAppointments.filter(a => {
          const appDate = a.date ? new Date(a.date).getTime() : 0;
          if (appDate < start || appDate > end) return false;
          if (filters.patientId !== 'all' && a.patientId !== filters.patientId) return false;
          if (filters.doctorId !== 'all' && a.doctorId !== filters.doctorId) return false;
          return true;
        });
        
        const statusMap: {[key: string]: number} = {
          'scheduled': 0,
          'completed': 0,
          'cancelled': 0,
          'checked-in': 0
        };
        filteredAppointments.forEach(a => {
          const status = a.status || 'scheduled';
          statusMap[status] = (statusMap[status] || 0) + 1;
        });

        // Mapping to chart formats
        const days = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
        
        setReportData({
          patientsOverTime: days.map(d => ({ name: d, value: patientTrend[d] || 0 })),
          revenueByCategory: Object.entries(revMap).map(([name, value]) => ({ name, value })),
          appointmentsByStatus: [
            { name: 'مكتمل', value: statusMap['completed'] || 0 },
            { name: 'مجدول', value: statusMap['scheduled'] || 0 },
            { name: 'وصول', value: statusMap['checked-in'] || 0 },
            { name: 'ملغي', value: statusMap['cancelled'] || 0 },
          ],
          serviceEfficiency: [
            { name: 'الكفاءة العامة', value: statusMap['completed'] > 0 ? Math.round((statusMap['completed'] / (statusMap['completed'] + statusMap['scheduled'])) * 100) : 0 }
          ]
        });
      } catch (error) {
        console.error("Report generation error:", error);
        toast.error('فشل في توليد التقارير من البيانات المحلية');
      } finally {
        setLoading(false);
      }
    };

    generateReports();
  }, [dateRange, filters, allPatients, allDoctors, allServices, allBills, allAppointments]);

  if (profile?.role === 'patient') return null;

  const handleExportAll = () => {
    const data = [
      { 'القسم': 'إجمالي المرضى', 'العدد': patientsCount },
      { 'القسم': 'إجمالي الأدوية', 'العدد': inventoryCount },
      { 'القسم': 'إجمالي الفحوصات', 'العدد': labRequestsCount },
    ];
    exportToCSV(data, `تقرير_شامل_${new Date().toLocaleDateString('ar-SA')}`);
    toast.success('تم تصدير التقرير الشامل بنجاح');
  };

  const handleExportSection = async (type: string, format: 'pdf' | 'excel') => {
    let data: any[] = [];
    let filename = '';

    try {
      if (type === 'تقارير المرضى') {
        const patients = await localDB.patients.toArray();
        data = patients.map(p => ({
          'الاسم': p.name,
          'رقم الملف': p.mrn,
          'الجوال': p.phone,
          'الجنس': p.gender === 'male' ? 'ذكر' : 'أنثى',
          'فصيلة الدم': p.bloodType || 'غير معروف'
        }));
        filename = 'تقرير_المرضى';
      } else if (type === 'التقارير المالية') {
        // Since we don't have a bills table in Dexie yet, or complicated financial data,
        // we export a mock financial summary
        data = [
          { 'الفترة': 'اليوم', 'الإيرادات': 25000, 'المصروفات': 5000 },
          { 'الفترة': 'هذا الأسبوع', 'الإيرادات': 150000, 'المصروفات': 30000 },
        ];
        filename = 'التقرير_المالي';
      } else {
        const requests = await localDB.labRequests.toArray();
        data = requests.map(r => ({
          'المريض': r.patientName,
          'الحالة': r.status,
          'الفحوصات': r.tests.map(t => t.name).join(' - ')
        }));
        filename = 'تقرير_المختبر';
      }

      if (data.length > 0) {
        if (format === 'excel') {
          exportToExcel(data, `${filename}_${new Date().toLocaleDateString('ar-SA')}`);
        } else {
          exportToPDF(data, `${filename}_${new Date().toLocaleDateString('ar-SA')}`, type);
        }
        toast.success(`تم البدء في تصدير تقرير ${type} بصيغة ${format.toUpperCase()}`);
      } else {
        toast.error('لا توجد بيانات لتصديرها');
      }
    } catch (error) {
      toast.error('فشل في عملية التصدير');
    }
  };

  const handleScan = (barcode: string) => {
    toast.info(`تم مسح الباركود: ${barcode}. جارٍ البحث في التقارير...`);
    setIsScannerOpen(false);
  };

  // Mocked trend data based on current counts for visual appeal if database is fresh
  const data = [
    { name: 'السبت', patients: Math.floor(patientsCount * 0.1) + 20, revenue: 4500 },
    { name: 'الأحد', patients: Math.floor(patientsCount * 0.12) + 25, revenue: 5200 },
    { name: 'الاثنين', patients: Math.floor(patientsCount * 0.08) + 15, revenue: 3800 },
    { name: 'الثلاثاء', patients: Math.floor(patientsCount * 0.15) + 30, revenue: 6500 },
    { name: 'الأربعاء', patients: Math.floor(patientsCount * 0.11) + 22, revenue: 4800 },
    { name: 'الخميس', patients: Math.floor(patientsCount * 0.14) + 28, revenue: 5900 },
    { name: 'الجمعة', patients: Math.floor(patientsCount * 0.05) + 10, revenue: 2000 },
  ];

  const pieData = [
    { name: 'المخزون', value: inventoryCount },
    { name: 'المرضى', value: patientsCount },
    { name: 'المختبر', value: labRequestsCount },
    { name: 'أخرى', value: 10 },
  ];

  const reportTypes = [
    { title: 'تقارير المرضى', icon: Users, description: 'إحصائيات المرضى الجدد والتركيبة السكانية' },
    { title: 'التقارير المالية', icon: BarChart3, description: 'الإيرادات، المصروفات، والتدفقات النقدية' },
    { title: 'تقارير المواعيد', icon: FileBarChart, description: 'معدلات الحضور والإلغاء وتوزيع المواعيد' },
  ];

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {isScannerOpen && (
        <BarcodeScanner onScan={handleScan} onClose={() => setIsScannerOpen(false)} title="مسح باركود للبحث السريع" />
      )}
      <div className="flex flex-col gap-4 bg-white p-6 rounded-2xl border shadow-sm">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-black flex items-center gap-2">
            <FileBarChart className="text-primary" />
            مركز التقارير الموحد
          </h1>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setIsScannerOpen(true)}>
              <ScanLine size={18} /> مسح سريع
            </Button>
            <Button className="gap-2 rounded-xl" onClick={handleExportAll}>
              <Download size={18} /> تصدير شامل (CSV)
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-4 border-t border-slate-50">
          <div className="space-y-1">
            <Label className="text-[0.65rem] font-bold text-slate-400">الفترة الزمنية</Label>
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border">
               <Input 
                type="date" 
                className="h-8 border-none bg-transparent font-bold text-[0.7rem] px-1" 
                value={dateRange.start}
                onChange={e => setDateRange({...dateRange, start: e.target.value})}
               />
               <span className="text-slate-300">-</span>
               <Input 
                type="date" 
                className="h-8 border-none bg-transparent font-bold text-[0.7rem] px-1" 
                value={dateRange.end}
                onChange={e => setDateRange({...dateRange, end: e.target.value})}
               />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[0.65rem] font-bold text-slate-400">حسب المريض</Label>
            <Select value={filters.patientId} onValueChange={val => setFilters({...filters, patientId: val})}>
              <SelectTrigger className="h-10 text-xs bg-slate-50 rounded-lg">
                <SelectValue placeholder="اختر مريض..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المرضى</SelectItem>
                {filterLists.patients.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[0.65rem] font-bold text-slate-400">حسب الطبيب</Label>
            <Select value={filters.doctorId} onValueChange={val => setFilters({...filters, doctorId: val})}>
              <SelectTrigger className="h-10 text-xs bg-slate-50 rounded-lg">
                <SelectValue placeholder="اختر طبيب..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأطباء</SelectItem>
                {filterLists.doctors.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[0.65rem] font-bold text-slate-400">مركز التكلفة</Label>
            <Select value={filters.costCenter} onValueChange={val => setFilters({...filters, costCenter: val})}>
              <SelectTrigger className="h-10 text-xs bg-slate-50 rounded-lg">
                <SelectValue placeholder="اختر مركز..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المراكز</SelectItem>
                {filterLists.costCenters.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button 
              variant="ghost" 
              className="w-full h-10 text-xs gap-2 text-slate-400 hover:text-danger"
              onClick={() => setFilters({ patientId: 'all', doctorId: 'all', serviceId: 'all', costCenter: 'all' })}
            >
              <Filter size={14} /> إعادة ضبط
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl overflow-hidden animate-in fade-in duration-500">
          <CardHeader className="bg-slate-50/50">
            <CardTitle className="text-base font-black flex items-center gap-2">
              <TrendingUp size={18} className="text-primary" />
              منحنى نمو المرضى
            </CardTitle>
            <CardDescription>تحليل عدد المراجعات اليومية خلال الفترة المختارة</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px] w-full min-h-[300px] relative">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                  <Loader2 className="animate-spin text-primary" />
                </div>
              ) : null}
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={reportData.patientsOverTime}>
                  <defs>
                    <linearGradient id="colorP" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                  <Tooltip />
                  <Area type="monotone" dataKey="value" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorP)" strokeWidth={3} name="المرضى" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl overflow-hidden animate-in fade-in duration-700">
          <CardHeader className="bg-slate-50/50">
            <CardTitle className="text-base font-black flex items-center gap-2">
              <BarChart3 size={18} className="text-emerald-500" />
              توزيع الإيرادات حسب الخدمات
            </CardTitle>
            <CardDescription>مقارنة الدخل المالي بين الأقسام المختلفة</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px] w-full min-h-[300px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportData.revenueByCategory}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                  <Tooltip cursor={{fill: '#F8FAFC'}} />
                  <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40} name="الإيرادات" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl overflow-hidden animate-in fade-in duration-900">
          <CardHeader className="bg-slate-50/50">
            <CardTitle className="text-base font-black flex items-center gap-2">
              <PieChart size={18} className="text-amber-500" />
              حالة المواعيد المجدولة
            </CardTitle>
            <CardDescription>تحليل كفاءة المواعيد ونسبة الحضور</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px] w-full min-h-[300px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={reportData.appointmentsByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {reportData.appointmentsByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RePieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {reportData.appointmentsByStatus.map((entry, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-[0.65rem] font-bold text-slate-600">{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reportTypes.map((report, i) => (
          <Card key={i} className="hover:shadow-md transition-all group">
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                <report.icon size={24} />
              </div>
              <div>
                <CardTitle className="text-lg">{report.title}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">{report.description}</p>
              </div>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 gap-2"
                onClick={() => handleExportSection(report.title, 'pdf')}
              >
                <FileText size={14} /> تحميل PDF
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 gap-2"
                onClick={() => handleExportSection(report.title, 'excel')}
              >
                <FileSpreadsheet size={14} /> تصدير Excel
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
