/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, updateDoc, doc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { DataService } from '@/src/lib/dataService';
import { formatArabicDate } from '@/src/lib/dateUtils';
import { logAction } from '@/src/lib/audit';
import { InventoryItem, Prescription } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Search, PackagePlus, AlertTriangle, Pill, CheckCircle, ClipboardList, Edit, Trash2, Loader2, ScanLine, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/src/context/AuthContext';
import { Badge } from '@/components/ui/badge';

export default function Pharmacy() {
  const { profile, isAdmin } = useAuth();

  if (profile?.role === 'patient') return null;
  
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cart, setCart] = useState<{item: InventoryItem, qty: number}[]>([]);

  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({ name: '', quantity: 0, price: 0, minThreshold: 10 });

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    const unsubs: (()=>void)[] = [];

    unsubs.push(onSnapshot(query(collection(db, 'inventory'), orderBy('name')), 
      (snap) => { setInventory(snap.docs.map(d => ({id: d.id, ...d.data()})) as InventoryItem[]); setLoading(false); },
      (err) => { handleFirestoreError(err, OperationType.LIST, 'inventory'); setLoading(false); }
    ));

    unsubs.push(onSnapshot(query(collection(db, 'prescriptions'), orderBy('createdAt', 'desc')), 
      (snap) => setPrescriptions(snap.docs.map(d => ({id: d.id, ...d.data()})) as Prescription[]),
      (err) => handleFirestoreError(err, OperationType.LIST, 'prescriptions')
    ));

    return () => unsubs.forEach(unsub => unsub());
  }, [profile]);
  
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await DataService.create('inventory', newItem);
      toast.success('تم إضافة الصنف');
      setIsAddDialogOpen(false);
      setNewItem({ name: '', quantity: 0, price: 0, minThreshold: 10 });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'inventory item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setIsSubmitting(true);
    try {
      await DataService.update('inventory', selectedItem.id, selectedItem);
      toast.success('تم تحديث الصنف');
      setSelectedItem(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'inventory item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm('هل أنت متأكد؟')) return;
    try {
      await DataService.delete('inventory', id);
      toast.success('تم حذف الصنف');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'inventory item');
    }
  };

  const handleDispense = async (prescriptionId: string) => {
    const pres = prescriptions.find(p => p.id === prescriptionId);
    if (!pres) return;
    setIsSubmitting(true);
    const toastId = toast.loading('جاري صرف الوصفة...');
    try {
      for (const med of pres.medications) {
        const invItem = inventory.find(i => i.name === med.name);
        if (invItem && invItem.quantity > 0) {
          await DataService.update('inventory', invItem.id, { quantity: invItem.quantity - 1 });
        }
      }
      await DataService.update('prescriptions', pres.id, { status: 'dispensed' });
      toast.success('تم صرف الوصفة بنجاح', { id: toastId });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'prescription');
      toast.error('فشل صرف الوصفة', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const addToCart = (item: InventoryItem) => {
    setCart(prev => {
      const existing = prev.find(p => p.item.id === item.id);
      if (existing) {
        return prev.map(p => p.item.id === item.id ? { ...p, qty: p.qty + 1 } : p);
      } else {
        return [...prev, { item, qty: 1 }];
      }
    });
  }

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);
    try {
        const total = cart.reduce((sum, i) => sum + (i.item.price * i.qty), 0);
        await DataService.create('bills', {
            type: 'pharmacy',
            patientName: 'زبون نقدي',
            totalAmount: total,
            finalAmount: total,
            status: 'paid',
            items: cart.map(i => ({ description: i.item.name, quantity: i.qty, amount: i.item.price }))
        });
        for (const i of cart) {
            const newQty = i.item.quantity - i.qty;
            await DataService.update('inventory', i.item.id, { quantity: newQty });
        }
        toast.success('تمت عملية البيع');
        setCart([]);
    } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'POS transaction');
    } finally {
        setIsSubmitting(false);
    }
  }

  const filteredInventory = inventory.filter(item => 
    (item.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">الصيدلية</h1>
        <Button onClick={() => setIsAddDialogOpen(true)}><PackagePlus size={18} /> إضافة صنف</Button>
      </div>

      <Tabs defaultValue="inventory">
        <TabsList><TabsTrigger value="inventory">المخزون</TabsTrigger><TabsTrigger value="pos">بيع مباشر</TabsTrigger><TabsTrigger value="prescriptions">الوصفات</TabsTrigger></TabsList>
        
        <TabsContent value="inventory" className="mt-4">
            <Input placeholder="بحث..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            {loading ? <Loader2 className="animate-spin mx-auto my-10"/> : 
            <Table>
                <TableHeader><TableRow><TableHead>الصنف</TableHead><TableHead>الكمية</TableHead><TableHead>السعر</TableHead><TableHead>الحالة</TableHead><TableHead>إجراء</TableHead></TableRow></TableHeader>
                <TableBody>
                    {filteredInventory.map(item => (
                        <TableRow key={item.id}>
                            <TableCell>{item.name}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{item.price} ر.ي</TableCell>
                            <TableCell><Badge variant={item.quantity > item.minThreshold ? 'default' : 'destructive'}>{item.quantity > item.minThreshold ? 'متوفر' : 'منخفض'}</Badge></TableCell>
                            <TableCell><Button variant="ghost" size="sm" onClick={() => setSelectedItem(item)}><Edit size={16}/></Button><Button variant="ghost" size="sm" onClick={() => handleDeleteItem(item.id)}><Trash2 size={16}/></Button></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>}
        </TabsContent>

        <TabsContent value="pos" className="mt-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <h3>الأصناف</h3>
                    <Input placeholder="بحث لإضافة للسلة..." onKeyDown={e => {
                        if (e.key === 'Enter') {
                            const found = inventory.find(i => i.name.toLowerCase() === (e.target as HTMLInputElement).value.toLowerCase());
                            if(found) addToCart(found);
                            (e.target as HTMLInputElement).value = '';
                        }
                    }} />
                    {/* List clickable items to add to cart */}
                </div>
                <div>
                    <h3>السلة</h3>
                    {cart.map(i => <div key={i.item.id}>{i.item.name} x {i.qty}</div>)}
                    <p>الإجمالي: {cart.reduce((sum, i) => sum + (i.item.price * i.qty), 0)} ر.ي</p>
                    <Button onClick={handleCheckout} disabled={isSubmitting || cart.length === 0}>{isSubmitting ? <Loader2 className="animate-spin" /> : <><DollarSign size={16}/> إتمام البيع</>}</Button>
                </div>
            </div>
        </TabsContent>

        <TabsContent value="prescriptions" className="mt-4">
            {loading ? <Loader2 className="animate-spin mx-auto my-10"/> : 
            <Table>
                <TableHeader><TableRow><TableHead>المريض</TableHead><TableHead>الطبيب</TableHead><TableHead>الأدوية</TableHead><TableHead>الحالة</TableHead><TableHead>إجراء</TableHead></TableRow></TableHeader>
                <TableBody>
                    {prescriptions.map(pres => (
                        <TableRow key={pres.id}>
                            <TableCell>{pres.patientName}</TableCell>
                            <TableCell>{pres.doctorName}</TableCell>
                            <TableCell>{pres.medications.map(m => m.name).join(', ')}</TableCell>
                            <TableCell><Badge variant={pres.status === 'pending' ? 'warning' : 'success'}>{pres.status}</Badge></TableCell>
                            <TableCell>{pres.status === 'pending' && <Button onClick={() => handleDispense(pres.id)} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin"/> : 'صرف'}</Button>}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>}
        </TabsContent>
      </Tabs>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}><DialogContent><DialogHeader><DialogTitle>إضافة صنف</DialogTitle></DialogHeader><form onSubmit={handleAddItem}><Input placeholder="الاسم" value={newItem.name} onChange={e=>setNewItem({...newItem, name: e.target.value})} /><Input type="number" placeholder="الكمية" value={newItem.quantity} onChange={e=>setNewItem({...newItem, quantity: Number(e.target.value)})} /><Input type="number" placeholder="السعر" value={newItem.price} onChange={e=>setNewItem({...newItem, price: Number(e.target.value)})} /><Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin"/> : 'إضافة'}</Button></form></DialogContent></Dialog>
      {selectedItem && <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}><DialogContent><DialogHeader><DialogTitle>تعديل صنف</DialogTitle></DialogHeader><form onSubmit={handleEditItem}><Input placeholder="الاسم" value={selectedItem.name} onChange={e=>setSelectedItem({...selectedItem, name: e.target.value})} /><Input type="number" placeholder="الكمية" value={selectedItem.quantity} onChange={e=>setSelectedItem({...selectedItem, quantity: Number(e.target.value)})} /><Input type="number" placeholder="السعر" value={selectedItem.price} onChange={e=>setSelectedItem({...selectedItem, price: Number(e.target.value)})} /><Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin"/> : 'تعديل'}</Button></form></DialogContent></Dialog>}
    </div>
  );
}
