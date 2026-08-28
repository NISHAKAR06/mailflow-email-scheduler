'use client';

import React, { useState } from 'react';
import { useEmails } from '@/lib/emailContext';
import { ScheduledEmailItem } from '@/lib/api';
import { EmailItem } from '@/components/EmailItem';
import { EmailDetailModal } from '@/components/EmailDetailModal';

export default function ScheduledPage() {
  const { scheduledEmails, loading, searchQuery } = useEmails();
  const [selectedEmail, setSelectedEmail] = useState<ScheduledEmailItem | null>(null);

  if (loading && scheduledEmails.length === 0) {
    return (
      <div className="divide-y divide-slate-100">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="px-6 py-4 flex items-center gap-6 animate-pulse">
            <div className="h-3 bg-slate-100 rounded w-28" />
            <div className="h-4 bg-slate-100 rounded-full w-12" />
            <div className="h-3 bg-slate-100 rounded flex-1" />
          </div>
        ))}
      </div>
    );
  }

  if (scheduledEmails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-3">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
            <polyline points="12 6 12 12 16 14" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <p className="text-xs font-semibold text-slate-700">
          {searchQuery ? `No scheduled emails match "${searchQuery}"` : 'No scheduled emails'}
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          {searchQuery
            ? 'Try another search query.'
            : "Click 'Compose' to schedule a new email campaign via BullMQ."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="divide-y divide-slate-100">
        {scheduledEmails.map((email) => (
          <EmailItem
            key={email.id}
            email={email}
            onClick={() => setSelectedEmail(email)}
          />
        ))}
      </div>

      <EmailDetailModal
        email={selectedEmail}
        onClose={() => setSelectedEmail(null)}
      />
    </>
  );
}
