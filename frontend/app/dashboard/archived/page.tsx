'use client';

import React, { useState } from 'react';
import { useEmails } from '@/lib/emailContext';
import { ScheduledEmailItem } from '@/lib/api';
import { EmailDetailModal } from '@/components/EmailDetailModal';
import toast from 'react-hot-toast';

export default function ArchivedEmailsPage() {
  const { archivedEmails, unarchiveEmail, loading } = useEmails();
  const [selectedEmail, setSelectedEmail] = useState<ScheduledEmailItem | null>(null);

  const formatTime = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-slate-800">Archived Emails</h2>
          <span className="text-xs text-slate-400 font-normal">({archivedEmails.length})</span>
        </div>
      </div>

      {/* Main List Body */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading archived emails...</div>
        ) : archivedEmails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 select-none">
            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-slate-700">No archived emails</p>
            <p className="text-[11px] text-slate-400 max-w-xs mt-1">
              Emails you archive will appear here. You can restore them anytime back to your active list.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {archivedEmails.map((email) => {
              const recipientName = email.recipient.split('@')[0];
              return (
                <div
                  key={email.id}
                  onClick={() => setSelectedEmail(email)}
                  className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50 cursor-pointer transition-colors group select-none text-xs"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    {/* Recipient */}
                    <span className="font-medium text-slate-800 w-32 truncate shrink-0">
                      To: {recipientName}
                    </span>

                    {/* Archived Badge */}
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 shrink-0">
                      Archived
                    </span>

                    {/* Subject snippet */}
                    <div className="truncate flex-1 text-slate-600">
                      <span className="font-semibold text-slate-800 mr-1.5">{email.subject}</span>
                      <span className="text-slate-400">- {email.body?.slice(0, 80)}...</span>
                    </div>
                  </div>

                  {/* Right side: Restore Button & Date */}
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="text-[11px] text-slate-400">
                      {formatTime(email.sentAt || email.scheduledFor || email.createdAt)}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        unarchiveEmail(email.id);
                      }}
                      className="px-2.5 py-1 rounded-md text-[11px] font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors flex items-center gap-1"
                      title="Restore back to active list"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      Restore
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedEmail && (
        <EmailDetailModal
          email={selectedEmail}
          onClose={() => setSelectedEmail(null)}
        />
      )}
    </div>
  );
}
