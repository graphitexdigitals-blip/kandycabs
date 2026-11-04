'use client';

import React from 'react';
import { AuthProvider } from '@/lib/AuthContext';
import { BreakdownAlertModal } from './BreakdownAlertModal';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <BreakdownAlertModal />
    </AuthProvider>
  );
}
