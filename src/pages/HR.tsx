/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  doc, 
  updateDoc, 
  deleteDoc, 
  setDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db, createNewUser } from '@/src/lib/firebase';
import { UserProfile } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, UserPlus, Search, ShieldCheck, Mail, ShieldAlert, Trash2, Edit2, Lock, Phone, User } from 'lucide-react';
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
  const { profile: currentUserProfile, isAdmin, isPatient } = useAuth();

  if (isPatient) return null;

  const users = useLiveQuery(() => localDB.profiles.orderBy('displayName').toArray(), []) || [];
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [newStaff, setNewStaff] = useState({
    displayName: '',
    email: '',
    password: '',
    phoneNumber: '',
    role: 'doctor'
  });

  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  // Fetching moved to useLiveQuery above

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (newStaff.password.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setLoading(true);
    try {
      // 1. Create the Auth User (Requires cloud)
      const uid = await createNewUser(newStaff.email, newStaff.password, newStaff.displayName);
      
      // 2. Create the Firestore Profile via DataService for offline consistency
      await DataService.create('profiles', {
        id: uid, // Use Auth UID as document ID
        uid: uid,
        displayName: newStaff.displayName,
        email: newStaff.email,
        phoneNumber: newStaff.phoneNumber,
        role: newStaff.role,
      });

      toast.success('تم إنشاء حساب الموظف بنجاح');
      setIsAddDialogOpen(false);
      setNewStaff({ displayName: '', email: '', password: '', phoneNumber: '', role: 'doctor' });
    } catch (error: any) {
      console.error('Error adding staff:', error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('هذا البريد الإلكتروني مستخدم بالفعل');
      } else {
        toast.error('فشل إضافة الموظف: ' + (error.message || 'خطأ غير معروف'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editingUser) return;

    setLoading(true);
    try {
      await DataService.update('profiles', editingUser.uid, {
        displayName: editingUser.displayName,
        phoneNumber: editingUser.phoneNumber || '',
        role: editingUser.role,
      });
      toast.success('تم تحديث بيانات الموظف بنجاح');
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('فشل تحديث بيانات الموظف');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUserProfile?.uid) {
      toast.error('لا يمكنك حذف حسابك الخاص من هنا');
      return;
    }
    if (!window.confirm('هل أنت متأكد من حذف هذا المستخدم من قاعدة البيانات؟ ملاحظة: لن يتم حذف حساب الدخول في الـ Auth تلقائياً.')) return;
    
    try {
      await DataService.delete('profiles', userId);
      toast.success('تم حذف ملف المستخدم بنجاح');
    } catch (error) {
      toast.error('فشل حذف المستخدم');
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.phoneNumber?.includes(searchTerm)
  );

  const getRoleLabel = (roleValue: string) => {
    return ROLES.find(r => r.value === roleValue)?.label || roleValue;
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
          <Users className="text-primary h-7 w-7" />
          إدارة الموظفين والصلاحيات
        </h1>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-md">
              <UserPlus size={18} /> إضافة مستخدم جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[450px]" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">إضافة حساب موظف جديد</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddStaff} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>اسم الموظف</Label>
                  <div className="relative">
                    <User className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      className="pr-9"
                      placeholder="الاسم"
                      value={newStaff.displayName} 
                      onChange={e => setNewStaff({...newStaff, displayName: e.target.value})} 
                      required 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>رقم الهاتف</Label>
                  <div className="relative">
                    <Phone className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      className="pr-9"
                      placeholder="05..."
                      value={newStaff.phoneNumber} 
                      onChange={e => setNewStaff({...newStaff, phoneNumber: e.target.value})} 
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني (يستخدم لتسجيل الدخول)</Label>
                <div className="relative">
                  <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    className="pr-9"
                    type="email" 
                    placeholder="mail@example.com"
                    value={newStaff.email} 
                    onChange={e => setNewStaff({...newStaff, email: e.target.value})} 
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>كلمة المرور</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    className="pr-9"
                    type="password" 
                    placeholder="6 أحرف على الأقل"
                    value={newStaff.password} 
                    onChange={e => setNewStaff({...newStaff, password: e.target.value})} 
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>الدور الوظيفي / الصلاحيات</Label>
                <select 
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                  value={newStaff.role}
                  onChange={e => setNewStaff({...newStaff, role: e.target.value})}
                  required
                >
                  {ROLES.map(role => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </div>
              <DialogFooter className="pt-4">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'جاري الإنشاء...' : 'إضافة الموظف للأمان'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            placeholder="البحث بالاسم، البريد أو الهاتف..." 
            className="pr-10 h-11"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="panel overflow-hidden border-none shadow-lg">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="w-[250px]">الموظف</TableHead>
              <TableHead>البريد والاتصال</TableHead>
              <TableHead>الدور الوظيفي</TableHead>
              <TableHead className="text-left">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                  لا يوجد موظفين حالياً مطابقين للبحث
                </TableCell>
              </TableRow>
            ) : filteredUsers.map((user) => (
              <TableRow key={user.uid} className="hover:bg-slate-50/50 transition-colors">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary">
                      {user.displayName?.substring(0, 1)}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">{user.displayName}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">{user.uid}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail size={14} className="text-primary" />
                      {user.email}
                    </div>
                    {user.phoneNumber && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone size={14} className="text-primary" />
                        {user.phoneNumber}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                    user.role === 'admin' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                    user.role === 'doctor' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                    'bg-slate-50 text-slate-700 border-slate-100'
                  }`}>
                    {getRoleLabel(user.role)}
                  </span>
                </TableCell>
                <TableCell className="text-left">
                  <div className="flex items-center justify-end gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setEditingUser(user);
                        setIsEditDialogOpen(true);
                      }}
                      className="h-8 w-8 p-0"
                      title="تعديل البيانات"
                    >
                      <Edit2 size={14} />
                    </Button>
                    
                    {isAdmin && user.uid !== currentUserProfile?.uid && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteUser(user.uid)}
                        title="حذف الموظف"
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
      
      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[450px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">تعديل بيانات الموظف</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <form onSubmit={handleUpdateUser} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>الاسم الكامل</Label>
                <Input 
                  value={editingUser.displayName} 
                  onChange={e => setEditingUser({...editingUser, displayName: e.target.value})} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label>رقم الهاتف</Label>
                <Input 
                  value={editingUser.phoneNumber || ''} 
                  onChange={e => setEditingUser({...editingUser, phoneNumber: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني (غير قابل للتعديل)</Label>
                <Input value={editingUser.email} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>الدور والصلحيات</Label>
                <select 
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editingUser.role}
                  onChange={e => setEditingUser({...editingUser, role: e.target.value as any})}
                  required
                  disabled={editingUser.uid === currentUserProfile?.uid}
                >
                  {ROLES.map(role => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </div>
              <DialogFooter className="pt-4">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {!isAdmin && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800 shadow-sm animate-pulse">
          <ShieldAlert size={20} />
          <p className="text-sm font-medium">تنبيه: أنت لا تملك صلاحيات "مدير نظام"، لذا لا يمكنك تعديل الموظفين.</p>
        </div>
      )}
    </div>
  );
}
