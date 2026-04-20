
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
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
  LayoutGrid,
  ChevronRight,
  ChevronLeft,
  Search,
  Zap,
  ShieldCheck,
  History,
  TrendingUp,
  Star
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
  useSidebar,
} from '@/components/ui/sidebar';
import { Link, useLocation } from 'react-router-dom';
import { auth } from '@/src/lib/firebase';
import { signOut } from 'firebase/auth';
import { SyncStatus } from './SyncStatus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function AppSidebar() {
  const { profile, isAdmin, isDoctor, isNurse, isPharmacist, isLabTech, isReceptionist, isPatient } = useAuth();
  const location = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === 'collapsed';
  
  const [sidebarSearch, setSidebarSearch] = useState('');

  // Helper to determine if a user has one of the required roles
  const hasRole = (roles: string[]) => {
    if (isAdmin && roles.includes('admin')) return true;
    if (isDoctor && roles.includes('doctor')) return true;
    if (isNurse && roles.includes('nurse')) return true;
    if (isPharmacist && roles.includes('pharmacist')) return true;
    if (isLabTech && roles.includes('lab_tech')) return true;
    if (isReceptionist && roles.includes('receptionist')) return true;
    if (isPatient && roles.includes('patient')) return true;
    
    // Fallback to profile.role if flags aren't enough (e.g. for 'radiologist')
    if (profile?.role && roles.includes(profile.role)) return true;
    
    return false;
  };

  const mainItems = [
    { title: 'لوحة التحكم', icon: LayoutDashboard, url: '/', roles: ['admin', 'doctor', 'nurse', 'pharmacist', 'lab_tech', 'receptionist'] },
    { title: 'المرضى', icon: Users, url: '/patients', roles: ['admin', 'doctor', 'nurse', 'receptionist'] },
    { title: 'المواعيد', icon: Calendar, url: '/appointments', roles: ['admin', 'doctor', 'nurse', 'receptionist'] },
  ];

  const favoriteItems = [
    { title: 'العيادة', icon: Star, url: '/clinic', roles: ['admin', 'doctor', 'nurse'] },
    { title: 'المالية', icon: CreditCard, url: '/billing', roles: ['admin', 'receptionist'] },
    { title: 'التقارير', icon: TrendingUp, url: '/reports', roles: ['admin', 'doctor'] },
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
    { title: 'سجل الرقابة', icon: History, url: '/audit-logs', roles: ['admin'] },
    { title: 'الإعدادات', icon: Settings, url: '/settings', roles: ['admin'] },
  ];

  const patientItems = [
    { title: 'لوحة التحكم', icon: LayoutDashboard, url: '/patient', roles: ['patient'] },
    { title: 'مواعيدي', icon: Calendar, url: '/patient/appointments', roles: ['patient'] },
    { title: 'سجلاتي الطبية', icon: FileText, url: '/patient/records', roles: ['patient'] },
    { title: 'الرسائل', icon: MessageSquare, url: '/patient/messages', roles: ['patient'] },
    { title: 'الملف الشخصي', icon: UserCircle, url: '/patient/profile', roles: ['patient'] },
  ];

  const filterItems = (items: any[]) => items.filter(item => {
    const roleMatch = hasRole(item.roles);
    const searchMatch = !sidebarSearch || item.title.includes(sidebarSearch);
    return roleMatch && searchMatch;
  });

  const filteredMain = filterItems(mainItems);
  const filteredFavorites = filterItems(favoriteItems);
  const filteredMedical = filterItems(medicalItems);
  const filteredAdmin = filterItems(adminItems);
  const filteredSystem = filterItems(systemItems);
  const filteredPatient = filterItems(patientItems);

  return (
    <Sidebar side="right" collapsible="icon" className="border-l border-border bg-sidebar h-svh">
      <SidebarHeader className="px-3 pt-6 pb-2 border-b border-border/50">
        <div className="flex items-center justify-between mb-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mb-0">
          <div className="flex items-center gap-3 overflow-hidden group-data-[collapsible=icon]:hidden">
            <div className="flex-shrink-0 w-9 h-9 bg-primary rounded-xl shadow-lg shadow-primary/30 flex items-center justify-center text-white ring-4 ring-primary/10">
              <Activity size={20} className="animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base text-slate-800 leading-tight tracking-tighter">مد كير الطبي</span>
              <span className="text-[0.55rem] text-muted-foreground font-black uppercase tracking-[0.15em]">INTEGRATED CARE</span>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleSidebar}
            className="h-8 w-8 text-slate-400 hover:bg-slate-100 hover:text-primary rounded-lg transition-all group-data-[collapsible=icon]:hidden"
          >
            {isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </Button>
        </div>

        <div className="relative group-data-[collapsible=icon]:hidden mb-2">
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <Input 
            placeholder="بحث سريع..." 
            className="h-8 pr-8 pl-2 text-[0.7rem] bg-slate-100/50 border-none focus-visible:ring-1 focus-visible:ring-primary/20 rounded-lg"
            value={sidebarSearch}
            onChange={e => setSidebarSearch(e.target.value)}
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="py-2 gap-0 px-2 no-scrollbar">
        {!isPatient ? (
          <>
            <SidebarGroup className="py-2">
              <SidebarGroupLabel className="px-3 text-[0.6rem] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 group-data-[collapsible=icon]:hidden">الاختصارات</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  {filteredFavorites.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        render={<Link to={item.url} />}
                        isActive={location.pathname === item.url}
                        tooltip={item.title}
                        className={`
                          h-10 flex items-center gap-3 rounded-lg transition-all duration-200 group-data-[collapsible=icon]:justify-center px-3
                          ${location.pathname === item.url 
                            ? 'bg-primary/10 text-primary font-bold' 
                            : 'text-slate-600 hover:bg-slate-50 hover:text-primary'}
                        `}
                      >
                        <item.icon size={18} strokeWidth={2.5} className="flex-shrink-0" />
                        <span className="text-[0.85rem] group-data-[collapsible=icon]:hidden">{item.title}</span>
                        {location.pathname === item.url && !isCollapsed && (
                          <div className="mr-auto w-1 h-4 bg-primary rounded-full" />
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="py-2">
              <SidebarGroupLabel className="px-3 text-[0.6rem] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 group-data-[collapsible=icon]:hidden">الرئيسية</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  {filteredMain.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        render={<Link to={item.url} />}
                        isActive={location.pathname === item.url}
                        tooltip={item.title}
                        className={`
                          h-10 flex items-center gap-3 rounded-lg transition-all duration-200 group-data-[collapsible=icon]:justify-center px-3
                          ${location.pathname === item.url 
                            ? 'bg-primary/10 text-primary font-bold' 
                            : 'text-slate-600 hover:bg-slate-50 hover:text-primary'}
                        `}
                      >
                        <item.icon size={18} strokeWidth={2.5} className="flex-shrink-0" />
                        <span className="text-[0.85rem] group-data-[collapsible=icon]:hidden">{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {filteredMedical.length > 0 && (
              <SidebarGroup className="py-2">
                <SidebarGroupLabel className="px-3 text-[0.6rem] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 mt-2 group-data-[collapsible=icon]:hidden">الأقسام الطبية</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-1">
                    {filteredMedical.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton 
                          render={<Link to={item.url} />}
                          isActive={location.pathname === item.url}
                          tooltip={item.title}
                          className={`
                            h-10 flex items-center gap-3 rounded-lg transition-all duration-200 group-data-[collapsible=icon]:justify-center px-3
                            ${location.pathname === item.url 
                              ? 'bg-primary/10 text-primary font-bold' 
                              : 'text-slate-600 hover:bg-slate-50 hover:text-primary'}
                          `}
                        >
                          <item.icon size={18} strokeWidth={2.5} className="flex-shrink-0" />
                          <span className="text-[0.85rem] group-data-[collapsible=icon]:hidden">{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {filteredAdmin.length > 0 && (
              <SidebarGroup className="py-2">
                <SidebarGroupLabel className="px-3 text-[0.6rem] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 mt-2 group-data-[collapsible=icon]:hidden">الإدارة والمالية</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-1">
                    {filteredAdmin.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton 
                          render={<Link to={item.url} />}
                          isActive={location.pathname === item.url}
                          tooltip={item.title}
                          className={`
                            h-10 flex items-center gap-3 rounded-lg transition-all duration-200 group-data-[collapsible=icon]:justify-center px-3
                            ${location.pathname === item.url 
                              ? 'bg-primary/10 text-primary font-bold' 
                              : 'text-slate-600 hover:bg-slate-50 hover:text-primary'}
                          `}
                        >
                          <item.icon size={18} strokeWidth={2.5} className="flex-shrink-0" />
                          <span className="text-[0.85rem] group-data-[collapsible=icon]:hidden">{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {filteredSystem.length > 0 && (
              <SidebarGroup className="py-2">
                <SidebarGroupLabel className="px-3 text-[0.6rem] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 mt-2 group-data-[collapsible=icon]:hidden">التقارير والنظام</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-1">
                    {filteredSystem.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton 
                          render={<Link to={item.url} />}
                          isActive={location.pathname === item.url}
                          tooltip={item.title}
                          className={`
                            h-10 flex items-center gap-3 rounded-lg transition-all duration-200 group-data-[collapsible=icon]:justify-center px-3
                            ${location.pathname === item.url 
                              ? 'bg-primary/10 text-primary font-bold' 
                              : 'text-slate-600 hover:bg-slate-50 hover:text-primary'}
                          `}
                        >
                          <item.icon size={18} strokeWidth={2.5} className="flex-shrink-0" />
                          <span className="text-[0.85rem] group-data-[collapsible=icon]:hidden">{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </>
        ) : (
          <SidebarGroup className="py-4">
            <SidebarGroupLabel className="px-3 text-[0.6rem] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 group-data-[collapsible=icon]:hidden">بوابة المريض الذكية</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-2">
                {filteredPatient.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      render={<Link to={item.url} />}
                      isActive={location.pathname === item.url}
                      tooltip={item.title}
                      className={`
                        h-12 flex items-center gap-3 rounded-xl transition-all duration-200 group-data-[collapsible=icon]:justify-center px-4
                        ${location.pathname === item.url 
                          ? 'bg-primary text-white shadow-lg shadow-primary/25 font-bold' 
                          : 'text-slate-600 hover:bg-slate-50'}
                      `}
                    >
                      <item.icon size={20} strokeWidth={2.5} className="flex-shrink-0" />
                      <span className="text-[0.95rem] group-data-[collapsible=icon]:hidden">{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="mt-auto border-t border-border/50 bg-slate-50/50 p-2">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-white border border-border/60 shadow-sm group-data-[collapsible=icon]:p-1.5 group-data-[collapsible=icon]:justify-center transition-all duration-300">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-sky-600 flex items-center justify-center font-black text-white text-[0.6rem] shadow-sm transform transition-transform hover:scale-105">
            {profile?.displayName?.substring(0, 2) || 'أ.ع'}
          </div>
          <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="font-bold text-[0.7rem] truncate text-slate-800 leading-tight mb-0.5">{profile?.displayName || 'مستخدم'}</span>
            <div className="flex items-center gap-1">
              <ShieldCheck size={10} className="text-emerald-500" />
              <span className="text-[0.55rem] text-slate-500 truncate font-semibold uppercase tracking-tight">{profile?.role}</span>
            </div>
          </div>
        </div>
        
        <div className="mt-2">
          <SyncStatus collapsed={isCollapsed} />
        </div>

        <SidebarMenu className="mt-2">
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={() => signOut(auth)} 
              tooltip="تسجيل الخروج الآمن"
              className="text-danger hover:bg-danger/5 h-9 rounded-lg group-data-[collapsible=icon]:justify-center px-3"
            >
              <LogOut size={16} strokeWidth={2.5} />
              <span className="text-[0.75rem] font-bold group-data-[collapsible=icon]:hidden">تسجيل الخروج</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="mt-1 px-2 py-1 text-[0.5rem] text-slate-400 text-center font-bold opacity-60 group-data-[collapsible=icon]:hidden">
          V 2.5.0 • SECURED BY AI
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
