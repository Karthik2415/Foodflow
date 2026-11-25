'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { AppShell } from '@/components/layout/app-shell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary-600 animate-pulse" />
          <div className="skeleton h-4 w-32 rounded" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <AppShell userRole={user.role} userName={user.displayName} userEmail={user.email}>
      {children}
    </AppShell>
  );
}

