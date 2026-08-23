'use client';

import { useEffect, useState } from 'react';
import { useUIStore } from '@/lib/stores/ui-store';
import { WifiOff } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

export function OfflineBanner() {
  const { isOffline, setOffline } = useUIStore();
  const [showExpiryWarning, setShowExpiryWarning] = useState(false);

  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);

    setOffline(!navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOffline]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    async function checkExpiryWarning() {
      if (!isOffline) {
        setShowExpiryWarning(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.expires_at) {
        setShowExpiryWarning(false);
        return;
      }

      const msLeft = session.expires_at * 1000 - Date.now();
      setShowExpiryWarning(msLeft > 0 && msLeft <= 60 * 60 * 1000);
    }

    void checkExpiryWarning();
    interval = setInterval(() => {
      void checkExpiryWarning();
    }, 60_000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOffline]);

  if (!isOffline) return null;

  return (
    <div role="status" className="sticky top-0 z-50 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-white">
      <WifiOff className="mr-2 inline-block h-4 w-4" />
      You are offline. Changes will sync when you reconnect.
      {showExpiryWarning && ' Your session will expire soon. Go online to stay logged in.'}
    </div>
  );
}
