/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './components/AppSidebar';
import { Toaster } from '@/components/ui/sonner';
import { Loader2 } from 'lucide-react';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Patients = lazy(() => import('./pages/Patients'));
const Appointments = lazy(() => import('./pages/Appointments'));
const Clinic = lazy(() => import('./pages/Clinic'));
const Lab = lazy(() => import('./pages/Lab'));
const Radiology = lazy(() => import('./pages/Radiology'));
const Doctors = lazy(() => import('./pages/Doctors'));
const Pharmacy = lazy(() => import('./pages/Pharmacy'));
const Billing = lazy(() => import('./pages/Billing'));
const HR = lazy(() => import('./pages/HR'));
const Settings = lazy(() => import('./pages/Settings'));
const Reports = lazy(() => import('./pages/Reports'));
const Services = lazy(() => import('./pages/Services'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const PatientDashboard = lazy(() => import('./pages/PatientPortal/Dashboard'));
const PatientAppointments = lazy(() => import('./pages/PatientPortal/Appointments'));
const PatientRecords = lazy(() => import('./pages/PatientPortal/Records'));
const PatientMessages = lazy(() => import('./pages/PatientPortal/Messages'));
const PatientProfile = lazy(() => import('./pages/PatientPortal/Profile'));

import PWAManager from './components/PWAManager';
import { useSync } from './hooks/useSync';

import { seedLabCatalog } from './lib/seedLab';
import { seedPharmacyAndRadiology } from './lib/seedData';

const PageLoader = () => (
  <div className="flex-1 flex items-center justify-center p-12">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
      <p className="text-muted-foreground animate-pulse text-sm">جاري تحميل الصفحة...</p>
    </div>
  </div>
);

function AppContent() {
  const { user, loading, profile } = useAuth();
  useSync();

  React.useEffect(() => {
    if (user && profile?.role === 'admin') {
      seedLabCatalog();
      seedPharmacyAndRadiology();
    }
  }, [user, profile]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground animate-pulse">جاري تحميل النظام...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <SidebarProvider>
      <PWAManager />
      <div className="flex min-h-screen w-full bg-background" dir="rtl">
        <AppSidebar />
        <main className="flex-1 flex flex-col p-6 gap-6 overflow-auto relative">
          <header className="flex justify-between items-center bg-white px-6 py-4 rounded-xl border border-border shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-secondary hover:text-primary transition-colors" />
              <div className="h-8 w-px bg-border mx-2" />
              <div>
                <h1 className="text-xl font-bold text-foreground">مرحباً، {profile?.displayName || 'د. أحمد علي'}</h1>
                <p className="text-[0.85rem] text-secondary">
                  {new Intl.DateTimeFormat('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date())}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-left">
                <p className="font-semibold text-[0.9rem] leading-tight">{profile?.displayName || 'أحمد علي'}</p>
                <p className="text-[0.75rem] text-secondary">{profile?.role === 'admin' ? 'المدير الطبي' : profile?.role}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-100 border border-border flex items-center justify-center font-bold text-primary shadow-sm">
                {profile?.displayName?.substring(0, 2) || 'أ.ع'}
              </div>
            </div>
          </header>
          <div className="flex-1 flex flex-col gap-6">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={profile?.role === 'patient' ? <Navigate to="/patient" replace /> : <Dashboard />} />
                <Route path="/patients" element={<Patients />} />
                <Route path="/appointments" element={<Appointments />} />
                <Route path="/clinic" element={<Clinic />} />
                <Route path="/doctors" element={<Doctors />} />
                <Route path="/lab" element={<Lab />} />
                <Route path="/radiology" element={<Radiology />} />
                <Route path="/pharmacy" element={<Pharmacy />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/services" element={<Services />} />
                <Route path="/audit-logs" element={<AuditLogs />} />
                <Route path="/hr" element={<HR />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
                
                {/* Patient Portal Routes */}
                <Route path="/patient" element={<PatientDashboard />} />
                <Route path="/patient/appointments" element={<PatientAppointments />} />
                <Route path="/patient/records" element={<PatientRecords />} />
                <Route path="/patient/messages" element={<PatientMessages />} />
                <Route path="/patient/profile" element={<PatientProfile />} />
                
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </div>
        </main>
      </div>
      <Toaster position="top-center" />
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}
