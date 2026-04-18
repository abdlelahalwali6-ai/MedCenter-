import { useEffect, useState } from 'react';
import { SyncService } from '@/src/lib/syncService';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

export function useSync() {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('تم استعادة الاتصال بالإنترنت - يتم المزامنة الآن', {
        position: 'bottom-right',
        duration: 3000
      });
      SyncService.syncAll();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.error('تم فقدان الاتصال بالإنترنت - أنت تعمل في الوضع المحلي', {
        position: 'bottom-right',
        duration: 5000
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync if online
    if (user && isOnline) {
      SyncService.syncAll().then(() => setLastSync(new Date()));
    }

    // Periodic sync every 2 minutes
    const interval = setInterval(() => {
      if (user && isOnline) {
        SyncService.syncAll().then(() => setLastSync(new Date()));
      }
    }, 120000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [user, isOnline]);

  return { isOnline, lastSync };
}
