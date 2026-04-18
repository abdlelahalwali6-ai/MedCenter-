/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, query, onSnapshot, orderBy, updateDoc, deleteDoc, doc, serverTimestamp, addDoc, getDocs, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { DataService } from '@/src/lib/dataService';
import { formatArabicDate, toDate } from '@/src/lib/dateUtils';
import { logAction } from '@/src/lib/audit';
import { LabRequest, LabTest, Patient, LabCatalogItem } from '@/src/types';
import { localDB } from '@/src/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Beaker,
  ClipboardList,
  AlertCircle,
  Plus,
  Settings,
  Layers,
  DollarSign,
  Printer,
  Barcode as BarcodeIcon,
  ScanLine
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/src/context/AuthContext';
import { BarcodeScanner } from '@/src/components/BarcodeScanner';
import Barcode from 'react-barcode';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Lab() {
  const { profile, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const patientIdFromUrl = searchParams.get('patientId');

  if (profile?.role === 'patient') return null;

  const requests = useLiveQuery(() => localDB.labRequests.reverse().toArray(), []) || [];
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<LabRequest | null>(null);
  const [isResultDialogOpen, setIsResultDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingResults, setEditingResults] = useState<LabTest[]>([]);
  const [catalog, setCatalog] = useState<LabCatalogItem[]>([]);
  const [isCatalogDialogOpen, setIsCatalogDialogOpen] = useState(false);
  const [editingCatalogItem, setEditingCatalogItem] = useState<Partial<LabCatalogItem> | null>(null);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [isSampleLabelOpen, setIsSampleLabelOpen] = useState(false);
  const [labelRequest, setLabelRequest] = useState<LabRequest | null>(null);
  const [printRequest, setPrintRequest] = useState<LabRequest | null>(null);
  const [isReportSettingsOpen, setIsReportSettingsOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<'search' | 'patient'>('search');
  const [hospitalSettings, setHospitalSettings] = useState({
    name: 'مجمع الشفاء الطبي',
    address: 'اليمن - صنعاء - شارع الستين',
    phone: '777-000-000',
    logo: ''
  });

  const [newRequest, setNewRequest] = useState({
    patientId: '',
    testIds: [] as string[]
  });

  useEffect(() => {
    if (!profile || profile.role === 'patient') return;

    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'clinic'));
        if (docSnap.exists()) {
          setHospitalSettings(docSnap.data() as any);
        }
      } catch (error) {
        console.error("Settings fetch error:", error);
      }
    };

    fetchSettings();
    
    const qPat = query(collection(db, 'patients'), orderBy('name', 'asc'));
    const unsubPat = onSnapshot(qPat, (snapshot) => {
      const patientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Patient[];
      setPatients(patientsData);
      
      if (patientIdFromUrl) {
        const patient = patientsData.find(p => p.id === patientIdFromUrl);
        if (patient) {
          setNewRequest(prev => ({ ...prev, patientId: patient.id }));
          setIsAddDialogOpen(true);
        }
      }
    });

    return () => { unsubPat(); };
  }, [profile, patientIdFromUrl]);

  useEffect(() => {
    if (!profile || profile.role === 'patient') return;
    const unsubCatalog = onSnapshot(collection(db, 'lab_catalog'), (snap) => {
      setCatalog(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LabCatalogItem[]);
    });
    return () => unsubCatalog();
  }, [profile]);

  const handleCreateRequest = async () => {
    const patient = patients.find(p => p.id === newRequest.patientId);
    if (!patient || newRequest.testIds.length === 0) {
      toast.error('يرجى اختيار المريض والتحاليل');
      return;
    }

    const selectedTests = catalog.filter(c => newRequest.testIds.includes(c.id));
    const totalPrice = selectedTests.reduce((acc, t) => acc + (t.price || 0), 0);

    try {
      const requestId = await DataService.create('labRequests', {
        patientId: patient.id,
        patientName: patient.name,
        doctorId: profile?.uid || '',
        doctorName: profile?.displayName || '',
        tests: selectedTests.map(t => ({ 
          name: t.name, 
          status: 'pending',
          items: t.items || [] 
        })),
        status: 'pending'
      });

      await logAction(
        profile,
        'إنشاء طلب مختبر',
        'lab',
        requestId,
        `طلب فحوصات للمريض: ${patient.name}`
      );

      // Create a bill for the lab tests
      if (totalPrice > 0) {
        await DataService.create('bills', {
          patientId: patient.id,
          patientName: patient.name,
          totalAmount: totalPrice,
          finalAmount: totalPrice,
          paidAmount: 0,
          description: `فحوصات مخبرية: ${selectedTests.map(t => t.name).join(', ')}`,
          status: 'pending',
          type: 'lab',
          items: selectedTests.map(t => ({
            description: t.name,
            amount: t.price || 0,
            quantity: 1
          }))
        });
      }

      toast.success('تم إنشاء طلب المختبر والفاتورة بنجاح');
      setIsAddDialogOpen(false);
      setNewRequest({ patientId: '', testIds: [] });
    } catch (error) {
      toast.error('فشل إنشاء الطلب');
    }
  };

  const handleSaveCatalogItem = async () => {
    if (!editingCatalogItem?.name) return;
    try {
      if (editingCatalogItem.id) {
        await updateDoc(doc(db, 'lab_catalog', editingCatalogItem.id), {
          ...editingCatalogItem,
          updatedAt: serverTimestamp()
        });
        toast.success('تم تحديث الفحص في القائمة');
      } else {
        await addDoc(collection(db, 'lab_catalog'), {
          ...editingCatalogItem,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast.success('تم إضافة الفحص للقائمة');
      }
      setIsCatalogDialogOpen(false);
    } catch (error) {
      toast.error('فشل حفظ البيانات');
    }
  };

  const handleDeleteCatalogItem = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الفحص من القائمة؟')) return;
    try {
      await deleteDoc(doc(db, 'lab_catalog', id));
      toast.success('تم الحذف بنجاح');
    } catch (error) {
      toast.error('فشل الحذف');
    }
  };

  const handleUpdateStatus = async (requestId: string, newStatus: string) => {
    try {
      await DataService.update('labRequests', requestId, {
        status: newStatus
      });
      toast.success('تم تحديث حالة الطلب');
    } catch (error) {
      toast.error('فشل تحديث الحالة');
    }
  };

  const openResultDialog = (request: LabRequest) => {
    setSelectedRequest(request);
    setEditingResults([...request.tests]);
    setIsResultDialogOpen(true);
  };

  const handleResultChange = (testIndex: number, field: string, value: string, itemIndex?: number) => {
    const newResults = [...editingResults];
    if (itemIndex !== undefined && newResults[testIndex].items) {
      const newItems = [...(newResults[testIndex].items || [])];
      newItems[itemIndex] = { ...newItems[itemIndex], [field]: value };
      newResults[testIndex] = { ...newResults[testIndex], items: newItems };
    } else {
      newResults[testIndex] = { ...newResults[testIndex], [field]: value };
    }
    setEditingResults(newResults);
  };

  const saveResults = async () => {
    if (!selectedRequest) return;

    try {
      const processedResults = editingResults.map(t => {
        let isCompleted = false;
        if (t.items && t.items.length > 0) {
          isCompleted = t.items.every(item => item.result && item.result.trim() !== '');
        } else {
          isCompleted = !!(t.result && t.result.trim() !== '');
        }
        return {
          ...t,
          status: isCompleted ? 'completed' : 'pending'
        };
      });

      const allCompleted = processedResults.every(t => t.status === 'completed');
      
      await DataService.update('labRequests', selectedRequest.id, {
        tests: processedResults,
        status: allCompleted ? 'completed' : 'in-progress',
        technicianId: profile?.uid,
        completedAt: allCompleted ? new Date() : null
      });

      await logAction(
        profile,
        'حفظ نتائج مخبرية',
        'lab',
        selectedRequest.id,
        `تم تحديث نتائج الفحوصات للمريض: ${selectedRequest.patientName}. الحالة: ${allCompleted ? 'مكتملة' : 'قيد التنفيذ'}`
      );

      toast.success('تم حفظ النتائج بنجاح');
      setIsResultDialogOpen(false);
    } catch (error) {
      toast.error('فشل حفظ النتائج');
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الطلب؟')) return;
    try {
      await DataService.delete('labRequests', id);
      toast.success('تم حذف الطلب');
    } catch (error) {
      toast.error('فشل حذف الطلب');
    }
  };

  const handleSaveSettings = async () => {
    try {
      await setDoc(doc(db, 'settings', 'clinic'), {
        ...hospitalSettings,
        updatedAt: serverTimestamp()
      });
      toast.success('تم حفظ إعدادات التقارير بنجاح');
      setIsReportSettingsOpen(false);
    } catch (error) {
      toast.error('فشل حفظ الإعدادات');
    }
  };

  const filteredRequests = requests.filter(req => 
    req.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.id.includes(searchTerm)
  );

  const handlePrint = (req: LabRequest) => {
    setPrintRequest(req);
    setIsPrintDialogOpen(true);
  };

  const handleOpenLabel = (req: LabRequest) => {
    setLabelRequest(req);
    setIsSampleLabelOpen(true);
  };

  const handleScan = (barcode: string) => {
    if (scannerMode === 'search') {
      setSearchTerm(barcode);
      const found = requests.find(r => r.id === barcode || r.id.endsWith(barcode));
      if (found) {
        toast.success(`تم العثور على الطلب: ${found.patientName}`);
      }
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

  const RequestTable = ({ data }: { data: LabRequest[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>المريض</TableHead>
          <TableHead>التحاليل المطلوبة</TableHead>
          <TableHead>الطبيب المعالج</TableHead>
          <TableHead>التاريخ</TableHead>
          <TableHead>الحالة</TableHead>
          <TableHead className="text-left">الإجراءات</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length > 0 ? data.map((req) => (
          <TableRow key={req.id} className="hover:bg-slate-50/50 transition-colors">
            <TableCell className="font-bold text-primary">{req.patientName}</TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {req.tests.map((t: any, i: number) => (
                  <span key={i} className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    t.status === 'completed' ? 'bg-success/10 text-success' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {t.name}
                  </span>
                ))}
              </div>
            </TableCell>
            <TableCell className="text-secondary">{req.doctorName}</TableCell>
            <TableCell className="text-secondary text-xs">{formatArabicDate(req.createdAt)}</TableCell>
            <TableCell>
              <span className={`px-2 py-1 rounded text-[0.7rem] font-bold flex items-center gap-1 w-fit ${
                req.status === 'completed' ? 'bg-success/10 text-success' : 
                req.status === 'pending' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'
              }`}>
                {req.status === 'completed' ? <CheckCircle2 size={12} /> : req.status === 'pending' ? <Clock size={12} /> : <Beaker size={12} />}
                {req.status === 'completed' ? 'مكتمل' : req.status === 'pending' ? 'بانتظار العينة' : 'قيد المعالجة'}
              </span>
            </TableCell>
            <TableCell className="text-left">
              <div className="flex justify-end gap-2">
                {req.status === 'pending' && (
                  <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(req.id, 'in-progress')} className="h-8 text-xs">بدء الفحص</Button>
                )}
                {(req.status === 'in-progress' || req.status === 'completed') && (
                  <Button variant="outline" size="sm" onClick={() => openResultDialog(req)} className="h-8 text-xs gap-1">
                    <Edit3 size={12} /> {req.status === 'completed' ? 'تعديل النتائج' : 'إدخال النتائج'}
                  </Button>
                )}
                {req.status === 'completed' && (
                  <Button variant="outline" size="sm" onClick={() => handlePrint(req)} className="h-8 text-xs gap-1 border-primary text-primary hover:bg-primary/10">
                    <Printer size={12} /> طباعة
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => handleOpenLabel(req)} className="h-8 text-xs gap-1" title="ملصق العينة">
                  <BarcodeIcon size={14} /> ملصق
                </Button>
                {isAdmin && (
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-danger hover:bg-danger/10" onClick={() => handleDeleteRequest(req.id)}>
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        )) : (
          <TableRow>
            <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
              <div className="flex flex-col items-center gap-2">
                <ClipboardList size={40} className="opacity-20" />
                <span>لا توجد طلبات مختبر حالياً</span>
              </div>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

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
          <FlaskConical className="text-primary" />
          إدارة المختبر والتحاليل
        </h1>
        <div className="flex gap-2">
          <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
            <Plus size={18} /> طلب فحص جديد
          </Button>
          <Button variant="outline" onClick={() => setIsReportSettingsOpen(true)} className="gap-2 border-primary text-primary hover:bg-primary/5">
            <Settings size={18} /> إعدادات التقارير
          </Button>
          <Button variant="outline" className="gap-2">
            <FileUp size={18} /> رفع ملفات خارجية
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-warning/5 border-warning/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-secondary font-medium">بانتظار العينة</p>
              <p className="text-2xl font-bold text-warning">{requests.filter(r => r.status === 'pending').length}</p>
            </div>
            <Clock className="text-warning" size={28} />
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-secondary font-medium">قيد المعالجة</p>
              <p className="text-2xl font-bold text-primary">{requests.filter(r => r.status === 'in-progress').length}</p>
            </div>
            <Beaker className="text-primary" size={28} />
          </CardContent>
        </Card>
        <Card className="bg-success/5 border-success/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-secondary font-medium">نتائج جاهزة</p>
              <p className="text-2xl font-bold text-success">{requests.filter(r => r.status === 'completed').length}</p>
            </div>
            <CheckCircle2 className="text-success" size={28} />
          </CardContent>
        </Card>
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-secondary font-medium">إجمالي الطلبات</p>
              <p className="text-2xl font-bold text-slate-700">{requests.length}</p>
            </div>
            <ClipboardList className="text-slate-400" size={28} />
          </CardContent>
        </Card>
      </div>

      <div className="panel">
        <Tabs defaultValue="all" className="w-full">
          <div className="p-4 border-b flex flex-col md:flex-row justify-between items-center gap-4">
          <TabsList className="bg-slate-100">
            <TabsTrigger value="all">الكل</TabsTrigger>
            <TabsTrigger value="pending">بانتظار العينة</TabsTrigger>
            <TabsTrigger value="in-progress">قيد المعالجة</TabsTrigger>
            <TabsTrigger value="completed">مكتمل</TabsTrigger>
            {isAdmin && <TabsTrigger value="catalog" className="gap-2"><Settings size={14} /> إدارة الفحوصات</TabsTrigger>}
          </TabsList>
            <div className="flex gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-72">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input 
                  placeholder="البحث عن مريض أو طلب..." 
                  className="pr-9 h-9 text-sm"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => { setScannerMode('search'); setIsScannerOpen(true); }}>
                <ScanLine size={16} />
              </Button>
            </div>
          </div>
          
          <TabsContent value="all" className="m-0">
            <RequestTable data={filteredRequests} />
          </TabsContent>
          <TabsContent value="pending" className="m-0">
            <RequestTable data={filteredRequests.filter(r => r.status === 'pending')} />
          </TabsContent>
          <TabsContent value="in-progress" className="m-0">
            <RequestTable data={filteredRequests.filter(r => r.status === 'in-progress')} />
          </TabsContent>
          <TabsContent value="completed" className="m-0">
            <RequestTable data={filteredRequests.filter(r => r.status === 'completed')} />
          </TabsContent>
          <TabsContent value="catalog" className="m-0 focus-visible:ring-0">
            <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center border-b bg-slate-50/50 gap-4">
              <div>
                <h3 className="font-bold text-base text-slate-800">قائمة الفحوصات المتاحة</h3>
                <p className="text-xs text-slate-500">إدارة الخدمات السعرية والبنود الفنية لكل فحص.</p>
              </div>
              <Button onClick={() => { setEditingCatalogItem({ name: '', category: '', price: 0, items: [] }); setIsCatalogDialogOpen(true); }} className="gap-2 shadow-sm">
                <Plus size={18} /> إضافة فحص جديد
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50 border-b-2">
                    <TableHead className="w-[30%]">اسم الفحص</TableHead>
                    <TableHead>التصنيف</TableHead>
                    <TableHead>السعر (ر.ي)</TableHead>
                    <TableHead>البنود الفنية</TableHead>
                    <TableHead className="text-left">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {catalog.length > 0 ? catalog.map((item) => (
                    <TableRow key={item.id} className="group hover:bg-primary/5 transition-colors">
                      <TableCell className="font-bold text-slate-700">{item.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal border-slate-200">
                          {item.category || 'غير مصنف'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono font-bold text-primary">{item.price?.toLocaleString()} ر.ي</TableCell>
                      <TableCell>
                        <span className="text-xs font-medium text-slate-500 bg-slate-100 py-1 px-2 rounded-full">
                          {item.items?.length || 0} بنود
                        </span>
                      </TableCell>
                      <TableCell className="text-left">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:text-primary transition-colors" onClick={() => { setEditingCatalogItem(item); setIsCatalogDialogOpen(true); }}>
                            <Edit3 size={15} />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-danger hover:bg-danger/10 transition-colors" onClick={() => handleDeleteCatalogItem(item.id)}>
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-slate-400">
                         لا توجد فحوصات مضافة حالياً. ابدأ بإضافة أول فحص للمركز.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Result Entry Dialog */}
      <Dialog open={isResultDialogOpen} onOpenChange={setIsResultDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="text-primary" />
              إدخال نتائج التحاليل - {selectedRequest?.patientName}
            </DialogTitle>
            <DialogDescription>
              يرجى إدخال القيم والوحدات لكل بند من بنود التحليل المطلوبة.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {editingResults.map((test, testIdx) => (
              <Card key={testIdx} className="border border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/80 py-3 border-b border-slate-100">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-base font-bold text-primary flex items-center gap-2">
                      <Beaker size={18} className="text-primary/70" /> {test.name}
                    </CardTitle>
                    <Badge variant={test.status === 'completed' ? 'default' : 'secondary'} className="text-[10px]">
                      {test.status === 'completed' ? 'جاهز' : 'طلب قيد الإدخال'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 bg-white">
                  {test.items && test.items.length > 0 ? (
                    <div className="space-y-4">
                      <div className="hidden md:grid grid-cols-12 gap-4 px-2 mb-2 font-bold text-xs text-slate-400 uppercase tracking-wider">
                        <div className="col-span-4">المعلم / البند</div>
                        <div className="col-span-3 text-center">النتيجة</div>
                        <div className="col-span-2 text-center">الوحدة</div>
                        <div className="col-span-3 text-center">المجال الطبيعي</div>
                      </div>
                      <div className="space-y-3">
                        {test.items.map((item, itemIdx) => (
                          <div key={itemIdx} className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-center p-3 md:p-1 rounded-lg hover:bg-slate-50/50 transition-colors border md:border-none border-slate-100">
                            <div className="col-span-4 flex items-center gap-2">
                               <div className="w-1.5 h-1.5 rounded-full bg-primary/30 hidden md:block"></div>
                               <span className="text-sm font-semibold md:font-medium text-slate-700">{item.name}</span>
                            </div>
                            <div className="col-span-3">
                              <Input 
                                type="text"
                                placeholder="النتيجة..."
                                value={item.result || ''} 
                                onChange={e => handleResultChange(testIdx, 'result', e.target.value, itemIdx)}
                                className="h-9 text-sm text-center border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary/20"
                              />
                            </div>
                            <div className="col-span-2">
                              <Input 
                                type="text"
                                placeholder="الوحدة"
                                value={item.unit || ''} 
                                onChange={e => handleResultChange(testIdx, 'unit', e.target.value, itemIdx)}
                                className="h-9 text-xs text-center font-mono border-slate-100 bg-slate-50/50"
                              />
                            </div>
                            <div className="col-span-3 flex items-center justify-center">
                              <Badge variant="outline" className="text-[11px] font-mono text-slate-400 border-slate-100 font-normal">
                                {item.normalRange || '-'}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                      <div className="col-span-4 space-y-1.5">
                        <Label className="text-xs text-slate-500 mr-1">المعلم الرئيسي</Label>
                        <div className="h-10 border border-slate-100 rounded-lg bg-slate-50 flex items-center px-3 text-sm font-medium">النتيجة العامة</div>
                      </div>
                      <div className="col-span-3 space-y-1.5">
                        <Label className="text-xs text-slate-500 mr-1">القيمة</Label>
                        <Input 
                          value={test.result || ''} 
                          onChange={e => handleResultChange(testIdx, 'result', e.target.value)}
                          className="h-10 text-center text-sm font-bold"
                          placeholder="أدخل القيمة"
                        />
                      </div>
                      <div className="col-span-2 space-y-1.5">
                        <Label className="text-xs text-slate-500 mr-1">الوحدة</Label>
                        <Input 
                          placeholder="مثلاً: mg/dl"
                          value={test.unit || ''} 
                          onChange={e => handleResultChange(testIdx, 'unit', e.target.value)}
                          className="h-10 text-center font-mono text-sm"
                        />
                      </div>
                      <div className="col-span-3 space-y-1.5">
                        <Label className="text-xs text-slate-500 mr-1">المجال الطبيعي</Label>
                        <Input 
                          placeholder="مثلاً: 70-110"
                          value={test.referenceRange || ''} 
                          onChange={e => handleResultChange(testIdx, 'referenceRange', e.target.value)}
                          className="h-10 text-center font-mono text-sm border-dashed"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:justify-start">
            <Button variant="secondary" onClick={() => setIsResultDialogOpen(false)} className="gap-1">
              <X size={16} /> إلغاء
            </Button>
            <Button onClick={saveResults} className="gap-1">
              <Save size={16} /> حفظ النتائج
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sample Label Dialog */}
      <Dialog open={isSampleLabelOpen} onOpenChange={setIsSampleLabelOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarcodeIcon className="text-primary" />
              ملصق عينة المختبر
            </DialogTitle>
          </DialogHeader>
          {labelRequest && (
            <div className="flex flex-col items-center py-6 gap-4 border rounded-xl bg-slate-50" id="sample-label">
              <div className="text-center">
                <h4 className="font-bold text-lg">{hospitalSettings.name}</h4>
                <p className="text-xs text-slate-500">قسم المختبر</p>
              </div>
              
              <div className="bg-white p-4 rounded shadow-sm border border-slate-200">
                <Barcode 
                  value={labelRequest.id} 
                  width={1.5} 
                  height={50} 
                  fontSize={12}
                  background="transparent"
                />
              </div>
              
              <div className="text-center space-y-1">
                <p className="font-bold text-sm">المريض: {labelRequest.patientName}</p>
                <div className="flex flex-wrap justify-center gap-1">
                  {labelRequest.tests.map((t, i) => (
                    <Badge key={i} variant="outline" className="text-[9px] h-4">{t.name}</Badge>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400">{new Date().toLocaleString('ar-SA')}</p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsSampleLabelOpen(false)} className="flex-1">إغلاق</Button>
            <Button onClick={() => {
              const printContent = document.getElementById('sample-label');
              const printWindow = window.open('', '_blank');
              if (printWindow && printContent) {
                printWindow.document.write(`
                  <html dir="rtl">
                    <head>
                      <title>Print Label</title>
                      <style>
                        body { font-family: system-ui; display: flex; justify-center: center; align-items: center; padding: 20px; text-align: center; }
                        .label { border: 1px solid #ccc; padding: 20px; width: 300px; display: inline-block; }
                        .badge { border: 1px solid #000; padding: 2px 5px; font-size: 10px; margin: 2px; display: inline-block; }
                      </style>
                    </head>
                    <body>
                      <div class="label">
                        ${printContent.innerHTML}
                      </div>
                      <script>window.print(); window.close();</script>
                    </body>
                  </html>
                `);
                printWindow.document.close();
              }
            }} className="flex-1 gap-2">
              <Printer size={16} /> طباعة الملصق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Lab Request Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="text-primary" />
              طلب فحص مخبري جديد
            </DialogTitle>
            <DialogDescription>
              يرجى اختيار المريض ونوع الفحوصات المطلوبة.
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
                <Button variant="outline" size="icon" onClick={() => { setScannerMode('patient'); setIsScannerOpen(true); }} title="مسح باركود المريض">
                  <ScanLine size={18} />
                </Button>
              </div>
            </div>

          <div className="space-y-2">
            <Label>الفحوصات المطلوبة</Label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded-md">
              {catalog.map(item => (
                <label key={item.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer border border-transparent hover:border-slate-200">
                  <input 
                    type="checkbox" 
                    checked={newRequest.testIds.includes(item.id)}
                    onChange={e => {
                      if (e.target.checked) {
                        setNewRequest({...newRequest, testIds: [...newRequest.testIds, item.id]});
                      } else {
                        setNewRequest({...newRequest, testIds: newRequest.testIds.filter(id => id !== item.id)});
                      }
                    }}
                    className="rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm">{item.name}</span>
                </label>
              ))}
            </div>
            {catalog.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">لا توجد فحوصات في القائمة، يرجى إضافتها من تبويب الإدارة.</p>}
          </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-start">
            <Button variant="secondary" onClick={() => setIsAddDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleCreateRequest}>إنشاء الطلب</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Catalog Item Dialog */}
      <Dialog open={isCatalogDialogOpen} onOpenChange={setIsCatalogDialogOpen}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              {editingCatalogItem?.id ? <Edit3 className="text-primary" /> : <Plus className="text-primary" />}
              {editingCatalogItem?.id ? 'تعديل فحص مخبري' : 'إضافة فحص جديد للقائمة'}
            </DialogTitle>
            <DialogDescription>أدخل البيانات الأساسية للفحص وبنوده التفصيلية التي ستظهر عند إدخال النتائج.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">اسم الفحص الرئيسي</Label>
                <div className="relative">
                  <Beaker className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <Input 
                    className="pr-10"
                    placeholder="مثل: CBC, Glucose, Kidney Profile"
                    value={editingCatalogItem?.name} 
                    onChange={e => setEditingCatalogItem({...editingCatalogItem, name: e.target.value})} 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">التصنيف / القسم</Label>
                <div className="relative">
                  <Layers className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <Input 
                    className="pr-10"
                    placeholder="مثل: دمويات، كيمياء حيوية، هرمونات"
                    value={editingCatalogItem?.category} 
                    onChange={e => setEditingCatalogItem({...editingCatalogItem, category: e.target.value})} 
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-semibold">سعر الخدمة (ر.ي)</Label>
              <div className="relative">
                <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <Input 
                  type="number" 
                  className="pr-10 font-bold text-primary"
                  placeholder="0.00"
                  value={editingCatalogItem?.price} 
                  onChange={e => setEditingCatalogItem({...editingCatalogItem, price: Number(e.target.value)})} 
                />
              </div>
            </div>

            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 px-2">
                  <ClipboardList size={18} className="text-primary" />
                  <Label className="text-sm font-bold">البنود الفنية للتحليل (Parameters)</Label>
                </div>
                <Button size="sm" variant="default" onClick={() => {
                  const items = [...(editingCatalogItem?.items || [])];
                  items.push({ name: '', unit: '', normalRange: '' });
                  setEditingCatalogItem({...editingCatalogItem, items});
                }} className="h-8 gap-1">
                  <Plus size={14} /> إضافة بند
                </Button>
              </div>

              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {editingCatalogItem?.items?.length === 0 ? (
                  <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-xs">
                    لم يتم إضافة بنود فرعية. سيتم طلب نتيجة عامة واحدة لهذا الفحص.
                  </div>
                ) : (
                  editingCatalogItem?.items?.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 p-2 bg-white rounded-lg border border-slate-100 shadow-sm relative group">
                      <div className="col-span-5 space-y-1">
                        <Label className="text-[10px] text-slate-400">اسم البند</Label>
                        <Input 
                          placeholder="مثلاً: Hemoglobin" 
                          className="h-8 text-xs font-medium" 
                          value={item.name} 
                          onChange={e => {
                            const items = [...(editingCatalogItem?.items || [])];
                            items[idx].name = e.target.value;
                            setEditingCatalogItem({...editingCatalogItem, items});
                          }} 
                        />
                      </div>
                      <div className="col-span-3 space-y-1">
                        <Label className="text-[10px] text-slate-400">الوحدة</Label>
                        <Input 
                          placeholder="g/dL" 
                          className="h-8 text-xs font-mono" 
                          value={item.unit} 
                          onChange={e => {
                            const items = [...(editingCatalogItem?.items || [])];
                            items[idx].unit = e.target.value;
                            setEditingCatalogItem({...editingCatalogItem, items});
                          }} 
                        />
                      </div>
                      <div className="col-span-3 space-y-1">
                        <Label className="text-[10px] text-slate-400">المجال الطبيعي</Label>
                        <Input 
                          placeholder="12.0 - 16.0" 
                          className="h-8 text-xs font-mono" 
                          value={item.normalRange} 
                          onChange={e => {
                            const items = [...(editingCatalogItem?.items || [])];
                            items[idx].normalRange = e.target.value;
                            setEditingCatalogItem({...editingCatalogItem, items});
                          }} 
                        />
                      </div>
                      <div className="col-span-1 pt-5">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0 text-danger hover:bg-danger/10" 
                          onClick={() => {
                            const items = (editingCatalogItem?.items || []).filter((_, i) => i !== idx);
                            setEditingCatalogItem({...editingCatalogItem, items});
                          }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-start pt-4 border-t">
            <Button variant="secondary" onClick={() => setIsCatalogDialogOpen(false)} className="gap-1">
              <X size={16} /> إلغاء
            </Button>
            <Button onClick={handleSaveCatalogItem} className="gap-1 px-8">
              <Save size={16} /> حفظ الفحص
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Preview Dialog */}
      <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0 border-none bg-slate-100" dir="rtl">
          <div className="p-4 border-b flex justify-between items-center bg-white sticky top-0 z-10 print:hidden">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Printer size={20} />
              </div>
              <div>
                <DialogTitle>معاينة الطباعة</DialogTitle>
                <DialogDescription>تأكد من النتائج وإعدادات الترويسة قبل الطباعة</DialogDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsReportSettingsOpen(true)} className="gap-2">
                <Settings size={16} /> تعديل الترويسة
              </Button>
              <Button onClick={() => window.print()} className="gap-2 shadow-lg shadow-primary/20">
                <Printer size={16} /> طباعة التقرير
              </Button>
              <Button variant="secondary" onClick={() => setIsPrintDialogOpen(false)}>إغلاق</Button>
            </div>
          </div>
          <div className="p-8 pb-20">
            {printRequest && (
              <LabReport 
                request={printRequest} 
                hospitalName={hospitalSettings.name}
                hospitalAddress={hospitalSettings.address}
                hospitalPhone={hospitalSettings.phone}
                hospitalLogo={hospitalSettings.logo}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Settings Dialog */}
      <Dialog open={isReportSettingsOpen} onOpenChange={setIsReportSettingsOpen}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="text-primary" />
              إعدادات ترويسة التقارير
            </DialogTitle>
            <DialogDescription>
              تعديل اسم المركز، الشعار، ومعلومات التواصل التي تظهر في أعلى التقارير المطبوعة.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>اسم المركز / المستشفى</Label>
                <Input 
                  value={hospitalSettings.name} 
                  onChange={e => setHospitalSettings({...hospitalSettings, name: e.target.value})}
                  placeholder="مثلاً: مجمع رعاية المختبرات الحديث"
                />
              </div>
              <div className="space-y-2">
                <Label>رابط الشعار (URL)</Label>
                <Input 
                  value={hospitalSettings.logo} 
                  onChange={e => setHospitalSettings({...hospitalSettings, logo: e.target.value})}
                  placeholder="https://example.com/logo.png"
                />
                <p className="text-[10px] text-muted-foreground italic">يمكنك استخدام رابط خارجي لشعار المركز.</p>
              </div>
              <div className="space-y-2">
                <Label>العنوان</Label>
                <Input 
                  value={hospitalSettings.address} 
                  onChange={e => setHospitalSettings({...hospitalSettings, address: e.target.value})}
                  placeholder="الدولة - المدينة - الشارع"
                />
              </div>
              <div className="space-y-2">
                <Label>رقم الهاتف / التواصل</Label>
                <Input 
                  value={hospitalSettings.phone} 
                  onChange={e => setHospitalSettings({...hospitalSettings, phone: e.target.value})}
                  placeholder="777 000 000"
                />
              </div>
            </div>

            <div className="space-y-4">
              <Label>معاينة الترويسة (Preview)</Label>
              <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50 min-h-[200px] flex flex-col items-center justify-center text-center">
                <div className="flex flex-col items-center gap-3">
                  {hospitalSettings.logo ? (
                    <img src={hospitalSettings.logo} alt="Logo" className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="bg-primary/10 p-4 rounded-xl text-primary">
                      <FlaskConical size={32} />
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold text-lg text-slate-800">{hospitalSettings.name}</h4>
                    <p className="text-xs text-slate-500">{hospitalSettings.address}</p>
                    <p className="text-xs text-slate-500">{hospitalSettings.phone}</p>
                  </div>
                </div>
                <div className="w-full border-t border-primary/20 mt-4 pt-2">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest">مثال لتقرير مخبري</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-start pt-4 border-t">
            <Button variant="outline" onClick={() => setIsReportSettingsOpen(false)}>إلغاء</Button>
            <Button onClick={handleSaveSettings} className="gap-2">
              <CheckCircle2 size={16} /> حفظ التعديلات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
