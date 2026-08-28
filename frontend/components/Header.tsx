'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Button } from './Button';

export function Header() {
  const { data: session } = useSession();
  const [slackConnected, setSlackConnected] = useState(false);
  const user = session?.user;
  const senderId = (session as any)?.user?.senderId;

  useEffect(() => {
    if (!senderId) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    fetch(`${apiUrl}/api/slack/status?senderId=${senderId}`)
      .then((res) => res.json())
      .then((data) => setSlackConnected(data.connected))
      .catch(() => {});
  }, [senderId]);

  const handleSlackConnect = () => {
    if (!senderId) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    window.location.href = `${apiUrl}/api/slack/connect?senderId=${senderId}`;
  };

  const handleSlackDisconnect = async () => {
    if (!senderId) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const backendToken = (session as any)?.backendToken;
    await fetch(`${apiUrl}/api/slack/disconnect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${backendToken}`,
      },
      body: JSON.stringify({ senderId }),
    });
    setSlackConnected(false);
  };

  if (!user) return null;

  return (
    <header className="bg-white border-b border-surface-border">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Left — Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-primary-900 text-white rounded flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
          </div>
          <span className="text-sm font-semibold text-primary-900 tracking-tight">MailFlow</span>
        </div>

        {/* Right — User info + actions */}
        <div className="flex items-center gap-4">
          {/* Slack status */}
          <div className="flex items-center gap-2">
            {slackConnected ? (
              <button
                onClick={handleSlackDisconnect}
                className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-800 transition-colors"
                title="Disconnect Slack"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                Slack connected
              </button>
            ) : (
              <button
                onClick={handleSlackConnect}
                className="flex items-center gap-1.5 text-xs text-primary-500 hover:text-primary-700 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2a2.5 2.5 0 0 0 0 5H17V4.5A2.5 2.5 0 0 0 14.5 2z"/>
                  <path d="M7 8.5H4.5a2.5 2.5 0 0 0 0 5H7v-5z"/>
                  <path d="M22 14.5a2.5 2.5 0 0 0-5 0V17h2.5a2.5 2.5 0 0 0 2.5-2.5z"/>
                  <path d="M15.5 17v2.5a2.5 2.5 0 0 0 5 0V17h-5z"/>
                </svg>
                Connect Slack
              </button>
            )}
          </div>

          <div className="w-px h-5 bg-surface-border" />

          {/* User */}
          <div className="flex items-center gap-3">
            {user.image ? (
              <img
                src={user.image}
                alt=""
                className="w-7 h-7 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-primary-200 flex items-center justify-center text-xs font-medium text-primary-700">
                {user.name?.charAt(0) || user.email?.charAt(0) || '?'}
              </div>
            )}
            <div className="hidden sm:block">
              <p className="text-xs font-medium text-primary-800 leading-tight">{user.name}</p>
              <p className="text-xs text-primary-500 leading-tight">{user.email}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: '/login' })}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
