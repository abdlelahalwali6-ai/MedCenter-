import React, { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './components/AppSidebar';
import { Toaster } from '@/components/ui/sonner';
import { Loader2 } from 'lucide-react';

import { AppHeader } from './components/AppHeader';
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
import InstallPrompt from './components/InstallPrompt';
import AppInitializer from './components/AppInitializer';
import { useSync } from './hooks/useSync';

import { seedLabCatalog } from './lib/seedLab';
import { seedCatalogs, seedStaff } from './lib/seedData';
import { seedPatientsAndRecords } from './lib/seedPatients';

const PageLoader = () => (
  <div className="flex-1 flex items-center justify-center p-12">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
      <p className="text-muted-foreground animate-pulse text-sm">جاري تحميل الصفحة...</p>
    </div>
  </div>
);

function AppContent() {
  const { user, loading, profile, isPatient, isAdmin } = useAuth();
  const [seedingComplete, setSeedingComplete] = useState(false);
  useSync();

  useEffect(() => {
    const performSeeding = async () => {
      if (isAdmin && !seedingComplete) {
        console.log('Admin user detected, starting comprehensive database seeding...');
        setSeedingComplete(true); // Set to true immediately to prevent re-runs
        
        // Run sequentially to ensure dependencies are met (e.g., staff exists before creating records)
        await seedCatalogs();
        await seedLabCatalog();
        await seedStaff();
        await seedPatientsAndRecords(); // This depends on staff and catalogs

        console.log('Comprehensive database seeding process complete.');
      }
    };
    if (user && profile) {
        performSeeding();
    }
  }, [user, profile, isAdmin, seedingComplete]);

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

  return (
    <SidebarProvider>
      <PWAManager />
      <InstallPrompt />
      <AppInitializer />
      <Routes>
        <Route path="/login" element={<Suspense fallback={<PageLoader />}><Login /></Suspense>} />
        <Route
          path="/*"
          element={user ? <MainAppLayout isPatient={isPatient} /> : <Navigate to="/login" replace />}
        />
      </Routes>
      <Toaster position="top-center" />
    </SidebarProvider>
  );
}

function MainAppLayout({ isPatient }) {
  return (
    <div className="flex min-h-screen w-full bg-background" dir="rtl">
      <AppSidebar />
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden relative">
        <AppHeader />
        <div className="flex-1 overflow-auto bg-[#F8FAFC] p-4 lg:p-8">
          <div className="mx-auto w-full max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={isPatient ? <Navigate to="/patient" replace /> : <Dashboard />} />
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
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}
