'use client';

import React from 'react';
import { ScheduledEmailItem } from '@/lib/api';
import { useEmails } from '@/lib/emailContext';
import toast from 'react-hot-toast';

interface EmailDetailModalProps {
  email: ScheduledEmailItem | null;
  onClose: () => void;
}

export function EmailDetailModal({ email, onClose }: EmailDetailModalProps) {
  const { starredIds, toggleStar, archiveEmail } = useEmails();

  if (!email) return null;

  const isStarred = starredIds.has(email.id);
  const dateToDisplay = email.sentAt || email.scheduledFor || email.createdAt;
  const formattedDate = new Date(dateToDisplay).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const senderName = email.sender?.name || email.sender?.email?.split('@')[0] || 'Oliver Brown';
  const senderEmail = email.sender?.email || 'sender@example.com';
  const initial = (senderName.charAt(0) || 'A').toUpperCase();

  const handleArchive = () => {
    archiveEmail(email.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-y-auto animate-in fade-in duration-150">
      {/* Top action bar (Matching Screenshot 5) */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-slate-100 bg-white sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-1 text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h2 className="text-sm font-semibold text-slate-800 tracking-tight">
            {email.subject}
          </h2>
        </div>

        {/* Header Icons */}
        <div className="flex items-center gap-4 text-slate-400">
          <button
            onClick={() => toggleStar(email.id)}
            className={`transition-colors ${
              isStarred ? 'text-amber-400 hover:text-amber-500' : 'hover:text-amber-400'
            }`}
            title={isStarred ? 'Unstar' : 'Star'}
          >
            <svg
              className="w-4 h-4"
              fill={isStarred ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
          </button>
          <button onClick={handleArchive} className="hover:text-slate-700 transition-colors" title="Archive">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Email Content */}
      <div className="max-w-4xl w-full mx-auto px-8 py-8 space-y-6">
        {/* Sender info row */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold text-sm flex items-center justify-center">
              {initial}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-800">{senderName}</span>
                <span className="text-[11px] text-slate-400">&lt;{senderEmail}&gt;</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <span>to {email.recipient}</span>
                <span>∨</span>
              </div>
            </div>
          </div>
          <span className="text-[11px] text-slate-400">{formattedDate}</span>
        </div>

        {/* Email Body */}
        <div
          className="text-xs text-slate-700 leading-relaxed space-y-4 pt-2 whitespace-pre-line"
          dangerouslySetInnerHTML={{ __html: email.body }}
        />
      </div>
    </div>
  );
}
