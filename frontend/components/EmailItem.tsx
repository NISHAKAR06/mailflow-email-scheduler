'use client';

import React from 'react';
import { ScheduledEmailItem } from '@/lib/api';
import { useEmails } from '@/lib/emailContext';

interface EmailItemProps {
  email: ScheduledEmailItem;
  onClick: () => void;
}

export function EmailItem({ email, onClick }: EmailItemProps) {
  const { starredIds, toggleStar } = useEmails();
  const isStarred = starredIds.has(email.id);
  const isSent = email.status === 'sent';
  const recipientName = email.recipient.split('@')[0];

  // Format date for scheduled badge e.g. "Tue 9:15:12 AM"
  const formatScheduledTime = (dateStr?: string) => {
    if (!dateStr) return 'Pending';
    const date = new Date(dateStr);
    const day = date.toLocaleDateString('en-US', { weekday: 'short' });
    const time = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    return `${day} ${time}`;
  };

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 transition-colors group select-none text-xs"
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        {/* Recipient */}
        <span className="font-medium text-slate-800 w-32 truncate shrink-0">
          To: {recipientName}
        </span>

        {/* Status Badge (Matching Screenshot 4 for Sent, Screenshot 2 for Scheduled) */}
        {isSent ? (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 shrink-0">
            Sent
          </span>
        ) : email.status === 'failed' ? (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-red-50 text-red-600 border border-red-200 shrink-0">
            Failed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-[#FFF3E8] text-[#D96B27] border border-[#FFE2CC] shrink-0">
            <svg className="w-3 h-3 text-[#D96B27]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth="1.75" />
              <polyline points="12 6 12 12 16 14" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
            <span>{formatScheduledTime(email.scheduledFor)}</span>
          </span>
        )}

        {/* Subject and body snippet */}
        <div className="truncate flex-1 text-slate-600">
          <span className="font-semibold text-slate-800 mr-1.5">{email.subject}</span>
          {!isSent && <span className="text-slate-400 mr-1.5">- Scheduled</span>}
          <span className="text-slate-400">- {email.body?.slice(0, 80)}...</span>
        </div>
      </div>

      {/* Right side: Star and Archive action icons */}
      <div className="flex items-center gap-1 shrink-0 ml-4">
        {/* Archive Button */}
        <button
          onClick={(e) => archiveEmail(email.id, e)}
          className="p-1 text-slate-300 hover:text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Archive email"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        </button>

        {/* Star Button */}
        <button
          onClick={(e) => toggleStar(email.id, e)}
          className={`p-1 transition-colors ${
            isStarred
              ? 'text-amber-400 hover:text-amber-500'
              : 'text-slate-300 hover:text-amber-400 opacity-60 group-hover:opacity-100'
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
      </div>
    </div>
  );
}
