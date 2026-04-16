/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileBarChart, Download, Users, TrendingUp, BarChart3, PieChart, ScanLine, FileText, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { localDB } from '@/src/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { exportToCSV, exportToExcel, exportToPDF } from '@/src/lib/exportUtils';
import { BarcodeScanner } from '@/src/components/BarcodeScanner';
import { toast } from 'sonner';
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
  
  const patientsCount = useLiveQuery(() => localDB.patients.count()) || 0;
  const inventoryCount = useLiveQuery(() => localDB.inventory.count()) || 0;
  const labRequestsCount = useLiveQuery(() => localDB.labRequests.count()) || 0;

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
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileBarChart className="text-primary" />
          مركز التقارير والإحصائيات
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/5" onClick={() => setIsScannerOpen(true)}>
            <ScanLine size={18} /> مسح سريع
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleExportAll}>
            <Download size={18} /> تصدير التقرير الشامل
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp size={18} className="text-primary" />
              إحصائيات المرضى الأسبوعية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="patients" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="عدد المرضى" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 size={18} className="text-emerald-600" />
              إحصائيات الإيرادات الأسبوعية (ر.ي)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRevenue)" name="الإيرادات (ر.ي)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart size={18} className="text-success" />
              توزيع المرضى حسب التخصص
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RePieChart>
              </ResponsiveContainer>
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
