/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, updateDoc, deleteDoc, doc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { logAction } from '@/src/lib/audit';
import { RadiologyRequest, Patient } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Image as ImageIcon, Search, Monitor, CheckCircle2, AlertCircle, Trash2, Plus, Settings, Edit, ClipboardList, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/src/context/AuthContext';
import { BarcodeScanner } from '@/src/components/BarcodeScanner';

export default function Radiology() {
  const { profile, isAdmin } = useAuth();

  if (profile?.role === 'patient') return null;

  const [requests, setRequests] = useState<RadiologyRequest[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCatalogDialogOpen, setIsCatalogDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [newItem, setNewItem] = useState({ name: '', category: 'X-Ray', price: 0 });
  const [newRequest, setNewRequest] = useState({ patientId: '', typeId: '' });
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<'search' | 'patient'>('search');

  useEffect(() => {
    if (!profile || profile.role === 'patient') return;

    const q = query(collection(db, 'radiology_requests'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RadiologyRequest[]);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'radiology_requests'));

    const qCat = query(collection(db, 'radiology_catalog'), orderBy('name', 'asc'));
    const unsubCat = onSnapshot(qCat, (snapshot) => {
      setCatalog(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qPat = query(collection(db, 'patients'), orderBy('name', 'asc'));
    const unsubPat = onSnapshot(qPat, (snapshot) => {
      setPatients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Patient[]);
    });

    return () => { unsub(); unsubCat(); unsubPat(); };
  }, [profile]);

  const handleAddCatalogItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'radiology_catalog'), { ...newItem, createdAt: serverTimestamp() });
      toast.success('تم إضافة نوع الأشعة');
      setIsCatalogDialogOpen(false);
      setNewItem({ name: '', category: 'X-Ray', price: 0 });
    } catch (error) {
      toast.error('فشل الإضافة');
    }
  };

  const handleUpdateCatalogItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      await updateDoc(doc(db, 'radiology_catalog', editingItem.id), { ...editingItem, updatedAt: serverTimestamp() });
      toast.success('تم التحديث');
      setEditingItem(null);
    } catch (error) {
      toast.error('فشل التحديث');
    }
  };

  const handleDeleteCatalogItem = async (id: string) => {
    if (!window.confirm('هل أنت متأكد؟')) return;
    try {
      await deleteDoc(doc(db, 'radiology_catalog', id));
      toast.success('تم الحذف');
    } catch (error) {
      toast.error('فشل الحذف');
    }
  };

  const handleCreateRequest = async () => {
    const patient = patients.find(p => p.id === newRequest.patientId);
    const type = catalog.find(c => c.id === newRequest.typeId);
    
    if (!patient || !type) {
      toast.error('يرجى اختيار المريض ونوع الفحص');
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'radiology_requests'), {
        patientId: patient.id,
        patientName: patient.name,
        doctorId: profile?.uid || '',
        doctorName: profile?.displayName || '',
        type: type.name,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      await logAction(
        profile,
        'إنشاء طلب أشعة',
        'radiology',
        docRef.id,
        `طلب أشعة (${type.name}) للمريض: ${patient.name}`
      );

      // Create a bill
      if (type.price > 0) {
        await addDoc(collection(db, 'bills'), {
          patientId: patient.id,
          patientName: patient.name,
          amount: type.price,
          description: `أشعة: ${type.name}`,
          status: 'pending',
          type: 'radiology',
          createdAt: serverTimestamp()
        });
      }

      toast.success('تم إنشاء طلب الأشعة والفاتورة بنجاح');
      setIsAddDialogOpen(false);
      setNewRequest({ patientId: '', typeId: '' });
    } catch (error) {
      toast.error('فشل إنشاء الطلب');
    }
  };
  const handleUpdateStatus = async (requestId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'radiology_requests', requestId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });

      await logAction(
        profile,
        'تحديث حالة طلب أشعة',
        'radiology',
        requestId,
        `تم تحديث حالة الطلب إلى: ${newStatus}`
      );

      toast.success('تم تحديث حالة الطلب');
    } catch (error) {
      toast.error('فشل تحديث الحالة');
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الطلب؟')) return;
    try {
      await deleteDoc(doc(db, 'radiology_requests', id));
      toast.success('تم حذف الطلب');
    } catch (error) {
      toast.error('فشل حذف الطلب');
    }
  };

  const filteredRequests = requests.filter(req => 
    req.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.id.includes(searchTerm)
  );

  const handleScan = (barcode: string) => {
    if (scannerMode === 'search') {
      setSearchTerm(barcode);
    } else if (scannerMode === 'patient') {
      const patient = patients.find(p => p.mrn === barcode || p.id === barcode || p.phone === barcode);
      if (patient) {
        setNewRequest(prev => ({ ...prev, patientId: patient.id }));
        toast.success(`تم اختيار المريض: ${patient.name}`);
      } else {
        toast.error('لم يتم العثور على المريض');
      }
    }
    setIsScannerOpen(false);
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {isScannerOpen && (
        <BarcodeScanner 
          onScan={handleScan} 
          onClose={() => setIsScannerOpen(false)} 
          title={scannerMode === 'search' ? "مسح باركود الطلب" : "مسح باركود المريض (MRN)"}
        />
      )}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ImageIcon className="text-primary" />
          قسم الأشعة والتصوير الطبي
        </h1>
        <div className="flex gap-2">
          <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
            <Plus size={18} /> طلب أشعة جديد
          </Button>
          <Button variant="outline" className="gap-2 bg-primary text-white hover:bg-primary/90">
            <Monitor size={18} /> فتح نظام PACS
          </Button>
        </div>
      </div>

      <Tabs defaultValue="requests" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12">
          <TabsTrigger value="requests" className="gap-2">
            <ClipboardList size={18} /> طلبات الأشعة
          </TabsTrigger>
          <TabsTrigger value="catalog" className="gap-2">
            <Settings size={18} /> إدارة أنواع الأشعة
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-r-4 border-r-danger">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">طلبات طارئة</p>
                  <p className="text-2xl font-bold text-danger">
                    {requests.filter(r => r.status === 'pending').length}
                  </p>
                </div>
                <AlertCircle className="text-danger" size={32} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">طلبات قيد الفحص</p>
                  <p className="text-2xl font-bold">{requests.filter(r => r.status === 'in-progress').length}</p>
                </div>
                <ImageIcon className="text-primary" size={32} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">تقارير منجزة</p>
                  <p className="text-2xl font-bold">{requests.filter(r => r.status === 'completed').length}</p>
                </div>
                <CheckCircle2 className="text-success" size={32} />
              </CardContent>
            </Card>
          </div>

          <div className="panel">
            <div className="p-4 border-b flex justify-between items-center gap-4">
              <div className="relative max-w-md flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input 
                  placeholder="البحث عن مريض أو فحص..." 
                  className="pr-10"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon" onClick={() => { setScannerMode('search'); setIsScannerOpen(true); }}>
                <ScanLine size={18} />
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المريض</TableHead>
                  <TableHead>نوع الفحص</TableHead>
                  <TableHead>الطبيب المحول</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="text-left">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-bold">{req.patientName}</TableCell>
                    <TableCell>{req.type}</TableCell>
                    <TableCell>{req.doctorName}</TableCell>
                    <TableCell>{req.createdAt?.toDate().toLocaleDateString('ar-SA')}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-[0.7rem] font-bold ${
                        req.status === 'completed' ? 'bg-success/10 text-success' : 
                        req.status === 'pending' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'
                      }`}>
                        {req.status === 'completed' ? 'مكتمل' : req.status === 'pending' ? 'بانتظار الفحص' : 'قيد الفحص'}
                      </span>
                    </TableCell>
                    <TableCell className="text-left">
                      <div className="flex justify-end gap-2">
                        {req.status === 'pending' && (
                          <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(req.id, 'in-progress')}>بدء التصوير</Button>
                        )}
                        {req.status === 'in-progress' && (
                          <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(req.id, 'completed')}>كتابة التقرير</Button>
                        )}
                        {isAdmin && (
                          <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleDeleteRequest(req.id)}>
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="catalog" className="space-y-6 mt-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold">دليل أنواع الأشعة والتسعيرة</h2>
            <Dialog open={isCatalogDialogOpen} onOpenChange={setIsCatalogDialogOpen}>
              <DialogTrigger render={<Button className="gap-2" />}>
                <Plus size={18} /> إضافة نوع جديد
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]" dir="rtl">
                <DialogHeader>
                  <DialogTitle>إضافة نوع أشعة جديد</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddCatalogItem} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>اسم الفحص</Label>
                    <Input value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>الفئة</Label>
                    <select 
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={newItem.category}
                      onChange={e => setNewItem({...newItem, category: e.target.value})}
                    >
                      <option value="X-Ray">X-Ray (أشعة سينية)</option>
                      <option value="Ultrasound">Ultrasound (تلفزيونية)</option>
                      <option value="CT Scan">CT Scan (مقطعية)</option>
                      <option value="MRI">MRI (رنين مغناطيسي)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>السعر (ر.ي)</Label>
                    <Input type="number" value={newItem.price} onChange={e => setNewItem({...newItem, price: parseInt(e.target.value)})} required />
                  </div>
                  <Button type="submit" className="w-full">حفظ</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="panel">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم الفحص</TableHead>
                  <TableHead>الفئة</TableHead>
                  <TableHead>السعر</TableHead>
                  <TableHead className="text-left">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {catalog.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-bold">{item.name}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell className="font-bold text-primary">{item.price} ر.ي</TableCell>
                    <TableCell className="text-left">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditingItem(item)}>
                          <Edit size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleDeleteCatalogItem(item.id)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Catalog Dialog */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="sm:max-w-[425px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل بيانات الفحص</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <form onSubmit={handleUpdateCatalogItem} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>اسم الفحص</Label>
                <Input value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>السعر (ر.ي)</Label>
                <Input type="number" value={editingItem.price} onChange={e => setEditingItem({...editingItem, price: parseInt(e.target.value)})} required />
              </div>
              <Button type="submit" className="w-full">تحديث</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      {/* New Radiology Request Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="text-primary" />
              طلب أشعة جديد
            </DialogTitle>
            <DialogDescription>
              يرجى اختيار المريض ونوع الفحص المطلوب.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>المريض</Label>
              <div className="flex gap-2">
                <Select 
                  value={newRequest.patientId} 
                  onValueChange={val => setNewRequest({...newRequest, patientId: val})}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="اختر المريض" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={() => { setScannerMode('patient'); setIsScannerOpen(true); }}>
                  <ScanLine size={18} />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>نوع الفحص</Label>
              <Select 
                value={newRequest.typeId} 
                onValueChange={val => setNewRequest({...newRequest, typeId: val})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر نوع الفحص" />
                </SelectTrigger>
                <SelectContent>
                  {catalog.map(item => (
                    <SelectItem key={item.id} value={item.id}>{item.name} ({item.price} ر.ي)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-start">
            <Button variant="secondary" onClick={() => setIsAddDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleCreateRequest}>إنشاء الطلب</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
