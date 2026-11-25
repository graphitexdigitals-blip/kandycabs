'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { BreakdownAlertModal } from './BreakdownAlertModal';
import { CancellationAlertModal } from './CancellationAlertModal';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [showSlowNotice, setShowSlowNotice] = React.useState(false);

  const isLoginPage = pathname === '/login';

  // Safety timer to show manual bypass/redirect if check takes > 2.5s
  useEffect(() => {
    if (isLoading && !isLoginPage) {
      const timer = setTimeout(() => {
        setShowSlowNotice(true);
      }, 2500);
      return () => clearTimeout(timer);
    } else {
      setShowSlowNotice(false);
    }
  }, [isLoading, isLoginPage]);

  useEffect(() => {
    if (!isLoading && !user && !isLoginPage) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, user, isLoginPage, pathname, router]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-3 border-[#F95700] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Checking authorization...</p>
          {showSlowNotice && (
            <div className="pt-2 flex flex-col items-center space-y-2">
              <a
                href="/login"
                className="text-xs text-[#F95700] font-medium hover:underline px-3 py-1.5 rounded-md bg-orange-50 border border-orange-200"
              >
                Go to Login &rarr;
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-3 border-[#F95700] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      <BreakdownAlertModal />
      <CancellationAlertModal />
    </>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuard>{children}</AuthGuard>
    </AuthProvider>
  );
}
