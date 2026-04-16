/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileBarChart, Download, FileText, PieChart, BarChart3, Users, TrendingUp, AreaChart as AreaChartIcon } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  PieChart as RePieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';

const data = [
  { name: 'السبت', patients: 45, revenue: 4500 },
  { name: 'الأحد', patients: 52, revenue: 5200 },
  { name: 'الاثنين', patients: 38, revenue: 3800 },
  { name: 'الثلاثاء', patients: 65, revenue: 6500 },
  { name: 'الأربعاء', patients: 48, revenue: 4800 },
  { name: 'الخميس', patients: 59, revenue: 5900 },
  { name: 'الجمعة', patients: 20, revenue: 2000 },
];

const pieData = [
  { name: 'عامة', value: 400 },
  { name: 'أطفال', value: 300 },
  { name: 'أسنان', value: 300 },
  { name: 'جلدية', value: 200 },
];

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444'];

export default function Reports() {
  const { profile } = useAuth();

  if (profile?.role === 'patient') return null;

  const reportTypes = [
    { title: 'تقارير المرضى', icon: Users, description: 'إحصائيات المرضى الجدد والتركيبة السكانية' },
    { title: 'التقارير المالية', icon: BarChart3, description: 'الإيرادات، المصروفات، والتدفقات النقدية' },
    { title: 'تقارير المواعيد', icon: FileBarChart, description: 'معدلات الحضور والإلغاء وتوزيع المواعيد' },
  ];

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileBarChart className="text-primary" />
          مركز التقارير والإحصائيات
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
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
              <Button variant="outline" size="sm" className="flex-1 gap-2">
                <Download size={14} /> تحميل PDF
              </Button>
              <Button variant="outline" size="sm" className="flex-1 gap-2">
                <Download size={14} /> تصدير Excel
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
