'use client';

import type { ReactNode } from 'react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

interface PageShellProps {
  children: ReactNode;
  showNavbar?: boolean;
  showFooter?: boolean;
}

export function PageShell({ children, showNavbar = true, showFooter = true }: PageShellProps) {
  return (
    <div className="min-h-screen bg-[var(--page)] text-[var(--ink)]">
      {showNavbar ? <Navbar /> : null}
      <ErrorBoundary>{children}</ErrorBoundary>
      {showFooter ? <Footer /> : null}
    </div>
  );
}
