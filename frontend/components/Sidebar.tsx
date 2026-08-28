'use client';

import React, { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { useEmails } from '@/lib/emailContext';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface SidebarProps {
  onOpenCompose: () => void;
}

export function Sidebar({ onOpenCompose }: SidebarProps) {
  const { data: session } = useSession();
  const { scheduledCount, sentCount } = useEmails();
  const pathname = usePathname();
  const router = useRouter();
  const [slackConnected, setSlackConnected] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const user = session?.user;
  const senderId = (session as any)?.user?.senderId || user?.email;
  const backendToken = (session as any)?.backendToken;

  // Real-time Slack status check
  useEffect(() => {
    if (!senderId) return;
    api
      .getSlackStatus(senderId)
      .then((res) => setSlackConnected(res.connected))
      .catch(() => setSlackConnected(false));
  }, [senderId]);

  const handleSlackConnect = () => {
    if (!senderId) {
      toast.error('Please sign in first');
      return;
    }
    window.location.href = `/api/backend/slack/connect?senderId=${encodeURIComponent(senderId)}`;
  };

  const handleSlackDisconnect = async () => {
    if (!senderId || !backendToken) return;
    try {
      await api.disconnectSlack(senderId, backendToken);
      setSlackConnected(false);
      toast.success('Slack disconnected');
    } catch (err: any) {
      toast.error(err.message || 'Failed to disconnect Slack');
    }
  };

  const isScheduled = pathname.includes('/dashboard/scheduled');
  const isSent = pathname.includes('/dashboard/sent');

  return (
    <aside className="w-64 h-screen bg-white border-r border-slate-100 flex flex-col justify-between p-5 select-none shrink-0">
      <div className="flex flex-col gap-6">
        {/* Logo (Matching Screenshot 4) */}
        <div className="flex items-center justify-between px-1">
          <h1 className="text-2xl font-black tracking-wider text-black font-sans">
            ONB
          </h1>
          {slackConnected ? (
            <button
              onClick={handleSlackDisconnect}
              className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-full transition-colors"
              title="Click to disconnect Slack"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Slack
            </button>
          ) : (
            <button
              onClick={handleSlackConnect}
              className="text-[11px] font-medium text-slate-400 hover:text-emerald-600 transition-colors"
              title="Connect Slack OAuth for live rate-limit alerts"
            >
              + Slack
            </button>
          )}
        </div>

        {/* User Card */}
        <div className="relative">
          <div
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors border border-slate-100"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {user?.image ? (
                <img
                  src={user.image}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-xs flex items-center justify-center">
                  {user?.name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800 truncate leading-tight">
                  {user?.name || user?.email?.split('@')[0] || 'User'}
                </p>
                <p className="text-[10px] text-slate-400 truncate leading-tight">
                  {user?.email || 'user@example.com'}
                </p>
              </div>
            </div>
            <svg
              className={`w-3.5 h-3.5 text-slate-400 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {userDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-lg py-1 z-30">
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </div>
          )}
        </div>

        {/* Compose Button */}
        <button
          onClick={onOpenCompose}
          className="w-full py-2.5 px-4 rounded-full border border-emerald-600 hover:bg-emerald-50 text-emerald-600 font-medium text-xs tracking-wide transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-[0.98]"
        >
          Compose
        </button>

        {/* CORE Navigation section */}
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-slate-300 tracking-wider uppercase px-2 mb-2">
            CORE
          </p>

          {/* Scheduled Nav item */}
          <button
            onClick={() => router.push('/dashboard/scheduled')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-full text-xs transition-colors ${
              isScheduled
                ? 'bg-emerald-50 text-emerald-900 font-semibold'
                : 'text-slate-600 hover:bg-slate-50 font-normal'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <svg
                className={`w-4 h-4 ${isScheduled ? 'text-emerald-700' : 'text-slate-400'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="10" strokeWidth="1.75" />
                <polyline points="12 6 12 12 16 14" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
              <span>Scheduled</span>
            </div>
            <span className={`text-[11px] ${isScheduled ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
              {scheduledCount}
            </span>
          </button>

          {/* Sent Nav item */}
          <button
            onClick={() => router.push('/dashboard/sent')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-full text-xs transition-colors ${
              isSent
                ? 'bg-emerald-50 text-emerald-900 font-semibold'
                : 'text-slate-600 hover:bg-slate-50 font-normal'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <svg
                className={`w-4 h-4 ${isSent ? 'text-emerald-700' : 'text-slate-400'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <line x1="22" y1="2" x2="11" y2="13" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Sent</span>
            </div>
            <span className={`text-[11px] ${isSent ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
              {sentCount}
            </span>
          </button>
        </div>
      </div>

      {/* Footer / Bull Board Link */}
      <div className="pt-4 border-t border-slate-100">
        <a
          href="http://localhost:4000/admin/queues"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between text-[11px] text-slate-400 hover:text-slate-700 px-2 py-1.5 rounded-lg transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Live Queue Monitor
          </span>
          <span>↗</span>
        </a>
      </div>
    </aside>
  );
}
