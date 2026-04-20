/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, query, onSnapshot, orderBy, updateDoc, doc, serverTimestamp, addDoc, getDocs, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { DataService } from '@/src/lib/dataService';
import { formatArabicDate } from '@/src/lib/dateUtils';
import { logAction } from '@/src/lib/audit';
import { LabRequest, LabTest, Patient, LabCatalogItem } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LabReport } from '@/src/components/LabReport';
import { Badge } from "@/components/ui/badge";
import { 
  FlaskConical, 
  Search, 
  FileUp, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  Edit3, 
  Save, 
  X, 
  Loader2, 
  Settings, 
  Plus 
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/src/context/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Lab() {
  const { profile, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const patientIdFromUrl = searchParams.get('patientId');

  if (profile?.role === 'patient') return null;

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<LabRequest[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [catalog, setCatalog] = useState<LabCatalogItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<LabRequest | null>(null);
  const [isResultDialogOpen, setIsResultDialogOpen] = useState(false);
  const [editingResults, setEditingResults] = useState<LabTest[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    const unsubs: (()=>void)[] = [];

    unsubs.push(onSnapshot(query(collection(db, 'lab_requests'), orderBy('createdAt', 'desc')), 
      (snap) => { setRequests(snap.docs.map(d => ({id: d.id, ...d.data()})) as LabRequest[]); setLoading(false); },
      (err) => { handleFirestoreError(err, OperationType.LIST, 'lab requests'); setLoading(false); }
    ));

    unsubs.push(onSnapshot(query(collection(db, 'patients'), orderBy('name', 'asc')), 
      (snap) => setPatients(snap.docs.map(d => ({id: d.id, ...d.data()})) as Patient[])
    ));

    unsubs.push(onSnapshot(query(collection(db, 'lab_catalog')), 
      (snap) => setCatalog(snap.docs.map(d => ({id: d.id, ...d.data()})) as LabCatalogItem[])
    ));

    return () => unsubs.forEach(unsub => unsub());
  }, [profile]);

  const handleUpdateStatus = async (requestId: string, newStatus: string) => {
    try {
      await DataService.update('lab_requests', requestId, { status: newStatus });
      toast.success('تم تحديث الحالة');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'lab request');
    }
  };

  const openResultDialog = (request: LabRequest) => {
    setSelectedRequest(request);
    setEditingResults(JSON.parse(JSON.stringify(request.tests))); // Deep copy
    setIsResultDialogOpen(true);
  };

  const handleResultChange = (testIndex: number, field: string, value: string, itemIndex?: number) => {
    const newResults = [...editingResults];
    if (itemIndex !== undefined) {
        newResults[testIndex].items[itemIndex][field] = value;
    } else {
        newResults[testIndex][field] = value;
    }
    setEditingResults(newResults);
  };

  const saveResults = async () => {
    if (!selectedRequest) return;
    setIsSubmitting(true);
    try {
      const allCompleted = editingResults.every(t => (t.items && t.items.length > 0) ? t.items.every(i => i.result) : t.result);
      await DataService.update('lab_requests', selectedRequest.id, { 
        tests: editingResults,
        status: allCompleted ? 'completed' : 'in-progress'
      });
      toast.success('تم حفظ النتائج');
      setIsResultDialogOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'lab results');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRequests = requests.filter(req => 
    (req.patientName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const RequestTable = ({ data }: { data: LabRequest[] }) => (
    <Table>
      <TableHeader><TableRow><TableHead>المريض</TableHead><TableHead>التحاليل</TableHead><TableHead>التاريخ</TableHead><TableHead>الحالة</TableHead><TableHead>إجراء</TableHead></TableRow></TableHeader>
      <TableBody>
        {data.map(req => (
          <TableRow key={req.id}>
            <TableCell>{req.patientName}</TableCell>
            <TableCell>{req.tests.map(t => t.name).join(', ')}</TableCell>
            <TableCell>{formatArabicDate(req.createdAt)}</TableCell>
            <TableCell><Badge variant={req.status === 'completed' ? 'success' : (req.status === 'pending' ? 'warning' : 'default')}>{req.status}</Badge></TableCell>
            <TableCell>
              {req.status === 'pending' && <Button size="sm" onClick={() => handleUpdateStatus(req.id, 'in-progress')}>بدء الفحص</Button>}
              {(req.status === 'in-progress' || req.status === 'completed') && <Button size="sm" onClick={() => openResultDialog(req)}>إدخال النتائج</Button>}
            </TableCell>
          </TableRow>
        ))}
        {data.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-10">لا توجد طلبات</TableCell></TableRow>}
      </TableBody>
    </Table>
  );

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">المختبر</h1>
      <div className="grid grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><p>بانتظار العينة</p><p className="text-2xl font-bold">{requests.filter(r => r.status === 'pending').length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p>قيد المعالجة</p><p className="text-2xl font-bold">{requests.filter(r => r.status === 'in-progress').length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p>نتائج جاهزة</p><p className="text-2xl font-bold">{requests.filter(r => r.status === 'completed').length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p>إجمالي الطلبات</p><p className="text-2xl font-bold">{requests.length}</p></CardContent></Card>
      </div>
      <div className="panel">
        <Tabs defaultValue="all">
          <TabsList><TabsTrigger value="all">الكل</TabsTrigger><TabsTrigger value="pending">بانتظار العينة</TabsTrigger><TabsTrigger value="in-progress">قيد المعالجة</TabsTrigger><TabsTrigger value="completed">مكتمل</TabsTrigger></TabsList>
          <Input placeholder="بحث..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          {loading ? <Loader2 className="animate-spin mx-auto my-10"/> : <> 
            <TabsContent value="all"><RequestTable data={filteredRequests} /></TabsContent>
            <TabsContent value="pending"><RequestTable data={filteredRequests.filter(r => r.status === 'pending')} /></TabsContent>
            <TabsContent value="in-progress"><RequestTable data={filteredRequests.filter(r => r.status === 'in-progress')} /></TabsContent>
            <TabsContent value="completed"><RequestTable data={filteredRequests.filter(r => r.status === 'completed')} /></TabsContent>
          </>}
        </Tabs>
      </div>

      <Dialog open={isResultDialogOpen} onOpenChange={setIsResultDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>إدخال النتائج - {selectedRequest?.patientName}</DialogTitle></DialogHeader>
          {editingResults.map((test, testIdx) => (
            <Card key={testIdx}>
              <CardContent className="p-4">
                <h3 className="font-bold">{test.name}</h3>
                {test.items && test.items.length > 0 ? test.items.map((item, itemIdx) => (
                  <div key={itemIdx} className="grid grid-cols-4 gap-2 items-center">
                    <Label>{item.name}</Label>
                    <Input placeholder="النتيجة" value={item.result || ''} onChange={e => handleResultChange(testIdx, 'result', e.target.value, itemIdx)} />
                    <Input placeholder="الوحدة" value={item.unit || ''} onChange={e => handleResultChange(testIdx, 'unit', e.target.value, itemIdx)} />
                    <span>{item.normalRange}</span>
                  </div>
                )) : <Input placeholder="النتيجة" value={test.result || ''} onChange={e => handleResultChange(testIdx, 'result', e.target.value)} />}
              </CardContent>
            </Card>
          ))}
          <DialogFooter><Button onClick={saveResults} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin"/> : 'حفظ'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
