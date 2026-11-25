'use client';

import { AuthProvider } from '@/lib/auth/auth-context';
import { StoreProvider } from '@/lib/store/store-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <StoreProvider>
        {children}
      </StoreProvider>
    </AuthProvider>
  );
}

