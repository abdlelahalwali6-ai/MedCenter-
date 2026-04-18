import { useEffect, useState } from 'react';
import { SyncService } from '@/src/lib/syncService';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

export function useSync() {
  const { user, profile } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('تم استعادة الاتصال بالإنترنت - يتم المزامنة الآن', {
        position: 'bottom-right',
        duration: 3000
      });
      SyncService.syncAll(profile?.role, user?.uid);
      SyncService.startRealtimeSync(profile?.role, user?.uid);
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.error('تم فقدان الاتصال بالإنترنت - أنت تعمل في الوضع المحلي', {
        position: 'bottom-right',
        duration: 5000
      });
      SyncService.stopRealtimeSync();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial logic when user is authenticated
    if (user && isOnline) {
      // 1. Initial full sync for missing items
      SyncService.syncAll(profile?.role, user?.uid).then(() => setLastSync(new Date()));
      
      // 2. Start realtime listeners
      SyncService.startRealtimeSync(profile?.role, user?.uid);
    }

    // Periodic deep sync every 5 minutes (as redundancy)
    const interval = setInterval(() => {
      if (user && isOnline) {
        SyncService.syncAll(profile?.role, user?.uid).then(() => setLastSync(new Date()));
      }
    }, 300000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      SyncService.stopRealtimeSync();
      clearInterval(interval);
    };
  }, [user, isOnline, profile?.role]);

  return { isOnline, lastSync };
}
