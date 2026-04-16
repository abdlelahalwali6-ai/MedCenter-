/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './components/AppSidebar';
import { Toaster } from '@/components/ui/sonner';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Appointments from './pages/Appointments';
import Clinic from './pages/Clinic';
import Lab from './pages/Lab';
import Radiology from './pages/Radiology';
import Doctors from './pages/Doctors';
import Pharmacy from './pages/Pharmacy';
import Billing from './pages/Billing';
import HR from './pages/HR';
import Settings from './pages/Settings';
import Reports from './pages/Reports';
import Services from './pages/Services';
import AuditLogs from './pages/AuditLogs';
import PatientDashboard from './pages/PatientPortal/Dashboard';
import PatientAppointments from './pages/PatientPortal/Appointments';
import PatientRecords from './pages/PatientPortal/Records';
import PatientMessages from './pages/PatientPortal/Messages';
import PatientProfile from './pages/PatientPortal/Profile';
import PWAManager from './components/PWAManager';

import { seedLabCatalog } from './lib/seedLab';
import { seedPharmacyAndRadiology } from './lib/seedData';

function AppContent() {
  const { user, loading, profile } = useAuth();

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
