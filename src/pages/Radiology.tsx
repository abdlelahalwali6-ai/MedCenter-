/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { DataService } from '@/src/lib/dataService';
import { formatArabicDate } from '@/src/lib/dateUtils';
import { logAction } from '@/src/lib/audit';
import { RadiologyRequest, Patient, ServiceCatalogItem } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Image as ImageIcon, Search, CheckCircle2, AlertCircle, Trash2, Plus, Settings, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/src/context/AuthContext';
import { Badge } from '@/components/ui/badge';

export default function Radiology() {
  const { profile, isAdmin } = useAuth();

  if (profile?.role === 'patient') return null;

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<RadiologyRequest[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [catalog, setCatalog] = useState<ServiceCatalogItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newRequest, setNewRequest] = useState({ patientId: '', type: '' });

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    const unsubs: (()=>void)[] = [];

    unsubs.push(onSnapshot(query(collection(db, 'radiology_requests'), orderBy('createdAt', 'desc')), 
      (snap) => { setRequests(snap.docs.map(d => ({id: d.id, ...d.data()})) as RadiologyRequest[]); setLoading(false); },
      (err) => { handleFirestoreError(err, OperationType.LIST, 'radiology requests'); setLoading(false); }
    ));

    unsubs.push(onSnapshot(query(collection(db, 'patients'), orderBy('name', 'asc')), 
      (snap) => setPatients(snap.docs.map(d => ({id: d.id, ...d.data()})) as Patient[])
    ));

    unsubs.push(onSnapshot(query(collection(db, 'radiology_catalog')), 
      (snap) => setCatalog(snap.docs.map(d => ({id: d.id, ...d.data()})) as ServiceCatalogItem[])
    ));

    return () => unsubs.forEach(unsub => unsub());
  }, [profile]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await DataService.create('radiology_requests', newRequest);
      toast.success('تم إنشاء طلب الأشعة');
      setIsAddDialogOpen(false);
      setNewRequest({ patientId: '', type: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'radiology request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (requestId: string, newStatus: string) => {
    try {
      await DataService.update('radiology_requests', requestId, { status: newStatus });
      toast.success('تم تحديث الحالة');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'radiology request');
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!window.confirm('هل أنت متأكد؟')) return;
    try {
      await DataService.delete('radiology_requests', id);
      toast.success('تم حذف الطلب');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'radiology request');
    }
  };

  const filteredRequests = requests.filter(req => 
    (req.patientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (req.type || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const RequestTable = ({ data }: { data: RadiologyRequest[] }) => (
    <Table>
        <TableHeader><TableRow><TableHead>المريض</TableHead><TableHead>نوع الفحص</TableHead><TableHead>التاريخ</TableHead><TableHead>الحالة</TableHead><TableHead>إجراء</TableHead></TableRow></TableHeader>
        <TableBody>
            {data.map(req => (
                <TableRow key={req.id}>
                    <TableCell>{req.patientName}</TableCell>
                    <TableCell>{req.type}</TableCell>
                    <TableCell>{formatArabicDate(req.createdAt)}</TableCell>
                    <TableCell><Badge variant={req.status === 'completed' ? 'success' : (req.status === 'pending' ? 'warning' : 'default')}>{req.status}</Badge></TableCell>
                    <TableCell>
                        {req.status === 'pending' && <Button size="sm" onClick={() => handleUpdateStatus(req.id, 'in-progress')}>بدء الفحص</Button>}
                        {req.status === 'in-progress' && <Button size="sm" onClick={() => handleUpdateStatus(req.id, 'completed')}>إكمال</Button>}
                    </TableCell>
                </TableRow>
            ))}
            {data.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-10">لا توجد طلبات</TableCell></TableRow>}
        </TableBody>
    </Table>
  )

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">قسم الأشعة</h1>
        <Button onClick={() => setIsAddDialogOpen(true)}><Plus size={18} /> طلب جديد</Button>
      </div>

       <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="p-4"><p>طلبات جديدة</p><p className="text-2xl font-bold">{requests.filter(r => r.status === 'pending').length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p>قيد الفحص</p><p className="text-2xl font-bold">{requests.filter(r => r.status === 'in-progress').length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p>تقارير منجزة</p><p className="text-2xl font-bold">{requests.filter(r => r.status === 'completed').length}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="requests">
        <TabsList><TabsTrigger value="requests">الطلبات</TabsTrigger><TabsTrigger value="catalog">إدارة الأنواع</TabsTrigger></TabsList>
        <TabsContent value="requests" className="mt-4">
            <Input placeholder="بحث..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            {loading ? <Loader2 className="animate-spin mx-auto my-10"/> : <> 
                <RequestTable data={filteredRequests}/>
            </>}
        </TabsContent>
        <TabsContent value="catalog" className="mt-4">{/* Catalog management UI here */}</TabsContent>
      </Tabs>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>طلب أشعة جديد</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateRequest} className="space-y-4 py-4">
              {/* Simplified form */}
              <p>محتوى نموذج الطلب هنا...</p>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin"/> : 'إنشاء'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
