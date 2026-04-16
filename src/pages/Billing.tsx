/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, query, onSnapshot, orderBy, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { logAction } from '@/src/lib/audit';
import { Bill, Patient, ServiceCatalogItem, ServiceRequest, BillItem } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Search, Plus, FileText, Download, TrendingUp, Trash2, Printer, Wallet, Banknote, ClipboardList, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/src/context/AuthContext';

export default function Billing() {
  const { profile, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const patientIdFromUrl = searchParams.get('patientId');

  if (profile?.role === 'patient') return null;

  const [bills, setBills] = useState<Bill[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [servicesCatalog, setServicesCatalog] = useState<ServiceCatalogItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [reportRange, setReportRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [newBill, setNewBill] = useState({
    patientId: '',
    requestId: '',
    type: 'clinic' as Bill['type'],
    items: [{ description: '', amount: 0, quantity: 1 }] as BillItem[],
    discountAmount: 0,
    taxAmount: 0,
    paymentMethod: 'cash' as Bill['paymentMethod'],
    insuranceProvider: '',
    insuranceCoverage: 0
  });

  useEffect(() => {
    if (!profile || profile.role === 'patient') return;

    const q = query(collection(db, 'bills'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setBills(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Bill[]);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'bills'));

    const qPat = query(collection(db, 'patients'), orderBy('name', 'asc'));
    const unsubPat = onSnapshot(qPat, (snapshot) => {
      const patientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Patient[];
      setPatients(patientsData);
      
      if (patientIdFromUrl) {
        const patient = patientsData.find(p => p.id === patientIdFromUrl);
        if (patient) {
          setNewBill(prev => ({ ...prev, patientId: patient.id }));
          setIsAddDialogOpen(true);
        }
      }
    });

    const unsubRequests = onSnapshot(query(collection(db, 'service_requests'), orderBy('createdAt', 'desc')), (snap) => {
      setServiceRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ServiceRequest[]);
    });

    const unsubCatalog = onSnapshot(collection(db, 'services_catalog'), (snap) => {
      setServicesCatalog(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ServiceCatalogItem[]);
    });

    return () => { unsub(); unsubPat(); unsubRequests(); unsubCatalog(); };
  }, [profile, patientIdFromUrl]);

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    const patient = patients.find(p => p.id === newBill.patientId);
    if (!patient) return;

    const totalAmount = newBill.items.reduce((acc, item) => acc + (item.amount * item.quantity), 0);
    const insuranceDiscount = (totalAmount * (newBill.insuranceCoverage || 0)) / 100;
    const finalAmount = totalAmount + newBill.taxAmount - newBill.discountAmount - insuranceDiscount;

    try {
      const billRef = await addDoc(collection(db, 'bills'), {
        patientId: patient.id,
        patientName: patient.name,
        type: newBill.type,
        items: newBill.items,
        totalAmount,
        taxAmount: newBill.taxAmount,
        discountAmount: newBill.discountAmount + insuranceDiscount,
        finalAmount,
        paidAmount: 0,
        paymentMethod: newBill.paymentMethod,
        insuranceProvider: newBill.insuranceProvider,
        insuranceCoverage: newBill.insuranceCoverage,
        status: 'unpaid',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await logAction(
        profile,
        'إنشاء فاتورة',
        'bill',
        billRef.id,
        `تم إنشاء فاتورة للمريض: ${patient.name} بمبلغ ${finalAmount} ر.ي`
      );

      if (newBill.requestId) {
        await updateDoc(doc(db, 'service_requests', newBill.requestId), {
          billed: true,
          status: 'completed'
        });
      }

      toast.success('تم إنشاء الفاتورة بنجاح');
      setIsAddDialogOpen(false);
      setNewBill({ 
        patientId: '', 
        requestId: '',
        type: 'clinic',
        items: [{ description: '', amount: 0, quantity: 1 }], 
        discountAmount: 0,
        taxAmount: 0,
        paymentMethod: 'cash',
        insuranceProvider: '',
        insuranceCoverage: 0
      });
    } catch (error) {
      toast.error('فشل إنشاء الفاتورة');
    }
  };

  const handleCreateBillFromRequest = (req: ServiceRequest) => {
    setNewBill({
      patientId: req.patientId,
      requestId: req.id,
      type: 'clinic',
      items: [{ description: req.serviceName, amount: req.price, quantity: 1 }],
      discountAmount: 0,
      taxAmount: 0,
      paymentMethod: 'cash',
      insuranceProvider: '',
      insuranceCoverage: 0
    });
    setIsAddDialogOpen(true);
  };

  const addItem = () => {
    setNewBill({
      ...newBill,
      items: [...newBill.items, { description: '', amount: 0, quantity: 1 }]
    });
  };

  const removeItem = (index: number) => {
    const newItems = [...newBill.items];
    newItems.splice(index, 1);
    setNewBill({ ...newBill, items: newItems });
  };

  const updateItem = (index: number, field: keyof BillItem, value: any) => {
    const newItems = [...newBill.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setNewBill({ ...newBill, items: newItems });
  };

  const handlePayBill = async (billId: string, amount?: number) => {
    const bill = bills.find(b => b.id === billId);
    if (!bill) return;

    const currentPaid = bill.paidAmount || 0;
    const totalToPay = bill.finalAmount || bill.totalAmount;
    const payAmount = amount ?? (totalToPay - currentPaid);
    const newPaidAmount = currentPaid + payAmount;
    
    let status: Bill['status'] = 'partially-paid';
    if (newPaidAmount >= totalToPay) {
      status = 'paid';
    }

    try {
      await updateDoc(doc(db, 'bills', billId), {
        paidAmount: newPaidAmount,
        status: status,
        updatedAt: serverTimestamp()
      });

      await logAction(
        profile,
        'تسجيل دفع فاتورة',
        'bill',
        billId,
        `تم دفع مبلغ ${payAmount} ر.ي للفاتورة. الحالة الجديدة: ${status}`
      );

      toast.success('تم تسجيل الدفع بنجاح');
    } catch (error) {
      toast.error('فشل تسجيل الدفع');
    }
  };

  const handleCompleteRequest = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'service_requests', requestId), {
        status: 'completed'
      });
      toast.success('تم إكمال الخدمة');
    } catch (error) {
      toast.error('فشل تحديث الحالة');
    }
  };

  const handleDeleteBill = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) return;
    try {
      await deleteDoc(doc(db, 'bills', id));
      toast.success('تم حذف الفاتورة');
    } catch (error) {
      toast.error('فشل حذف الفاتورة');
    }
  };

  const handlePrint = (bill: Bill) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const content = `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 40px; border: 1px solid #eee; max-width: 800px; margin: auto;">
        <div style="text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px;">
          <h1 style="color: #3b82f6; margin: 0;">مركز مد كير الطبي</h1>
          <p style="color: #666;">فاتورة ضريبية مبسطة</p>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
          <div>
            <p><strong>رقم الفاتورة:</strong> ${bill.id.substring(0, 8)}</p>
            <p><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-SA')}</p>
          </div>
          <div style="text-align: left;">
            <p><strong>المريض:</strong> ${bill.patientName}</p>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr style="background-color: #f8fafc;">
              <th style="border: 1px solid #e2e8f0; padding: 12px; text-align: right;">الخدمة / الوصف</th>
              <th style="border: 1px solid #e2e8f0; padding: 12px; text-align: center;">الكمية</th>
              <th style="border: 1px solid #e2e8f0; padding: 12px; text-align: center;">السعر</th>
              <th style="border: 1px solid #e2e8f0; padding: 12px; text-align: center;">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${bill.items?.map(item => `
              <tr>
                <td style="border: 1px solid #e2e8f0; padding: 12px;">${item.description}</td>
                <td style="border: 1px solid #e2e8f0; padding: 12px; text-align: center;">${item.quantity}</td>
                <td style="border: 1px solid #e2e8f0; padding: 12px; text-align: center;">${item.amount.toLocaleString()}</td>
                <td style="border: 1px solid #e2e8f0; padding: 12px; text-align: center;">${(item.amount * item.quantity).toLocaleString()}</td>
              </tr>
            `).join('') || `
              <tr>
                <td style="border: 1px solid #e2e8f0; padding: 12px;">${bill.description}</td>
                <td style="border: 1px solid #e2e8f0; padding: 12px; text-align: center;">1</td>
                <td style="border: 1px solid #e2e8f0; padding: 12px; text-align: center;">${bill.totalAmount.toLocaleString()}</td>
                <td style="border: 1px solid #e2e8f0; padding: 12px; text-align: center;">${bill.totalAmount.toLocaleString()}</td>
              </tr>
            `}
          </tbody>
          <tfoot>
            <tr style="background-color: #f8fafc;">
              <td colspan="3" style="border: 1px solid #e2e8f0; padding: 12px; text-align: left;">الإجمالي</td>
              <td style="border: 1px solid #e2e8f0; padding: 12px; text-align: center;">${bill.totalAmount.toLocaleString()} ر.ي</td>
            </tr>
            ${bill.discountAmount > 0 ? `
            <tr style="background-color: #fff5f5;">
              <td colspan="3" style="border: 1px solid #e2e8f0; padding: 12px; text-align: left; color: #e53e3e;">الخصم</td>
              <td style="border: 1px solid #e2e8f0; padding: 12px; text-align: center; color: #e53e3e;">-${bill.discountAmount.toLocaleString()} ر.ي</td>
            </tr>
            ` : ''}
            <tr style="background-color: #f0f9ff; font-weight: bold;">
              <td colspan="3" style="border: 1px solid #e2e8f0; padding: 12px; text-align: left;">الصافي المطلوب</td>
              <td style="border: 1px solid #e2e8f0; padding: 12px; text-align: center; color: #0284c7;">${(bill.finalAmount || bill.totalAmount).toLocaleString()} ر.ي</td>
            </tr>
          </tfoot>
        </table>

        <div style="margin-top: 50px; display: flex; justify-content: space-between;">
          <div style="text-align: center;">
            <p>توقيع المحاسب</p>
            <div style="height: 60px;"></div>
            <p>_________________</p>
          </div>
          <div style="text-align: center;">
            <p>ختم المركز</p>
            <div style="height: 60px;"></div>
            <p>_________________</p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 50px; font-size: 12px; color: #999; border-top: 1px solid #eee; pt: 20px;">
          شكراً لثقتكم بنا - مركز مد كير الطبي
        </div>
      </div>
    `;

    printWindow.document.write(`
      <html>
        <head><title>فاتورة - ${bill.patientName}</title></head>
        <body onload="window.print();window.close()">${content}</body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredBills = bills.filter(bill => 
    bill.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bill.id.includes(searchTerm)
  );

  const totalRevenue = bills.filter(b => b.status === 'paid').reduce((acc, b) => acc + (b.finalAmount || b.totalAmount), 0);
  const pendingRevenue = bills.filter(b => b.status !== 'paid').reduce((acc, b) => acc + ((b.finalAmount || b.totalAmount) - (b.paidAmount || 0)), 0);

  const filteredReportBills = bills.filter(b => {
    if (!b.createdAt) return false;
    const date = b.createdAt.toDate();
    const start = new Date(reportRange.start);
    const end = new Date(reportRange.end);
    end.setHours(23, 59, 59, 999);
    return date >= start && date <= end;
  });

  const reportRevenue = filteredReportBills.filter(b => b.status === 'paid').reduce((acc, b) => acc + (b.finalAmount || b.totalAmount), 0);

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="text-primary" />
          النظام المالي والفواتير
        </h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger render={<Button className="gap-2" />}>
            <Plus size={18} /> إنشاء فاتورة جديدة
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>إنشاء فاتورة جديدة تفصيلية</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateBill} className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>المريض</Label>
                  <select 
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={newBill.patientId}
                    onChange={e => setNewBill({...newBill, patientId: e.target.value})}
                    required
                  >
                    <option value="">اختر المريض...</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>نوع الفاتورة</Label>
                  <select 
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={newBill.type}
                    onChange={e => setNewBill({...newBill, type: e.target.value as Bill['type']})}
                    required
                  >
                    <option value="clinic">عيادة</option>
                    <option value="pharmacy">صيدلية</option>
                    <option value="lab">مختبر</option>
                    <option value="radiology">أشعة</option>
                    <option value="other">أخرى</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-lg font-bold">بنود الفاتورة</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus size={14} className="ml-1" /> إضافة بند
                  </Button>
                </div>
                {newBill.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-end border p-3 rounded-lg bg-slate-50">
                    <div className="col-span-6 space-y-1">
                      <Label className="text-xs">الوصف</Label>
                      <Input 
                        value={item.description} 
                        onChange={e => updateItem(index, 'description', e.target.value)} 
                        placeholder="اسم الخدمة أو الدواء"
                        required 
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">السعر</Label>
                      <Input 
                        type="number" 
                        value={item.amount} 
                        onChange={e => updateItem(index, 'amount', parseFloat(e.target.value))} 
                        required 
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">الكمية</Label>
                      <Input 
                        type="number" 
                        value={item.quantity} 
                        onChange={e => updateItem(index, 'quantity', parseInt(e.target.value))} 
                        required 
                      />
                    </div>
                    <div className="col-span-1">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="text-danger"
                        onClick={() => removeItem(index)}
                        disabled={newBill.items.length === 1}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div className="space-y-2">
                  <Label>طريقة الدفع</Label>
                  <select 
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={newBill.paymentMethod}
                    onChange={e => setNewBill({...newBill, paymentMethod: e.target.value as Bill['paymentMethod']})}
                    required
                  >
                    <option value="cash">نقداً (Cash)</option>
                    <option value="card">بطاقة (Card)</option>
                    <option value="insurance">تأمين (Insurance)</option>
                    <option value="bank-transfer">تحويل بنكي (Transfer)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>الخصم المباشر (ر.ي)</Label>
                  <Input type="number" value={newBill.discountAmount} onChange={e => setNewBill({...newBill, discountAmount: parseFloat(e.target.value)})} />
                </div>
              </div>

              {newBill.paymentMethod === 'insurance' && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-sky-50 rounded-lg border border-sky-100">
                  <div className="space-y-2">
                    <Label>شركة التأمين</Label>
                    <Input value={newBill.insuranceProvider} onChange={e => setNewBill({...newBill, insuranceProvider: e.target.value})} placeholder="اسم الشركة" />
                  </div>
                  <div className="space-y-2">
                    <Label>نسبة التغطية (%)</Label>
                    <Input type="number" value={newBill.insuranceCoverage} onChange={e => setNewBill({...newBill, insuranceCoverage: parseFloat(e.target.value)})} />
                  </div>
                </div>
              )}

              <div className="bg-slate-100 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span>الإجمالي قبل الخصم:</span>
                  <span>{newBill.items.reduce((acc, item) => acc + (item.amount * item.quantity), 0).toLocaleString()} ر.ي</span>
                </div>
                <div className="flex justify-between text-sm text-danger">
                  <span>إجمالي الخصومات:</span>
                  <span>{(newBill.discountAmount + (newBill.items.reduce((acc, item) => acc + (item.amount * item.quantity), 0) * (newBill.insuranceCoverage || 0) / 100)).toLocaleString()} ر.ي</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2 text-primary">
                  <span>المبلغ النهائي:</span>
                  <span>{(newBill.items.reduce((acc, item) => acc + (item.amount * item.quantity), 0) - newBill.discountAmount - (newBill.items.reduce((acc, item) => acc + (item.amount * item.quantity), 0) * (newBill.insuranceCoverage || 0) / 100)).toLocaleString()} ر.ي</span>
                </div>
              </div>

              <Button type="submit" className="w-full h-12 text-lg">إصدار الفاتورة</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-500 rounded-full text-white">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-sm text-emerald-700 font-medium">إجمالي الإيرادات</p>
              <p className="text-2xl font-bold text-emerald-900">{totalRevenue.toLocaleString()} ر.ي</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-amber-500 rounded-full text-white">
              <Wallet size={24} />
            </div>
            <div>
              <p className="text-sm text-amber-700 font-medium">فواتير معلقة</p>
              <p className="text-2xl font-bold text-amber-900">{pendingRevenue.toLocaleString()} ر.ي</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-sky-50 border-sky-200">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-sky-500 rounded-full text-white">
              <ClipboardList size={24} />
            </div>
            <div>
              <p className="text-sm text-sky-700 font-medium">طلبات الخدمات</p>
              <p className="text-2xl font-bold text-sky-900">{serviceRequests.filter(r => r.status === 'pending').length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-slate-500 rounded-full text-white">
              <Banknote size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-700 font-medium">متوسط الفاتورة</p>
              <p className="text-2xl font-bold text-slate-900">
                {(bills.length > 0 ? Math.round(totalRevenue / bills.length) : 0).toLocaleString()} ر.ي
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="bills" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-12">
          <TabsTrigger value="bills" className="gap-2">
            <FileText size={18} /> الفواتير المالية
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2">
            <ClipboardList size={18} /> طلبات الخدمات
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <TrendingUp size={18} /> التقارير المالية
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bills" className="space-y-4 mt-6">
          <div className="panel">
            <div className="p-4 border-b flex justify-between items-center">
              <div className="relative max-w-md flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input 
                  placeholder="البحث برقم الفاتورة أو اسم المريض..." 
                  className="pr-10"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المريض</TableHead>
                  <TableHead>المصدر</TableHead>
                  <TableHead>المبلغ الإجمالي</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="text-left">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBills.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-bold">{inv.patientName}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-[0.65rem] font-bold ${
                        inv.type === 'pharmacy' ? 'bg-emerald-100 text-emerald-700' :
                        inv.type === 'lab' ? 'bg-sky-100 text-sky-700' :
                        inv.type === 'radiology' ? 'bg-purple-100 text-purple-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {inv.type === 'pharmacy' ? 'صيدلية' :
                         inv.type === 'lab' ? 'مختبر' :
                         inv.type === 'radiology' ? 'أشعة' : 'عيادة'}
                      </span>
                    </TableCell>
                    <TableCell className="font-bold text-primary">{(inv.finalAmount || inv.totalAmount).toLocaleString()} ر.ي</TableCell>
                    <TableCell>{inv.createdAt?.toDate().toLocaleDateString('ar-SA')}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-[0.7rem] font-bold ${
                        inv.status === 'paid' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                      }`}>
                        {inv.status === 'paid' ? 'مدفوعة' : 'معلقة'}
                      </span>
                    </TableCell>
                    <TableCell className="text-left">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedBill(inv)}>
                          <FileText size={16} />
                        </Button>
                        {inv.status === 'unpaid' && (
                          <Button variant="outline" size="sm" onClick={() => handlePayBill(inv.id)}>تسجيل الدفع</Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handlePrint(inv)}>
                          <Printer size={16} />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Download size={16} />
                        </Button>
                        {isAdmin && (
                          <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleDeleteBill(inv.id)}>
                            <Trash2 size={16} />
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

        <TabsContent value="requests" className="mt-6">
          <div className="panel">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المريض</TableHead>
                  <TableHead>الخدمة المطلوبة</TableHead>
                  <TableHead>الطبيب</TableHead>
                  <TableHead>السعر</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="text-left">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serviceRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-bold">{req.patientName}</TableCell>
                    <TableCell>{req.serviceName}</TableCell>
                    <TableCell className="text-xs">{req.doctorName}</TableCell>
                    <TableCell className="font-bold text-primary">{req.price.toLocaleString()} ر.ي</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-[0.7rem] font-bold ${
                        req.status === 'completed' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                      }`}>
                        {req.status === 'completed' ? 'مكتملة' : 'بانتظار التنفيذ'}
                      </span>
                    </TableCell>
                    <TableCell className="text-left">
                      <div className="flex justify-end gap-2">
                        {!req.billed && (
                          <Button variant="outline" size="sm" onClick={() => handleCreateBillFromRequest(req)}>
                            <Banknote size={14} className="ml-1" /> إصدار فاتورة
                          </Button>
                        )}
                        {req.status === 'pending' && (
                          <Button variant="outline" size="sm" onClick={() => handleCompleteRequest(req.id)}>
                            <CheckCircle size={14} className="ml-1" /> تم التنفيذ
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {serviceRequests.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      لا توجد طلبات خدمات حالياً
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="reports" className="mt-6 space-y-6">
          <Card>
            <CardContent className="p-4 flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <Label className="text-xs">من تاريخ</Label>
                <Input type="date" value={reportRange.start} onChange={e => setReportRange({...reportRange, start: e.target.value})} className="w-40" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">إلى تاريخ</Label>
                <Input type="date" value={reportRange.end} onChange={e => setReportRange({...reportRange, end: e.target.value})} className="w-40" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm text-muted-foreground">إجمالي إيرادات الفترة المختارة</p>
                <p className="text-2xl font-bold text-primary">{reportRevenue.toLocaleString()} ر.ي</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">الإيرادات حسب المصدر</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { label: 'العيادة', type: 'clinic', color: 'bg-slate-500' },
                    { label: 'الصيدلية', type: 'pharmacy', color: 'bg-emerald-500' },
                    { label: 'المختبر', type: 'lab', color: 'bg-sky-500' },
                    { label: 'الأشعة', type: 'radiology', color: 'bg-purple-500' },
                  ].map(source => {
                    const amount = filteredReportBills
                      .filter(b => b.status === 'paid' && (b.type === source.type || (!b.type && source.type === 'clinic')))
                      .reduce((acc, b) => acc + (b.finalAmount || b.totalAmount), 0);
                    const percentage = reportRevenue > 0 ? (amount / reportRevenue) * 100 : 0;
                    
                    return (
                      <div key={source.type} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{source.label}</span>
                          <span className="font-bold">{amount.toLocaleString()} ر.ي ({percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`${source.color} h-full transition-all duration-500`} 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">طرق الدفع المستخدمة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { label: 'نقداً', method: 'cash', color: 'bg-emerald-500' },
                    { label: 'بطاقة', method: 'card', color: 'bg-blue-500' },
                    { label: 'تأمين', method: 'insurance', color: 'bg-sky-500' },
                    { label: 'تحويل', method: 'bank-transfer', color: 'bg-amber-500' },
                  ].map(pm => {
                    const count = filteredReportBills.filter(b => b.paymentMethod === pm.method).length;
                    const amount = filteredReportBills
                      .filter(b => b.status === 'paid' && b.paymentMethod === pm.method)
                      .reduce((acc, b) => acc + (b.finalAmount || b.totalAmount), 0);
                    const percentage = reportRevenue > 0 ? (amount / reportRevenue) * 100 : 0;

                    return (
                      <div key={pm.method} className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${pm.color}`} />
                        <div className="flex-1">
                          <div className="flex justify-between text-sm">
                            <span>{pm.label} ({count} فاتورة)</span>
                            <span className="font-bold">{amount.toLocaleString()} ر.ي</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Bill Details Dialog */}
      <Dialog open={!!selectedBill} onOpenChange={() => setSelectedBill(null)}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>تفاصيل الفاتورة</DialogTitle>
          </DialogHeader>
          {selectedBill && (
            <div className="space-y-6 py-4">
              <div className="flex justify-between items-start border-b pb-4">
                <div>
                  <p className="text-sm text-muted-foreground">المريض</p>
                  <p className="text-lg font-bold">{selectedBill.patientName}</p>
                </div>
                <div className="text-left">
                  <p className="text-sm text-muted-foreground">رقم الفاتورة</p>
                  <p className="font-mono text-xs">{selectedBill.id}</p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="font-bold">البنود والخدمات:</p>
                <div className="space-y-2">
                  {selectedBill.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm p-2 bg-slate-50 rounded">
                      <span>{item.description} (x{item.quantity})</span>
                      <span className="font-bold">{(item.amount * item.quantity).toLocaleString()} ر.ي</span>
                    </div>
                  )) || (
                    <div className="p-2 bg-slate-50 rounded">
                      <span>{selectedBill.description}</span>
                      <span className="float-left font-bold">{selectedBill.totalAmount.toLocaleString()} ر.ي</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <div className="flex justify-between text-sm">
                  <span>الإجمالي:</span>
                  <span>{selectedBill.totalAmount.toLocaleString()} ر.ي</span>
                </div>
                {selectedBill.discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-danger">
                    <span>الخصم:</span>
                    <span>-{selectedBill.discountAmount.toLocaleString()} ر.ي</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold text-primary pt-2 border-t">
                  <span>المبلغ النهائي:</span>
                  <span>{(selectedBill.finalAmount || selectedBill.totalAmount).toLocaleString()} ر.ي</span>
                </div>
                <div className="flex justify-between text-sm text-success">
                  <span>المبلغ المدفوع:</span>
                  <span>{(selectedBill.paidAmount || 0).toLocaleString()} ر.ي</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-amber-600">
                  <span>المتبقي:</span>
                  <span>{((selectedBill.finalAmount || selectedBill.totalAmount) - (selectedBill.paidAmount || 0)).toLocaleString()} ر.ي</span>
                </div>
              </div>

              {selectedBill.status !== 'paid' && (
                <div className="space-y-2 p-4 bg-slate-50 rounded-lg border">
                  <Label>تسجيل دفعة جديدة</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="number" 
                      value={paymentAmount} 
                      onChange={e => setPaymentAmount(parseFloat(e.target.value))}
                      placeholder="المبلغ"
                    />
                    <Button onClick={() => {
                      handlePayBill(selectedBill.id, paymentAmount);
                      setSelectedBill(null);
                      setPaymentAmount(0);
                    }}>
                      تأكيد الدفع
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button className="flex-1 gap-2" onClick={() => handlePrint(selectedBill)}>
                  <Printer size={18} /> طباعة الفاتورة
                </Button>
                {selectedBill.status !== 'paid' && (
                  <Button variant="outline" className="flex-1" onClick={() => {
                    handlePayBill(selectedBill.id);
                    setSelectedBill(null);
                  }}>
                    دفع الكل
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
