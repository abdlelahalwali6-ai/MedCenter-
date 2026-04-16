/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Stethoscope, 
  FlaskConical, 
  Image as ImageIcon, 
  Pill, 
  CreditCard, 
  Settings, 
  LogOut,
  UserCircle,
  ClipboardList,
  Activity,
  MessageSquare,
  FileText,
  LayoutGrid
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar';
import { Link, useLocation } from 'react-router-dom';
import { auth } from '@/src/lib/firebase';
import { signOut } from 'firebase/auth';
import { SyncStatus } from './SyncStatus';

export function AppSidebar() {
  const { profile, isAdmin, isDoctor, isNurse, isPharmacist, isLabTech, isReceptionist } = useAuth();
  const location = useLocation();

  const mainItems = [
    { title: 'لوحة التحكم', icon: LayoutDashboard, url: '/', roles: ['admin', 'doctor', 'nurse', 'pharmacist', 'lab_tech', 'receptionist'] },
    { title: 'المرضى', icon: Users, url: '/patients', roles: ['admin', 'doctor', 'nurse', 'receptionist'] },
    { title: 'المواعيد', icon: Calendar, url: '/appointments', roles: ['admin', 'doctor', 'nurse', 'receptionist'] },
  ];

  const medicalItems = [
    { title: 'العيادة', icon: Stethoscope, url: '/clinic', roles: ['admin', 'doctor', 'nurse'] },
    { title: 'المختبر', icon: FlaskConical, url: '/lab', roles: ['admin', 'lab_tech', 'doctor'] },
    { title: 'الأشعة', icon: ImageIcon, url: '/radiology', roles: ['admin', 'lab_tech', 'doctor'] },
    { title: 'الصيدلية', icon: Pill, url: '/pharmacy', roles: ['admin', 'pharmacist', 'doctor'] },
    { title: 'الطوارئ', icon: Activity, url: '/emergency', roles: ['admin', 'doctor', 'nurse'] },
  ];

  const adminItems = [
    { title: 'الأطباء', icon: UserCircle, url: '/doctors', roles: ['admin'] },
    { title: 'الخدمات', icon: LayoutGrid, url: '/services', roles: ['admin', 'receptionist', 'doctor', 'nurse'] },
    { title: 'المالية', icon: CreditCard, url: '/billing', roles: ['admin', 'receptionist'] },
    { title: 'الموارد البشرية', icon: UserCircle, url: '/hr', roles: ['admin'] },
  ];

  const systemItems = [
    { title: 'التقارير', icon: ClipboardList, url: '/reports', roles: ['admin', 'doctor'] },
    { title: 'سجل الرقابة', icon: Activity, url: '/audit-logs', roles: ['admin'] },
    { title: 'الإعدادات', icon: Settings, url: '/settings', roles: ['admin'] },
  ];

  const patientItems = [
    { title: 'لوحة التحكم', icon: LayoutDashboard, url: '/patient', roles: ['patient'] },
    { title: 'مواعيدي', icon: Calendar, url: '/patient/appointments', roles: ['patient'] },
    { title: 'سجلاتي الطبية', icon: FileText, url: '/patient/records', roles: ['patient'] },
    { title: 'الرسائل', icon: MessageSquare, url: '/patient/messages', roles: ['patient'] },
    { title: 'الملف الشخصي', icon: UserCircle, url: '/patient/profile', roles: ['patient'] },
  ];

  const filterItems = (items: any[]) => items.filter(item => profile?.role && item.roles.includes(profile.role));

  const filteredMain = filterItems(mainItems);
  const filteredMedical = filterItems(medicalItems);
  const filteredAdmin = filterItems(adminItems);
  const filteredSystem = filterItems(systemItems);
  const filteredPatient = filterItems(patientItems);

  return (
    <Sidebar side="right" className="border-l border-border bg-sidebar">
      <SidebarHeader className="px-6 py-8 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg shadow-sm shadow-primary/20" />
          <div className="flex flex-col">
            <span className="font-extrabold text-xl text-primary tracking-tight">مركز رعاية المريض</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="py-4">
        {profile?.role !== 'patient' ? (
          <>
            <SidebarGroup>
              <SidebarGroupLabel className="px-6 text-xs font-bold text-secondary uppercase tracking-widest mb-2">الرئيسية</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredMain.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        render={<Link to={item.url} />}
                        isActive={location.pathname === item.url}
                        className={`
                          px-6 py-6 flex items-center gap-3 transition-all duration-200
                          ${location.pathname === item.url 
                            ? 'bg-sky-50 text-primary border-r-4 border-primary font-semibold' 
                            : 'text-secondary hover:bg-slate-50'}
                        `}
                      >
                        <item.icon size={20} />
                        <span className="text-[0.95rem]">{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {filteredMedical.length > 0 && (
              <SidebarGroup className="mt-4">
                <SidebarGroupLabel className="px-6 text-xs font-bold text-secondary uppercase tracking-widest mb-2">الأقسام الطبية</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filteredMedical.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton 
                          render={<Link to={item.url} />}
                          isActive={location.pathname === item.url}
                          className={`
                            px-6 py-6 flex items-center gap-3 transition-all duration-200
                            ${location.pathname === item.url 
                              ? 'bg-sky-50 text-primary border-r-4 border-primary font-semibold' 
                              : 'text-secondary hover:bg-slate-50'}
                          `}
                        >
                          <item.icon size={20} />
                          <span className="text-[0.95rem]">{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {filteredAdmin.length > 0 && (
              <SidebarGroup className="mt-4">
                <SidebarGroupLabel className="px-6 text-xs font-bold text-secondary uppercase tracking-widest mb-2">الإدارة والخدمات</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filteredAdmin.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton 
                          render={<Link to={item.url} />}
                          isActive={location.pathname === item.url}
                          className={`
                            px-6 py-6 flex items-center gap-3 transition-all duration-200
                            ${location.pathname === item.url 
                              ? 'bg-sky-50 text-primary border-r-4 border-primary font-semibold' 
                              : 'text-secondary hover:bg-slate-50'}
                          `}
                        >
                          <item.icon size={20} />
                          <span className="text-[0.95rem]">{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {filteredSystem.length > 0 && (
              <SidebarGroup className="mt-4">
                <SidebarGroupLabel className="px-6 text-xs font-bold text-secondary uppercase tracking-widest mb-2">النظام والتقارير</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filteredSystem.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton 
                          render={<Link to={item.url} />}
                          isActive={location.pathname === item.url}
                          className={`
                            px-6 py-6 flex items-center gap-3 transition-all duration-200
                            ${location.pathname === item.url 
                              ? 'bg-sky-50 text-primary border-r-4 border-primary font-semibold' 
                              : 'text-secondary hover:bg-slate-50'}
                          `}
                        >
                          <item.icon size={20} />
                          <span className="text-[0.95rem]">{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </>
        ) : (
          <SidebarGroup>
            <SidebarGroupLabel className="px-6 text-xs font-bold text-secondary uppercase tracking-widest mb-2">بوابة المريض</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredPatient.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      render={<Link to={item.url} />}
                      isActive={location.pathname === item.url}
                      className={`
                        px-6 py-6 flex items-center gap-3 transition-all duration-200
                        ${location.pathname === item.url 
                          ? 'bg-sky-50 text-primary border-r-4 border-primary font-semibold' 
                          : 'text-secondary hover:bg-slate-50'}
                      `}
                    >
                      <item.icon size={20} />
                      <span className="text-[0.95rem]">{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="mt-auto border-t border-border bg-slate-50/50 p-4">
        <div className="flex items-center gap-2 text-[0.75rem] text-secondary mb-4 px-2">
          <span>🔒 نظام مشفر ومتوافق مع HIPAA</span>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-white border border-border mb-4">
          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-primary">
            {profile?.displayName?.substring(0, 2) || 'أ.ع'}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="font-semibold text-sm truncate">{profile?.displayName || 'مستخدم'}</span>
            <span className="text-[0.75rem] text-secondary truncate">{profile?.role}</span>
          </div>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => signOut(auth)} className="text-danger hover:text-danger hover:bg-danger/10 px-4">
              <LogOut size={18} />
              <span className="text-sm">تسجيل الخروج</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="mt-4 -mx-4 -mb-4">
          <SyncStatus />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
