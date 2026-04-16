/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { AuditLog } from '@/src/types';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, ShieldCheck, Clock, User, Activity } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';

export default function AuditLogs() {
  const { profile, isAdmin } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  if (!isAdmin) return (
    <div className="p-6 text-center">
      <h1 className="text-2xl font-bold text-danger">غير مصرح لك بالدخول</h1>
      <p>هذه الصفحة مخصصة للمسؤولين فقط.</p>
    </div>
  );

  useEffect(() => {
    const q = query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'), limit(100));
    const unsub = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AuditLog[]);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'audit_logs'));

    return () => unsub();
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || log.entityType === filterType;

    return matchesSearch && matchesType;
  });

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="text-primary" />
          سجل الرقابة والتدقيق (Audit Logs)
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity size={16} /> إجمالي العمليات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{logs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <User size={16} /> المستخدمين النشطين
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{new Set(logs.map(l => l.userId)).size}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock size={16} /> آخر عملية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-bold">
              {logs[0]?.createdAt?.toDate().toLocaleString('ar-SA') || 'لا يوجد'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            placeholder="البحث في العمليات، المستخدمين، أو التفاصيل..." 
            className="pr-10"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full md:w-48">
          <select 
            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="all">كل الأنواع</option>
            <option value="patient">المرضى</option>
            <option value="record">السجلات الطبية</option>
            <option value="bill">الفواتير</option>
            <option value="prescription">الوصفات</option>
            <option value="lab">المختبر</option>
            <option value="radiology">الأشعة</option>
            <option value="inventory">المخزون</option>
            <option value="user">المستخدمين</option>
          </select>
        </div>
      </div>

      <div className="panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>التاريخ والوقت</TableHead>
              <TableHead>المستخدم</TableHead>
              <TableHead>العملية</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>التفاصيل</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-xs font-mono">
                  {log.createdAt?.toDate().toLocaleString('ar-SA')}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-bold">{log.userName}</span>
                    <span className="text-[0.65rem] text-muted-foreground uppercase">{log.userRole}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-medium text-primary">{log.action}</span>
                </TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded text-[0.65rem] font-bold ${
                    log.entityType === 'patient' ? 'bg-blue-100 text-blue-700' :
                    log.entityType === 'bill' ? 'bg-emerald-100 text-emerald-700' :
                    log.entityType === 'record' ? 'bg-purple-100 text-purple-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {log.entityType}
                  </span>
                </TableCell>
                <TableCell className="text-sm max-w-xs truncate" title={log.details}>
                  {log.details}
                </TableCell>
              </TableRow>
            ))}
            {filteredLogs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  لا توجد سجلات مطابقة للبحث
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
