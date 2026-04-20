
import { useSync } from '../hooks/useSync';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { SyncService } from '../lib/syncService';
import { useAuth } from '../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function SyncStatus({ collapsed }: { collapsed?: boolean }) {
  const { isOnline, lastSync } = useSync();
  const { user, profile } = useAuth();

  const handleManualSync = () => {
    if (isOnline) {
      SyncService.syncAll(profile?.role, user?.uid);
    }
  };

  if (collapsed) {
    return (
      <div className="flex items-center justify-center py-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                {isOnline ? (
                  <Wifi className="h-5 w-5 text-green-500" />
                ) : (
                  <WifiOff className="h-5 w-5 text-red-500" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>{isOnline ? 'متصل' : 'غير متصل'}</p>
              {lastSync && (
                <p className="text-xs text-muted-foreground">
                  آخر مزامنة: {formatDistanceToNow(lastSync, { addSuffix: true, locale: ar })}
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center gap-2">
        {isOnline ? (
          <Wifi className="h-5 w-5 text-green-500" />
        ) : (
          <WifiOff className="h-5 w-5 text-red-500" />
        )}
        <span className="text-sm font-medium">
          {isOnline ? 'متصل' : 'غير متصل'}
        </span>
      </div>
      <div className="flex-grow text-center text-xs text-gray-500 dark:text-gray-400">
        {lastSync ? (
          <span>
            آخر مزامنة: {formatDistanceToNow(lastSync, { addSuffix: true, locale: ar })}
          </span>
        ) : (
          'لم تتم المزامنة بعد'
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleManualSync}
        disabled={!isOnline}
        aria-label="Manual Sync"
      >
        <RefreshCw className={`h-4 w-4 ${!isOnline ? 'text-gray-400' : ''}`} />
      </Button>
    </div>
  );
}
