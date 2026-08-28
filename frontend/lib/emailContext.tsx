'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { api, ScheduledEmailItem, SchedulePayload } from './api';
import toast from 'react-hot-toast';

export interface EmailContextType {
  scheduledEmails: ScheduledEmailItem[];
  sentEmails: ScheduledEmailItem[];
  scheduledCount: number;
  sentCount: number;
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  starredIds: Set<string>;
  toggleStar: (id: string, e?: React.MouseEvent) => void;
  scheduleNewCampaign: (params: {
    recipients: string[];
    subject: string;
    body: string;
    startTime: string;
    delayMs: number;
    hourlyLimit: number;
  }) => Promise<void>;
  refreshEmails: () => Promise<void>;
}

const EmailContext = createContext<EmailContextType | undefined>(undefined);

export function EmailProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const senderId = (session as any)?.user?.senderId || session?.user?.email;
  const backendToken = (session as any)?.backendToken;

  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmailItem[]>([]);
  const [sentEmails, setSentEmails] = useState<ScheduledEmailItem[]>([]);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [starredIds, setStarredIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('mailflow_starred_ids');
        if (saved) return new Set(JSON.parse(saved));
      } catch {}
    }
    return new Set<string>();
  });

  // Persist starred state locally
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('mailflow_starred_ids', JSON.stringify(Array.from(starredIds)));
      } catch {}
    }
  }, [starredIds]);

  const toggleStar = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast.success('Unstarred', { duration: 1200 });
      } else {
        next.add(id);
        toast.success('Starred', { duration: 1200 });
      }
      return next;
    });
  }, []);

  // Fetch real data from backend API
  const fetchEmails = useCallback(
    async (showLoading = false) => {
      if (!senderId || !backendToken) return;

      if (showLoading) setLoading(true);
      try {
        if (searchQuery.trim()) {
          const searchRes = await api.searchEmails(searchQuery.trim(), backendToken, 1, 50);
          const sched = searchRes.data.filter((e) => e.status === 'pending');
          const sent = searchRes.data.filter((e) => e.status === 'sent' || e.status === 'failed');
          setScheduledEmails(sched);
          setSentEmails(sent);
          setScheduledCount(sched.length);
          setSentCount(sent.length);
        } else {
          const [schedRes, sentRes] = await Promise.all([
            api.getScheduledEmails(senderId, backendToken, 1, 50),
            api.getSentEmails(senderId, backendToken, 1, 50),
          ]);

          setScheduledEmails(schedRes.data);
          setSentEmails(sentRes.data);
          setScheduledCount(schedRes.pagination.total);
          setSentCount(sentRes.pagination.total);
        }
      } catch {
        // Backend offline / connection refused fallback
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [senderId, backendToken, searchQuery]
  );

  // Initial fetch and on search change
  useEffect(() => {
    fetchEmails(true);
  }, [fetchEmails]);

  // Periodic polling every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      fetchEmails(false);
    }, 10000);
    return () => clearInterval(timer);
  }, [fetchEmails]);

  const refreshEmails = useCallback(async () => {
    await fetchEmails(true);
    toast.success('Synced with live server');
  }, [fetchEmails]);

  // Schedule a new email campaign via real BullMQ delayed jobs
  const scheduleNewCampaign = useCallback(
    async (params: {
      recipients: string[];
      subject: string;
      body: string;
      startTime: string;
      delayMs: number;
      hourlyLimit: number;
    }) => {
      if (!senderId || !backendToken) {
        throw new Error('Not authenticated. Please sign in with Google first.');
      }

      const payload: SchedulePayload = {
        senderId,
        recipients: params.recipients,
        subject: params.subject,
        body: params.body,
        startTime: params.startTime,
        delayMs: params.delayMs,
        hourlyLimit: params.hourlyLimit,
      };

      try {
        const result = await api.scheduleEmails(payload, backendToken);
        toast.success(result.message || `Scheduled ${result.scheduled} email(s) successfully!`);
        await fetchEmails(true);
      } catch (err: any) {
        // If backend connection refused, let the user know cleanly
        if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
          toast.error(
            'Backend server not reachable on localhost:4000. Please ensure Docker containers and backend are started.'
          );
        } else {
          toast.error(err.message || 'Error occurred while scheduling');
        }
        throw err;
      }
    },
    [senderId, backendToken, fetchEmails]
  );

  return (
    <EmailContext.Provider
      value={{
        scheduledEmails,
        sentEmails,
        scheduledCount,
        sentCount,
        loading,
        searchQuery,
        setSearchQuery,
        starredIds,
        toggleStar,
        scheduleNewCampaign,
        refreshEmails,
      }}
    >
      {children}
    </EmailContext.Provider>
  );
}

export function useEmails() {
  const context = useContext(EmailContext);
  if (!context) {
    throw new Error('useEmails must be used within an EmailProvider');
  }
  return context;
}
