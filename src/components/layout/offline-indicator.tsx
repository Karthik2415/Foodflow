'use client';

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { getPendingOrders, OfflineOrderPayload } from '@/lib/offline/offline-queue';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingQueue, setPendingQueue] = useState<OfflineOrderPayload[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check offline queue
    getPendingOrders()
      .then((orders) => setPendingQueue(orders.filter((o) => o.status === 'pending')))
      .catch(() => {});

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && pendingQueue.length === 0) return null;

  return (
    <div
      className={`fixed bottom-4 left-4 z-50 flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold shadow-dropdown transition-all ${
        !isOnline
          ? 'bg-amber-500 text-white animate-pulse'
          : 'bg-primary-600 text-white'
      }`}
    >
      {!isOnline ? (
        <>
          <WifiOff className="h-4 w-4" />
          <span>Offline Mode Active • Orders stored locally</span>
        </>
      ) : (
        <>
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Syncing {pendingQueue.length} offline orders...</span>
        </>
      )}
    </div>
  );
}
