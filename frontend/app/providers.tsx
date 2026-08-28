'use client';

import React from 'react';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'react-hot-toast';
import { EmailProvider } from '@/lib/emailContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <EmailProvider>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 3000,
            style: {
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: '0.8125rem',
              borderRadius: '0.5rem',
              padding: '10px 14px',
              color: '#1e293b',
              background: '#ffffff',
              boxShadow: '0 4px 14px rgb(0 0 0 / 0.08)',
              border: '1px solid #f1f5f9',
            },
            success: {
              iconTheme: { primary: '#16a34a', secondary: '#ffffff' },
            },
            error: {
              iconTheme: { primary: '#dc2626', secondary: '#ffffff' },
            },
          }}
        />
      </EmailProvider>
    </SessionProvider>
  );
}
