import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Database, Cloud, RefreshCw } from 'lucide-react';
import { localDB } from '@/src/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { cn } from '@/lib/utils';

export function SyncStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  
  const patientCount = useLiveQuery(() => localDB.patients.count());
  const inventoryCount = useLiveQuery(() => localDB.inventory.count());

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 border-t border-border mt-auto">
      <div className="flex items-center gap-2">
        {isOnline ? (
          <div className="flex items-center gap-1.5 text-emerald-600">
            <Wifi size={14} />
            <span className="text-[0.7rem] font-bold">متصل</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-rose-600">
            <WifiOff size={14} />
            <span className="text-[0.7rem] font-bold">أوفلاين</span>
          </div>
        )}
      </div>

      <div className="h-4 w-px bg-slate-200" />

      <div className="flex items-center gap-2 text-slate-500">
        <Database size={14} className="text-primary" />
        <span className="text-[0.7rem] font-medium">
          {patientCount || 0} مرضى | {inventoryCount || 0} أصناف
        </span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1 text-[0.65rem] text-slate-400">
        <RefreshCw size={10} className={cn("animate-spin-slow", isOnline && "animate-spin")} />
        <span>قاعدة البيانات المحلية نشطة</span>
      </div>
    </div>
  );
}
