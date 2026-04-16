/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { UserProfile } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, UserPlus, Search, ShieldCheck, Mail, ShieldAlert, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ROLES } from '@/src/lib/constants';
import { useAuth } from '@/src/context/AuthContext';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function HR() {
  const { profile: currentUserProfile, isAdmin } = useAuth();

  if (currentUserProfile?.role === 'patient') return null;

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({
    displayName: '',
    email: '',
    role: 'doctor'
  });

  useEffect(() => {
    if (currentUserProfile?.role !== 'admin') return;

    const q = query(collection(db, 'users'), orderBy('displayName', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[]);
    });
    return () => unsub();
  }, [currentUserProfile]);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      // In a real app, we'd use Firebase Auth to create the user.
      // For this demo, we'll just create the profile document.
      // We'll use a random ID since we can't create the Auth user here.
      const tempUid = 'staff_' + Math.random().toString(36).substr(2, 9);
      const userRef = doc(db, 'users', tempUid);
      
      await setDoc(userRef, {
        uid: tempUid,
        displayName: newStaff.displayName,
        email: newStaff.email,
        role: newStaff.role,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      toast.success('تم إضافة الموظف بنجاح');
      setIsAddDialogOpen(false);
      setNewStaff({ displayName: '', email: '', role: 'doctor' });
    } catch (error) {
      console.error('Error adding staff:', error);
      toast.error('فشل إضافة الموظف');
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!isAdmin) {
      toast.error('عذراً، لا تملك صلاحية تغيير الأدوار');
      return;
    }

    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        role: newRole,
        updatedAt: new Date().toISOString()
      });
      toast.success('تم تحديث دور المستخدم بنجاح');
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('فشل تحديث دور المستخدم');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUserProfile?.uid) {
      toast.error('لا يمكنك حذف حسابك الخاص من هنا');
      return;
    }
    if (!window.confirm('هل أنت متأكد من حذف هذا المستخدم؟ سيتم حذف ملفه الشخصي فقط، لا يتم حذف حساب الدخول.')) return;
    
    try {
      await deleteDoc(doc(db, 'users', userId));
      toast.success('تم حذف ملف المستخدم بنجاح');
    } catch (error) {
      toast.error('فشل حذف المستخدم');
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleLabel = (roleValue: string) => {
    return ROLES.find(r => r.value === roleValue)?.label || roleValue;
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="text-primary" />
          إدارة الموارد البشرية والصلاحيات
        </h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger render={<Button className="gap-2" />}>
            <UserPlus size={18} /> إضافة موظف جديد
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]" dir="rtl">
            <DialogHeader>
              <DialogTitle>إضافة موظف جديد</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddStaff} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>الاسم الكامل</Label>
                <Input 
                  value={newStaff.displayName} 
                  onChange={e => setNewStaff({...newStaff, displayName: e.target.value})} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني</Label>
                <Input 
                  type="email" 
                  value={newStaff.email} 
                  onChange={e => setNewStaff({...newStaff, email: e.target.value})} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label>الدور الوظيفي</Label>
                <select 
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newStaff.role}
                  onChange={e => setNewStaff({...newStaff, role: e.target.value})}
                  required
                >
                  {ROLES.map(role => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full">إضافة الموظف</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            placeholder="البحث عن موظف بالاسم أو البريد..." 
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
              <TableHead>الموظف</TableHead>
              <TableHead>البريد الإلكتروني</TableHead>
              <TableHead>الدور الحالي</TableHead>
              <TableHead>تغيير الصلاحية</TableHead>
              <TableHead>الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.uid}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-primary text-xs">
                      {user.displayName?.substring(0, 2)}
                    </div>
                    <span className="font-bold">{user.displayName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  <div className="flex items-center gap-1">
                    <Mail size={14} />
                    {user.email}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <ShieldCheck size={14} className="text-primary" />
                    <span className="capitalize">{getRoleLabel(user.role)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Select 
                    disabled={!isAdmin || user.uid === currentUserProfile?.uid}
                    onValueChange={(value) => handleRoleChange(user.uid, value)}
                    defaultValue={user.role}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="اختر الدور" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded bg-success/10 text-success text-[0.7rem] font-bold">نشط</span>
                    {isAdmin && user.uid !== currentUserProfile?.uid && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-danger"
                        onClick={() => handleDeleteUser(user.uid)}
                      >
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
      
      {!isAdmin && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3 text-amber-800">
          <ShieldAlert size={20} />
          <p className="text-sm font-medium">تنبيه: أنت لا تملك صلاحيات "مدير نظام"، لذا لا يمكنك تعديل أدوار الموظفين.</p>
        </div>
      )}
    </div>
  );
}
