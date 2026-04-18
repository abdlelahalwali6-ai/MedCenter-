/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, addDoc, serverTimestamp, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { ServiceCatalogItem } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Plus, Edit, Trash2, LayoutGrid, DollarSign, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/src/context/AuthContext';

export default function Services() {
  const { profile, isAdmin } = useAuth();
  const services = useLiveQuery(() => localDB.serviceCatalog.orderBy('name').toArray(), []) || [];
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceCatalogItem | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    category: 'General',
    price: 0,
    description: ''
  });

  // Fetching moved to useLiveQuery above

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await DataService.create('serviceCatalog', {
        ...formData,
      });
      toast.success('تم إضافة الخدمة بنجاح');
      setIsAddDialogOpen(false);
      setFormData({ name: '', category: 'General', price: 0, description: '' });
    } catch (error) {
      toast.error('فشل إضافة الخدمة');
    }
  };

  const handleEditService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;
    try {
      await DataService.update('serviceCatalog', selectedService.id, {
        ...formData,
      });
      toast.success('تم تحديث الخدمة بنجاح');
      setIsEditDialogOpen(false);
    } catch (error) {
      toast.error('فشل تحديث الخدمة');
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الخدمة؟')) return;
    try {
      await DataService.delete('serviceCatalog', id);
      toast.success('تم حذف الخدمة');
    } catch (error) {
      toast.error('فشل حذف الخدمة');
    }
  };

  const openEditDialog = (service: ServiceCatalogItem) => {
    setSelectedService(service);
    setFormData({
      name: service.name,
      category: service.category,
      price: service.price,
      description: service.description || ''
    });
    setIsEditDialogOpen(true);
  };

  const filteredServices = services.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (profile?.role === 'patient') return null;

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LayoutGrid className="text-primary" />
          دليل الخدمات والأسعار
        </h1>
        {isAdmin && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger render={<Button className="gap-2" />}>
              <Plus size={18} /> إضافة خدمة جديدة
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]" dir="rtl">
              <DialogHeader>
                <DialogTitle>إضافة خدمة جديدة</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddService} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>اسم الخدمة</Label>
                  <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>الفئة</Label>
                  <Input value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} placeholder="مثال: تمريض، طوارئ، كشفية..." required />
                </div>
                <div className="space-y-2">
                  <Label>السعر (ر.ي)</Label>
                  <Input type="number" value={formData.price} onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})} required />
                </div>
                <div className="space-y-2">
                  <Label>الوصف (اختياري)</Label>
                  <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>
                <Button type="submit" className="w-full">حفظ الخدمة</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl text-primary">
              <Tag size={24} />
            </div>
            <div>
              <p className="text-xs text-secondary">إجمالي الخدمات</p>
              <p className="text-xl font-bold text-primary">{services.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-xs text-emerald-700">أعلى سعر خدمة</p>
              <p className="text-xl font-bold text-emerald-900">
                {services.length > 0 ? Math.max(...services.map(s => s.price)).toLocaleString() : 0} ر.ي
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            placeholder="البحث عن خدمة بالاسم أو الفئة..." 
            className="pr-10"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="panel overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الخدمة</TableHead>
              <TableHead>الفئة</TableHead>
              <TableHead>السعر</TableHead>
              <TableHead>الوصف</TableHead>
              {isAdmin && <TableHead className="text-left">الإجراءات</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredServices.map((service) => (
              <TableRow key={service.id}>
                <TableCell className="font-bold">{service.name}</TableCell>
                <TableCell>
                  <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs">
                    {service.category}
                  </span>
                </TableCell>
                <TableCell className="font-bold text-primary">
                  {service.price.toLocaleString()} ر.ي
                </TableCell>
                <TableCell className="text-xs text-secondary max-w-[200px] truncate">
                  {service.description || '-'}
                </TableCell>
                {isAdmin && (
                  <TableCell className="text-left">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(service)}>
                        <Edit size={16} />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleDeleteService(service.id)}>
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {filteredServices.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-10 text-muted-foreground">
                  لا توجد خدمات مطابقة للبحث
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل بيانات الخدمة</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditService} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>اسم الخدمة</Label>
              <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label>الفئة</Label>
              <Input value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label>السعر (ر.ي)</Label>
              <Input type="number" value={formData.price} onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})} required />
            </div>
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full">تحديث البيانات</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
