/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, updateDoc, deleteDoc, doc, serverTimestamp, where, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { formatArabicDate } from '@/src/lib/dateUtils';
import { localDB } from '@/src/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { logAction } from '@/src/lib/audit';
import { InventoryItem, Prescription } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter 
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Search, PackagePlus, AlertTriangle, Pill, CheckCircle, ClipboardList, Edit, Trash2, Barcode as BarcodeIcon, ScanLine, Filter, Download, X, Printer, DollarSign, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/src/context/AuthContext';
import { BarcodeScanner } from '@/src/components/BarcodeScanner';
import { Badge } from '@/components/ui/badge';
import Barcode from 'react-barcode';

const COMMON_DRUGS = [
  { name: 'بندول اكسترا', scientificName: 'Paracetamol + Caffeine', commercialName: 'Panadol Extra', category: 'medication', price: 1200, unit: 'علبة', barcode: '6291016140012' },
  { name: 'أدول 500 ملجم', scientificName: 'Paracetamol', commercialName: 'Adol', category: 'medication', price: 800, unit: 'علبة', barcode: '6291016140029' },
  { name: 'بروفين 400 ملجم', scientificName: 'Ibuprofen', commercialName: 'Brufen', category: 'medication', price: 1500, unit: 'علبة', barcode: '6291016140036' },
  { name: 'فلاجيل 500 ملجم', scientificName: 'Metronidazole', commercialName: 'Flagyl', category: 'medication', price: 2200, unit: 'علبة', barcode: '6291016140043' },
  { name: 'أموكسيل 500 ملجم', scientificName: 'Amoxicillin', commercialName: 'Amoxil', category: 'medication', price: 2500, unit: 'علبة', barcode: '6291016140050' },
  { name: 'فولتارين 50 ملجم', scientificName: 'Diclofenac Sodium', commercialName: 'Voltaren', category: 'medication', price: 1800, unit: 'علبة', barcode: '6291016140067' },
  { name: 'جلوكوفاج 500 ملجم', scientificName: 'Metformin', commercialName: 'Glucophage', category: 'medication', price: 3000, unit: 'علبة', barcode: '6291016140074' },
  { name: 'أيزوميد 20 ملجم', scientificName: 'Omeprazole', commercialName: 'Isomed', category: 'medication', price: 2800, unit: 'علبة', barcode: '6291016140081' },
];

