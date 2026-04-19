import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Database, Cloud, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { localDB } from '@/src/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { cn } from '@/lib/utils';
import { useSync } from '@/src/hooks/useSync';
import { SyncService } from '@/src/lib/syncService';
import { useAuth } from '@/src/context/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function SyncStatus() {
  const { isOnline, lastSync } = useSync();
  const { profile, user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  
  const patientCount = useLiveQuery(() => localDB.patients.count()) || 0;
  const pendingCount = useLiveQuery(async () => {
    // This is a rough estimate of items needing sync by checking metadata
    // In a real app we might have a specific 'outbox' table
    const meta = await localDB.syncMetaData.toArray();
    return meta.length; // Simplified
  }) || 0;

  const handleManualSync = async () => {
    if (isSyncing || !isOnline) return;
    setIsSyncing(true);
    try {
      await SyncService.syncAll(profile?.role, user?.uid);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-4 px-6 py-3 bg-white border-t border-slate-100 mt-auto shadow-[0_-4px_12px_-8px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-4">
          <Tooltip>
            <TooltipTrigger render={
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300",
                isOnline ? "bg-emerald-50 text-emerald-600 shadow-sm shadow-emerald-100/50" : "bg-rose-50 text-rose-600"
              )}>
                {isOnline ? <Wifi size={14} className="animate-pulse" /> : <WifiOff size={14} />}
                <span className="text-[0.7rem] font-black uppercase tracking-wider">{isOnline ? 'متصل سحابياً' : 'وضع الأوفلاين'}</span>
              </div>
            } />
            <TooltipContent>
              <p className="text-xs">{isOnline ? 'النظام متصل بالسحابة وتعمل المزامنة الفورية' : 'أنت تعمل على النسخة المحلية، سيتم المزامنة عند توفر الاتصال'}</p>
            </TooltipContent>
          </Tooltip>

          <div className="flex items-center gap-3 text-slate-400">
            <div className="flex items-center gap-1.5">
              <Database size={14} className="text-secondary" />
              <span className="text-[0.7rem] font-bold text-slate-600">
                {patientCount} سجل محلي
              </span>
            </div>
            <div className="h-3 w-px bg-slate-200" />
            <div className="flex items-center gap-1.5">
              <Cloud size={14} className="text-primary" />
              <span className="text-[0.7rem] font-bold text-slate-600">موثق سحابياً</span>
            </div>
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-1.5">
              {isSyncing ? (
                <span className="text-[0.6rem] font-bold text-primary animate-pulse">جاري المزامنة الآن...</span>
              ) : (
                <span className="text-[0.6rem] font-medium text-slate-400">
                  آخر تحديث: {lastSync ? lastSync.toLocaleTimeString('ar-SA') : 'جاري المزامنة...'}
                </span>
              )}
              {isOnline && !isSyncing && <CheckCircle2 size={10} className="text-emerald-500" />}
            </div>
            <div className="h-1 w-24 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full bg-primary transition-all duration-1000",
                  isSyncing ? "w-full opacity-100" : "w-0 opacity-0"
                )} 
              />
            </div>
          </div>

          <Button 
            variant="ghost" 
            size="icon" 
            className={cn(
              "h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-400 transition-all",
              isSyncing && "text-primary bg-primary/5"
            )}
            onClick={handleManualSync}
            disabled={!isOnline || isSyncing}
          >
            <RefreshCw size={14} className={cn(isSyncing && "animate-spin")} />
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
