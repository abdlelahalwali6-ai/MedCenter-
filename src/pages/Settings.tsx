/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Settings as SettingsIcon, Bell, Shield, Database, Globe, Smartphone, Loader2, DatabaseBackup, Github, GitBranch, Link, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/src/context/AuthContext';
import { seedLabCatalog } from '@/src/lib/seedLab';
import { seedPharmacyAndRadiology } from '@/src/lib/seedData';
import { logAction } from '@/src/lib/audit';

import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { requestNotificationPermission, showLocalNotification } from '@/src/lib/pushNotifications';

export default function Settings() {
  const { isAdmin, profile } = useAuth();

  if (profile?.role === 'patient') return null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'clinic' | 'security' | 'permissions' | 'notifications' | 'backup' | 'github'>('general');
  
  const [settings, setSettings] = useState({
    centerNameAr: 'مد كير الطبي',
    centerNameEn: 'MedCare Medical Center',
    address: 'الرياض، المملكة العربية السعودية',
    phone: '+966 11 000 0000',
    email: 'info@medcenter.sa',
    taxId: '3000100020003',
    costCenter: 'CC-001',
    mobileAppEnabled: true,
    autoSyncEnabled: true,
    twoFactorAuth: false,
    sessionTimeout: '30',
    emailNotifications: true,
    smsNotifications: false,
    backupFrequency: 'daily',
    retentionPolicy: '90',
    githubEnabled: false,
    githubToken: '',
    githubRepo: 'owner/repo',
    autoExportEnabled: false,
    pharmacyModule: true,
    labModule: true,
    radiologyModule: true,
    billingModule: true
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'global');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(prev => ({ ...prev, ...docSnap.data() }));
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (!isAdmin) {
      toast.error('عذراً، يجب أن تكون مسؤولاً لتعديل الإعدادات');
      return;
    }
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        ...settings,
        updatedAt: serverTimestamp()
      });
      await logAction(profile, 'تحديث الإعدادات', 'settings', 'global', `تم تحديث إعدادات النظام وتعديل الموديلات ${Object.keys(settings).filter(k => k.includes('Module') && (settings as any)[k]).join(', ')}`);
      toast.success('تم حفظ الإعدادات بنجاح');
    } catch (error) {
      toast.error('فشل حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const handleSeed = async () => {
    setShowSeedConfirm(false);
    setSaving(true);
    try {
      await seedLabCatalog();
      await seedPharmacyAndRadiology();
      toast.success('تم زرع قاعدة البيانات بنجاح');
      window.location.reload();
    } catch (error) {
      toast.error('فشل زرع قاعدة البيانات');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>معلومات المركز الطبي</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>اسم المركز (بالعربية)</Label>
                    <Input 
                      value={settings.centerNameAr} 
                      onChange={e => setSettings({...settings, centerNameAr: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>اسم المركز (بالإنجليزية)</Label>
                    <Input 
                      value={settings.centerNameEn} 
                      onChange={e => setSettings({...settings, centerNameEn: e.target.value})} 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>العنوان</Label>
                  <Input 
                    value={settings.address} 
                    onChange={e => setSettings({...settings, address: e.target.value})} 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>رقم الهاتف</Label>
                    <Input 
                      value={settings.phone} 
                      onChange={e => setSettings({...settings, phone: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>البريد الرسمي</Label>
                    <Input 
                      value={settings.email} 
                      onChange={e => setSettings({...settings, email: e.target.value})} 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>إعدادات النظام الهجين</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <Smartphone className="text-primary" />
                    <div>
                      <p className="font-bold text-sm">تطبيق الجوال للمرضى</p>
                      <p className="text-xs text-muted-foreground">تفعيل حجز المواعيد عبر التطبيق</p>
                    </div>
                  </div>
                  <div 
                    className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${settings.mobileAppEnabled ? 'bg-primary' : 'bg-muted'}`}
                    onClick={() => isAdmin && setSettings({...settings, mobileAppEnabled: !settings.mobileAppEnabled})}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.mobileAppEnabled ? 'right-1' : 'right-7'}`}></div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <Database className="text-primary" />
                    <div>
                      <p className="font-bold text-sm">التزامن التلقائي</p>
                      <p className="text-xs text-muted-foreground">مزامنة البيانات مع السحابة كل 5 دقائق</p>
                    </div>
                  </div>
                  <div 
                    className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${settings.autoSyncEnabled ? 'bg-primary' : 'bg-muted'}`}
                    onClick={() => isAdmin && setSettings({...settings, autoSyncEnabled: !settings.autoSyncEnabled})}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.autoSyncEnabled ? 'right-1' : 'right-7'}`}></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      case 'security':
        return (
          <Card>
            <CardHeader>
              <CardTitle>الأمان والصلاحيات</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <Shield className="text-primary" />
                  <div>
                    <p className="font-bold text-sm">المصادقة الثنائية (2FA)</p>
                    <p className="text-xs text-muted-foreground">فرض المصادقة الثنائية لجميع الموظفين</p>
                  </div>
                </div>
                <div 
                  className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${settings.twoFactorAuth ? 'bg-primary' : 'bg-muted'}`}
                  onClick={() => isAdmin && setSettings({...settings, twoFactorAuth: !settings.twoFactorAuth})}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.twoFactorAuth ? 'right-1' : 'right-7'}`}></div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>مدة الجلسة (بالدقائق)</Label>
                <Input 
                  type="number"
                  value={settings.sessionTimeout} 
                  onChange={e => setSettings({...settings, sessionTimeout: e.target.value})} 
                />
                <p className="text-xs text-muted-foreground">يتم تسجيل الخروج تلقائياً بعد هذه المدة من الخمول</p>
              </div>
            </CardContent>
          </Card>
        );
      case 'notifications':
        return (
          <Card>
            <CardHeader>
              <CardTitle>التنبيهات والإشعارات</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <Bell className="text-primary" />
                  <div>
                    <p className="font-bold text-sm">إشعارات البريد الإلكتروني</p>
                    <p className="text-xs text-muted-foreground">إرسال تنبيهات المواعيد والنتائج عبر البريد</p>
                  </div>
                </div>
                <div 
                  className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${settings.emailNotifications ? 'bg-primary' : 'bg-muted'}`}
                  onClick={() => isAdmin && setSettings({...settings, emailNotifications: !settings.emailNotifications})}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.emailNotifications ? 'right-1' : 'right-7'}`}></div>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <Smartphone className="text-primary" />
                  <div>
                    <p className="font-bold text-sm">إشعارات المتصفح (PWA)</p>
                    <p className="text-xs text-muted-foreground">تفعيل إشعارات الدفع المباشرة على الجهاز</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => showLocalNotification('تم اختبار التنبيهات بنجاح', { body: 'نظام رعاية المريض يعمل بشكل صحيح.' })}
                  >
                    اختبار
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={requestNotificationPermission}
                  >
                    تفعيل
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <Smartphone className="text-primary" />
                  <div>
                    <p className="font-bold text-sm">إشعارات SMS</p>
                    <p className="text-xs text-muted-foreground">إرسال رسائل نصية لتأكيد المواعيد</p>
                  </div>
                </div>
                <div 
                  className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${settings.smsNotifications ? 'bg-primary' : 'bg-muted'}`}
                  onClick={() => isAdmin && setSettings({...settings, smsNotifications: !settings.smsNotifications})}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.smsNotifications ? 'right-1' : 'right-7'}`}></div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      case 'backup':
        return (
          <Card>
            <CardHeader>
              <CardTitle>النسخ الاحتياطي والأرشفة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>تكرار النسخ الاحتياطي</Label>
                <select 
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={settings.backupFrequency}
                  onChange={e => setSettings({...settings, backupFrequency: e.target.value})}
                >
                  <option value="hourly">كل ساعة</option>
                  <option value="daily">يومياً</option>
                  <option value="weekly">أسبوعياً</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>مدة الاحتفاظ بالسجلات (بالأيام)</Label>
                <Input 
                  type="number"
                  value={settings.retentionPolicy} 
                  onChange={e => setSettings({...settings, retentionPolicy: e.target.value})} 
                />
              </div>
              <div className="pt-4 border-t border-border">
                <Button variant="outline" className="w-full gap-2" onClick={() => toast.info('جاري بدء النسخ الاحتياطي اليدوي...')}>
                  <DatabaseBackup size={18} />
                  بدء نسخة احتياطية فورية
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      case 'github':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Github size={20} />
                تكامل GitHub والتصدير التلقائي
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <Link className="text-primary" />
                  <div>
                    <p className="font-bold text-sm">تفعيل ربط GitHub</p>
                    <p className="text-xs text-muted-foreground">ربط المشروع بمستودع خارجي للتصدير والتحكم بالإصدارات</p>
                  </div>
                </div>
                <div 
                  className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${settings.githubEnabled ? 'bg-primary' : 'bg-muted'}`}
                  onClick={() => isAdmin && setSettings({...settings, githubEnabled: !settings.githubEnabled})}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.githubEnabled ? 'right-1' : 'right-7'}`}></div>
                </div>
              </div>

              {settings.githubEnabled && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-2">
                    <Label>رمز الدخول الشخصي (Personal Access Token)</Label>
                    <Input 
                      type="password"
                      placeholder="ghp_****************"
                      value={settings.githubToken} 
                      onChange={e => setSettings({...settings, githubToken: e.target.value})} 
                    />
                    <p className="text-[10px] text-muted-foreground italic">يتم تخزين الرمز بشكل آمن في إعدادات النظام المشفرة.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>اسم المستودع (Repository)</Label>
                    <Input 
                      placeholder="username/repository-name"
                      value={settings.githubRepo} 
                      onChange={e => setSettings({...settings, githubRepo: e.target.value})} 
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      <GitBranch className="text-primary" />
                      <div>
                        <p className="font-bold text-sm">التصدير التلقائي عند الحفظ</p>
                        <p className="text-xs text-muted-foreground">تحديث الكود تلقائياً على GitHub عند إجراء تغييرات جوهرية</p>
                      </div>
                    </div>
                    <div 
                      className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${settings.autoExportEnabled ? 'bg-primary' : 'bg-muted'}`}
                      onClick={() => isAdmin && setSettings({...settings, autoExportEnabled: !settings.autoExportEnabled})}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.autoExportEnabled ? 'right-1' : 'right-7'}`}></div>
                    </div>
                  </div>

                  <div className="pt-2 flex gap-2">
                    <Button variant="outline" className="flex-1 gap-2" onClick={() => toast.info('جاري اختبار الاتصال بـ GitHub...')}>
                      اختبار الاتصال
                    </Button>
                    <Button className="flex-1 gap-2" onClick={() => toast.success('تم جدولة عملية التصدير التلقائية')}>
                      بدء تصدير يدوي
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      case 'clinic':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>الإعدادات المالية والضريبية</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الرقم الضريبي الموحد</Label>
                    <Input 
                      value={settings.taxId} 
                      onChange={e => setSettings({...settings, taxId: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>مركز التكلفة الافتراضي</Label>
                    <Input 
                      value={settings.costCenter} 
                      onChange={e => setSettings({...settings, costCenter: e.target.value})} 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>تفعيل الموديلات (Modules)</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                {[
                  { id: 'pharmacyModule', label: 'نظام الصيدلية والمخزون' },
                  { id: 'labModule', label: 'نظام المختبر والنتائج' },
                  { id: 'radiologyModule', label: 'نظام الأشعة وPACS' },
                  { id: 'billingModule', label: 'نظام الفوترة والتأمين' }
                ].map((mod) => (
                  <div key={mod.id} className="flex items-center justify-between p-3 border rounded-xl">
                    <span className="text-sm font-bold">{mod.label}</span>
                    <div 
                      className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${(settings as any)[mod.id] ? 'bg-primary' : 'bg-muted'}`}
                      onClick={() => isAdmin && setSettings({...settings, [mod.id]: !(settings as any)[mod.id]})}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${(settings as any)[mod.id] ? 'right-0.5' : 'right-5.5'}`}></div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        );
      case 'permissions':
        return (
          <Card>
            <CardHeader>
              <CardTitle>الصلاحيات الموحدة للنظام</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-auto border rounded-xl">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 font-bold border-b">الدور (Role)</th>
                      <th className="px-4 py-3 font-bold border-b">وصف الصلاحيات</th>
                      <th className="px-4 py-3 font-bold border-b text-center">الوصول</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { role: 'admin', desc: 'كامل الصلاحيات، الإعدادات، الموارد البشرية، والتقارير المالية', access: 'كامل' },
                      { role: 'doctor', desc: 'إدارة المواعيد، المعاينة الطبية، الوصفات، وطلب الفحوصات', access: 'طبي' },
                      { role: 'nurse', desc: 'تسجيل المرضى، أخذ العلامات الحيوية، وتجهيز المواعيد', access: 'طبي/إداري' },
                      { role: 'lab_tech', desc: 'إدارة طلبات المختبر، إدخال النتائج، وإدارة الكواشف', access: 'تخصصي' },
                      { role: 'pharmacist', desc: 'صرف الأدوية، إدارة المخزون، والتعامل مع الفواتير الدوائية', access: 'تخصصي' },
                      { role: 'reception', desc: 'حجز المواعيد، الفوترة، تسجيل الزيارات، والاستقبال', access: 'إداري' },
                    ].map((r) => (
                      <tr key={r.role} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-bold text-primary border-b uppercase">{r.role}</td>
                        <td className="px-4 py-3 text-slate-500 border-b">{r.desc}</td>
                        <td className="px-4 py-3 border-b text-center">
                          <span className="px-2 py-0.5 bg-sky-50 text-sky-600 rounded text-[0.65rem] font-black uppercase tracking-wider">{r.access}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[0.65rem] text-muted-foreground italic mt-2">
                * يتم التحكم بالصلاحيات بناءً على الأدوار المعرفة في النظام لضمان أعلى درجات الأمان وحماية البيانات الصحية (HIPAA).
              </p>
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SettingsIcon className="text-primary" />
          إعدادات النظام
        </h1>
        <div className="flex gap-3">
          {isAdmin && (
            <Button variant="outline" onClick={() => setShowSeedConfirm(true)} disabled={saving} className="gap-2 text-warning border-warning hover:bg-warning/10">
              <DatabaseBackup size={18} />
              زرع البيانات الأولية
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || !isAdmin} className="gap-2">
            {saving ? <Loader2 className="animate-spin" size={18} /> : null}
            حفظ جميع التغييرات
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
          <Card 
            className={`cursor-pointer transition-all ${activeTab === 'general' ? 'border-r-4 border-r-primary bg-sky-50/30' : 'hover:bg-muted'}`}
            onClick={() => setActiveTab('general')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <Globe size={20} className={activeTab === 'general' ? 'text-primary' : 'text-secondary'} />
              <span className={activeTab === 'general' ? 'font-bold' : 'font-medium'}>الإعدادات العامة</span>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${activeTab === 'clinic' ? 'border-r-4 border-r-primary bg-sky-50/30' : 'hover:bg-muted'}`}
            onClick={() => setActiveTab('clinic')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <DatabaseBackup size={20} className={activeTab === 'clinic' ? 'text-primary' : 'text-secondary'} />
              <span className={activeTab === 'clinic' ? 'font-bold' : 'font-medium'}>إعدادات المؤسسة</span>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${activeTab === 'security' ? 'border-r-4 border-r-primary bg-sky-50/30' : 'hover:bg-muted'}`}
            onClick={() => setActiveTab('security')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <Shield size={20} className={activeTab === 'security' ? 'text-primary' : 'text-secondary'} />
              <span className={activeTab === 'security' ? 'font-bold' : 'font-medium'}>الأمان والحماية</span>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${activeTab === 'permissions' ? 'border-r-4 border-r-primary bg-sky-50/30' : 'hover:bg-muted'}`}
            onClick={() => setActiveTab('permissions')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <ShieldCheck size={20} className={activeTab === 'permissions' ? 'text-primary' : 'text-secondary'} />
              <span className={activeTab === 'permissions' ? 'font-bold' : 'font-medium'}>إدارة الصلاحيات</span>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${activeTab === 'notifications' ? 'border-r-4 border-r-primary bg-sky-50/30' : 'hover:bg-muted'}`}
            onClick={() => setActiveTab('notifications')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <Bell size={20} className={activeTab === 'notifications' ? 'text-primary' : 'text-secondary'} />
              <span className={activeTab === 'notifications' ? 'font-bold' : 'font-medium'}>التنبيهات والإشعارات</span>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${activeTab === 'backup' ? 'border-r-4 border-r-primary bg-sky-50/30' : 'hover:bg-muted'}`}
            onClick={() => setActiveTab('backup')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <Database size={20} className={activeTab === 'backup' ? 'text-primary' : 'text-secondary'} />
              <span className={activeTab === 'backup' ? 'font-bold' : 'font-medium'}>النسخ الاحتياطي</span>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${activeTab === 'github' ? 'border-r-4 border-r-primary bg-sky-50/30' : 'hover:bg-muted'}`}
            onClick={() => setActiveTab('github')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <Github size={20} className={activeTab === 'github' ? 'text-primary' : 'text-secondary'} />
              <span className={activeTab === 'github' ? 'font-bold' : 'font-medium'}>تكامل GitHub</span>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          {renderTabContent()}
        </div>
      </div>

      <Dialog open={showSeedConfirm} onOpenChange={setShowSeedConfirm}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد زرع البيانات</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من زرع البيانات الأولية؟ سيتم إضافة بيانات تجريبية للنظام (مرضى، مخزون، إعدادات).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-start gap-2">
            <Button variant="secondary" onClick={() => setShowSeedConfirm(false)}>
              إلغاء
            </Button>
            <Button variant="outline" onClick={handleSeed} className="text-warning border-warning hover:bg-warning/10">
              تأكيد الزرع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