export default function Pharmacy() {
  const { profile, isAdmin } = useAuth();

  if (profile?.role === 'patient') return null;
  
  const inventory = useLiveQuery(() => localDB.inventory.toArray(), []) || [];
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<'search' | 'add' | 'edit' | 'pos'>('search');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isLabelDialogOpen, setIsLabelDialogOpen] = useState(false);
  const [cart, setCart] = useState<{item: InventoryItem, qty: number}[]>([]);
  const [posPatient, setPosPatient] = useState('');
  
  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({
    name: '',
    scientificName: '',
    commercialName: '',
    category: 'medication',
    quantity: 0,
    price: 0,
    unit: 'علبة',
    barcode: '',
    minThreshold: 10
  });

  useEffect(() => {
    if (!profile || profile.role === 'patient') return;

    // Prescriptions (Still using Firestore for live coordination of orders)
    const qPres = query(collection(db, 'prescriptions'), orderBy('createdAt', 'desc'));
    const unsubPres = onSnapshot(qPres, (snapshot) => {
      setPrescriptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Prescription[]);
    });

    return () => { unsubPres(); };
  }, [profile]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name || !newItem.scientificName) {
      toast.error('يرجى إدخال اسم الصنف والاسم العلمي');
      return;
    }
    try {
      const docRef = await addDoc(collection(db, 'inventory'), {
        ...newItem,
        quantity: Number(newItem.quantity) || 0,
        price: Number(newItem.price) || 0,
        minThreshold: Number(newItem.minThreshold) || 10,
        updatedAt: serverTimestamp()
      });

      await logAction(
        profile,
        'إضافة صنف للمخزون',
        'inventory',
        docRef.id,
        `تم إضافة ${newItem.name} (${newItem.scientificName}) للمخزون`
      );

      toast.success('تم إضافة الصنف للمخزون');
      setIsAddDialogOpen(false);
      setNewItem({ name: '', scientificName: '', commercialName: '', category: 'medication', quantity: 0, price: 0, unit: 'علبة', barcode: '', minThreshold: 10 });
    } catch (error) {
      toast.error('فشل إضافة الصنف');
    }
  };

  const seedCommonDrugs = async () => {
    if (!isAdmin) return;
    const loadingToast = toast.loading('جاري إضافة الأصناف الشائعة...');
    try {
      for (const drug of COMMON_DRUGS) {
        // Check if already exists by barcode
        const existing = inventory.find(i => i.barcode === drug.barcode);
        if (!existing) {
          await addDoc(collection(db, 'inventory'), {
            ...drug,
            quantity: 50,
            minThreshold: 10,
            updatedAt: serverTimestamp()
          });
        }
      }
      toast.dismiss(loadingToast);
      toast.success('تم تحديث المخزون بالأصناف الشائعة بنجاح');
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('حدث خطأ أثناء إضافة الأصناف');
    }
  };

  const handleScan = (barcode: string) => {
    if (scannerMode === 'search') {
      setSearchTerm(barcode);
      const found = inventory.find(i => i.barcode === barcode);
      if (found) {
        toast.success(`تم العثور على: ${found.name}`);
      } else {
        toast.info('باركود جديد، يمكنك استخدامه لإضافة صنف');
      }
      setIsScannerOpen(false);
    } else if (scannerMode === 'add') {
      setNewItem(prev => ({ ...prev, barcode }));
      toast.success('تم مسح الباركود بنجاح');
      setIsScannerOpen(false);
    } else if (scannerMode === 'edit' && selectedItem) {
      setSelectedItem(prev => prev ? { ...prev, barcode } : null);
      toast.success('تم تحديث الباركود');
      setIsScannerOpen(false);
    } else if (scannerMode === 'pos') {
      const found = inventory.find(i => i.barcode === barcode);
      if (found) {
        addToCart(found);
        toast.success(`تمت إضافة ${found.name} للسلة`);
      } else {
        toast.error('لم يتم العثور على الصنف');
      }
      // Keep scanner open for more items if they like? 
      // User said "seamless", so maybe auto-close after scan but provide "continue" option or just close.
      // Usually POS scanners stay open. But for mobile camera, one scan is safer to avoid duplicates.
      setIsScannerOpen(false);
    }
  };

  const addToCart = (item: InventoryItem) => {
    setCart(prev => {
      const existing = prev.find(p => p.item.id === item.id);
      if (existing) {
        return prev.map(p => p.item.id === item.id ? { ...p, qty: p.qty + 1 } : p);
      }
      return [...prev, { item, qty: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(p => p.item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setPosPatient('');
  };

  const totalCartPrice = cart.reduce((acc, p) => acc + (p.item.price * p.qty), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    try {
      const billData = {
        amount: totalCartPrice,
        description: `بيع أدوية: ${cart.map(c => c.item.name).join(', ')}`,
        patientName: posPatient || 'زبون نقدي',
        status: 'pending',
        type: 'pharmacy',
        createdAt: serverTimestamp()
      };

      const billRef = await addDoc(collection(db, 'bills'), billData);

      for (const entry of cart) {
        await updateDoc(doc(db, 'inventory', entry.item.id), {
          quantity: Math.max(0, entry.item.quantity - entry.qty),
          updatedAt: serverTimestamp()
        });
      }

      await logAction(
        profile,
        'عملية بيع أدوية',
        'inventory',
        billRef.id,
        `عملية بيع بقيمة ${totalCartPrice} ر.ي لـ ${posPatient || 'زبون نقدي'}`
      );

      toast.success('تم إتمام البيع بنجاح');
      clearCart();
    } catch (error) {
      toast.error('فشل إتمام العملية');
    }
  };

  const handleEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    try {
      await updateDoc(doc(db, 'inventory', selectedItem.id), {
        ...selectedItem,
        updatedAt: serverTimestamp()
      });
      toast.success('تم تحديث بيانات الصنف');
      setIsEditDialogOpen(false);
    } catch (error) {
      toast.error('فشل تحديث البيانات');
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الصنف؟')) return;
    try {
      await deleteDoc(doc(db, 'inventory', id));
      toast.success('تم حذف الصنف من المخزون');
    } catch (error) {
      toast.error('فشل حذف الصنف');
    }
  };

  const handleDispense = async (prescriptionId: string) => {
    const prescription = prescriptions.find(p => p.id === prescriptionId);
    if (!prescription) return;

    try {
      // Calculate total price
      let totalPrice = 0;
      const dispensedMeds: string[] = [];

      for (const med of prescription.medications) {
        const invItem = inventory.find(i => i.name === med.name);
        if (invItem) {
          totalPrice += invItem.price || 0;
          dispensedMeds.push(med.name);
          
          // Deduct from inventory
          await updateDoc(doc(db, 'inventory', invItem.id), {
            quantity: Math.max(0, invItem.quantity - 1), // Assuming 1 unit per prescription item for simplicity
            updatedAt: serverTimestamp()
          });
        }
      }

      // Update prescription status
      await updateDoc(doc(db, 'prescriptions', prescriptionId), {
        status: 'dispensed',
        updatedAt: serverTimestamp()
      });

      await logAction(
        profile,
        'صرف وصفة طبية',
        'prescription',
        prescriptionId,
        `تم صرف الأدوية للمريض: ${prescription.patientName}`
      );

      // Create a bill
      if (totalPrice > 0) {
        await addDoc(collection(db, 'bills'), {
          patientId: prescription.patientId,
          patientName: prescription.patientName,
          amount: totalPrice,
          description: `صرف أدوية: ${dispensedMeds.join(', ')}`,
          status: 'pending',
          type: 'pharmacy',
          createdAt: serverTimestamp()
        });
      }

      toast.success('تم صرف الوصفة وإنشاء الفاتورة بنجاح');
    } catch (error) {
      console.error('Error dispensing:', error);
      toast.error('فشل صرف الوصفة');
    }
  };

  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.scientificName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.commercialName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.barcode === searchTerm
  );

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">الصيدلية والمخزون</h1>
        <div className="flex gap-2">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger render={<Button className="gap-2" />}>
              <PackagePlus size={18} /> إضافة صنف جديد
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]" dir="rtl">
              <DialogHeader>
                <DialogTitle>إضافة صنف للمخزون</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddItem} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>اسم الدواء / الصنف</Label>
                  <Input value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الكمية</Label>
                    <Input type="number" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: parseInt(e.target.value)})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>السعر (ر.ي)</Label>
                    <Input type="number" value={newItem.price} onChange={e => setNewItem({...newItem, price: parseInt(e.target.value)})} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>الوحدة</Label>
                  <Input value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})} placeholder="علبة، شريط..." required />
                </div>
                <div className="space-y-2">
                  <Label>حد التنبيه (الحد الأدنى)</Label>
                  <Input type="number" value={newItem.minThreshold} onChange={e => setNewItem({...newItem, minThreshold: parseInt(e.target.value)})} required />
                </div>
                <Button type="submit" className="w-full">حفظ الصنف</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="text-primary" />
              تعديل بيانات الصنف
            </DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <form onSubmit={handleEditItem} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الاسم الشائع</Label>
                  <Input value={selectedItem.name} onChange={e => setSelectedItem({...selectedItem, name: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>الاسم العلمي</Label>
                  <Input value={selectedItem.scientificName} onChange={e => setSelectedItem({...selectedItem, scientificName: e.target.value})} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الاسم التجاري</Label>
                  <Input value={selectedItem.commercialName || ''} onChange={e => setSelectedItem({...selectedItem, commercialName: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>الباركود</Label>
                  <div className="flex gap-2">
                    <Input value={selectedItem.barcode || ''} onChange={e => setSelectedItem({...selectedItem, barcode: e.target.value})} />
                    <Button type="button" variant="outline" size="icon" onClick={() => { setScannerMode('edit'); setIsScannerOpen(true); }}>
                      <ScanLine size={18} />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>الكمية</Label>
                  <Input type="number" value={selectedItem.quantity} onChange={e => setSelectedItem({...selectedItem, quantity: parseInt(e.target.value)})} required />
                </div>
                <div className="space-y-2">
                  <Label>السعر (ر.ي)</Label>
                  <Input type="number" value={selectedItem.price || 0} onChange={e => setSelectedItem({...selectedItem, price: parseInt(e.target.value)})} required />
                </div>
                <div className="space-y-2">
                  <Label>الوحدة</Label>
                  <Input value={selectedItem.unit} onChange={e => setSelectedItem({...selectedItem, unit: e.target.value})} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>حد التنبيه (الحد الأدنى)</Label>
                <Input type="number" value={selectedItem.minThreshold} onChange={e => setSelectedItem({...selectedItem, minThreshold: parseInt(e.target.value)})} required />
              </div>
              <Button type="submit" className="w-full h-11">تحديث البيانات</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isLabelDialogOpen} onOpenChange={setIsLabelDialogOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarcodeIcon className="text-primary" />
              ملصق الصنف
            </DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="flex flex-col items-center py-6 gap-4 border rounded-xl bg-slate-50" id="pharmacy-label">
              <div className="text-center">
                <h4 className="font-bold text-lg">{selectedItem.name}</h4>
                <p className="text-xs text-slate-500">{selectedItem.scientificName}</p>
              </div>
              <div className="bg-white p-4 rounded shadow-sm border border-slate-200">
                <Barcode 
                  value={selectedItem.barcode || selectedItem.id} 
                  width={1.5} 
                  height={50} 
                  fontSize={14}
                />
              </div>
              <p className="font-bold text-lg text-primary">{selectedItem.price.toLocaleString()} ر.ي</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLabelDialogOpen(false)} className="w-full">إغلاق</Button>
            <Button onClick={() => window.print()} className="w-full gap-2"><Printer size={16} /> طباعة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-12">
          <TabsTrigger value="inventory" className="gap-2">
            <PackagePlus size={18} /> المخزون الدوائي
          </TabsTrigger>
          <TabsTrigger value="pos" className="gap-2">
            <ScanLine size={18} /> بيع مباشر (POS)
          </TabsTrigger>
          <TabsTrigger value="prescriptions" className="gap-2">
            <ClipboardList size={18} /> الوصفات الطبية
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-sky-50 border-sky-200">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 bg-sky-500 rounded-full text-white">
                  <Pill size={24} />
                </div>
                <div>
                  <p className="text-sm text-sky-700 font-medium">إجمالي الأصناف</p>
                  <p className="text-2xl font-bold text-sky-900">{inventory.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 bg-amber-500 rounded-full text-white">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <p className="text-sm text-amber-700 font-medium">أصناف قاربت على النفاد</p>
                  <p className="text-2xl font-bold text-amber-900">
                    {inventory.filter(i => i.quantity <= i.minThreshold).length}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50 border-emerald-200">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 bg-emerald-500 rounded-full text-white">
                  <CheckCircle size={24} />
                </div>
                <div>
                  <p className="text-sm text-emerald-700 font-medium">وصفات تم صرفها</p>
                  <p className="text-2xl font-bold text-emerald-900">
                    {prescriptions.filter(p => p.status === 'dispensed').length}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-border shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input 
                placeholder="البحث بالاسم العلمي، التجاري، أو الباركود..." 
                className="pr-10 h-11"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Button variant="outline" className="gap-2 h-11 flex-1 md:flex-none" onClick={() => { setScannerMode('search'); setIsScannerOpen(true); }}>
                <ScanLine size={18} /> مسح باركود
              </Button>
              <Button variant="ghost" className="gap-2 h-11" onClick={() => setSearchTerm('')}>
                <X size={18} /> مسح البحث
              </Button>
            </div>
          </div>

          <div className="panel overflow-hidden border-none shadow-md rounded-xl">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[250px]">الصنف (الاسم العلمي)</TableHead>
                  <TableHead>الباركود</TableHead>
                  <TableHead>الكمية / الوحدة</TableHead>
                  <TableHead>السعر</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="text-left">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInventory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Search size={48} className="text-slate-200" />
                        <p>لا يوجد نتائج تطابق بحثك</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredInventory.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{item.name}</span>
                        <span className="text-xs text-primary font-medium">{item.scientificName}</span>
                        {item.commercialName && <span className="text-[10px] text-slate-400">{item.commercialName}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 font-mono text-xs text-slate-500">
                        <BarcodeIcon size={14} className="text-slate-400" />
                        {item.barcode || '---'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className={`font-bold ${item.quantity <= item.minThreshold ? 'text-danger' : 'text-slate-700'}`}>
                          {item.quantity}
                        </span>
                        <span className="text-xs text-slate-500">{item.unit}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-emerald-600">{item.price.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-400 mr-1">ر.ي</span>
                    </TableCell>
                    <TableCell>
                      {item.quantity <= item.minThreshold ? (
                        <Badge variant="destructive" className="bg-red-50 text-red-600 border-red-100 hover:bg-red-50">منخفض</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-50">متوفر</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-left">
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-primary hover:bg-primary/10"
                          onClick={() => {
                            setSelectedItem(item);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Edit size={16} />
                        </Button>
                        {isAdmin && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-primary hover:bg-primary/10"
                              onClick={() => {
                                setSelectedItem(item);
                                setIsLabelDialogOpen(true);
                              }}
                              title="طباعة باركود"
                            >
                              <BarcodeIcon size={16} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-danger hover:bg-danger/10"
                              onClick={() => handleDeleteItem(item.id)}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="pos" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ScanLine className="text-primary" />
                    مسح الأصناف للبيع
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input 
                      placeholder="امسح الباركود أو ابحث عن صنف لبيعه..." 
                      className="h-12 text-lg" 
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = (e.target as HTMLInputElement).value;
                          const found = inventory.find(i => i.barcode === val || i.name === val);
                          if (found) {
                            addToCart(found);
                            (e.target as HTMLInputElement).value = '';
                            toast.success(`تمت إضافة ${found.name}`);
                          } else {
                            toast.error('لم يتم العثور على الصنف');
                          }
                        }
                      }}
                    />
                    <Button size="lg" className="gap-2" onClick={() => { setScannerMode('pos'); setIsScannerOpen(true); }}>
                      <ScanLine size={20} /> مسح بالكاميرا
                    </Button>
                  </div>
                  
                  <div className="border rounded-xl overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead>الصنف</TableHead>
                          <TableHead className="w-[100px]">السعر</TableHead>
                          <TableHead className="w-[150px]">الكمية</TableHead>
                          <TableHead className="w-[100px]">الإجمالي</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cart.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                              السلة فارغة. ابدأ بمسح باركود الأدوية للبيع.
                            </TableCell>
                          </TableRow>
                        ) : cart.map((p) => (
                          <TableRow key={p.item.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold">{p.item.name}</span>
                                <span className="text-xs text-muted-foreground">{p.item.scientificName}</span>
                              </div>
                            </TableCell>
                            <TableCell>{p.item.price.toLocaleString()}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => {
                                  if (p.qty > 1) {
                                    setCart(prev => prev.map(c => c.item.id === p.item.id ? {...c, qty: c.qty - 1} : c));
                                  }
                                }}>-</Button>
                                <span className="w-8 text-center font-bold">{p.qty}</span>
                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => addToCart(p.item)}>+</Button>
                              </div>
                            </TableCell>
                            <TableCell className="font-bold">{(p.item.price * p.qty).toLocaleString()}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => removeFromCart(p.item.id)}>
                                <Trash2 size={16} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-primary/20 shadow-md">
                <CardHeader className="bg-primary/5">
                  <CardTitle className="text-lg">ملخص العملية</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-2">
                    <Label>اسم المريض (اختياري)</Label>
                    <Input 
                      placeholder="اسم المريض لربط الفاتورة" 
                      value={posPatient}
                      onChange={e => setPosPatient(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex justify-between text-muted-foreground">
                      <span>عدد الأصناف:</span>
                      <span>{cart.length}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold">
                      <span>الإجمالي الكلي:</span>
                      <span className="text-primary">{totalCartPrice.toLocaleString()} ر.ي</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2 pt-4">
                    <Button size="lg" className="w-full text-lg h-14" disabled={cart.length === 0} onClick={handleCheckout}>
                      <DollarSign size={20} className="ml-2" /> إتمام البيع والتحصيل
                    </Button>
                    <Button variant="ghost" className="w-full text-danger" onClick={clearCart} disabled={cart.length === 0}>
                      إلغاء السلة
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-sky-50 border-sky-100">
                <CardContent className="p-4 flex gap-3 text-sky-800">
                  <AlertCircle size={20} className="shrink-0" />
                  <p className="text-xs leading-relaxed">
                    يتم خصم الكميات تلقائياً من المخزون عند إتمام البيع. تأكد من صحة الباركود الممسوح.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="prescriptions" className="mt-6">
          <div className="panel">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المريض</TableHead>
                  <TableHead>الأدوية</TableHead>
                  <TableHead>الطبيب</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="text-left">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prescriptions.map((pres) => (
                  <TableRow key={pres.id}>
                    <TableCell className="font-bold">{pres.patientName}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {pres.medications.map((m: any, i: number) => (
                          <span key={i} className="text-xs">{m.name} ({m.dosage})</span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{pres.doctorName}</TableCell>
                    <TableCell>{formatArabicDate(pres.createdAt)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-[0.7rem] font-bold ${
                        pres.status === 'dispensed' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                      }`}>
                        {pres.status === 'dispensed' ? 'تم الصرف' : 'بانتظار الصرف'}
                      </span>
                    </TableCell>
                    <TableCell className="text-left">
                      {pres.status === 'pending' && (
                        <Button variant="outline" size="sm" onClick={() => handleDispense(pres.id)}>صرف الآن</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
