'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { ComposeView } from '@/components/ComposeView';
import { useEmails } from '@/lib/emailContext';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const { searchQuery, setSearchQuery, refreshEmails } = useEmails();

  const [composeOpen, setComposeOpen] = useState(false);

  // Redirect unauthenticated users to login in production
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="h-screen w-screen bg-white flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-slate-800 antialiased font-sans">
      {/* Left Sidebar */}
      <Sidebar onOpenCompose={() => setComposeOpen(true)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header Bar (Matching Screenshot 4) */}
        <header className="px-8 py-3.5 border-b border-slate-100 flex items-center gap-4 bg-white shrink-0">
          {/* Search bar with rounded pill style */}
          <div className="relative flex-1 max-w-xl">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" strokeWidth="1.75" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search by subject or recipient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200/80 rounded-full text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Action Icons: Refresh */}
          <div className="flex items-center gap-2 text-slate-400">
            <button
              onClick={() => refreshEmails()}
              className="p-1.5 hover:text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              title="Refresh live data from server"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Full Compose View */}
      <ComposeView isOpen={composeOpen} onClose={() => setComposeOpen(false)} />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen bg-white flex items-center justify-center">
          <div className="animate-spin w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full" />
        </div>
      }
    >
      <DashboardContent>{children}</DashboardContent>
    </Suspense>
  );
}
