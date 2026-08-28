'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { api, ScheduledEmailItem, SchedulePayload } from './api';
import toast from 'react-hot-toast';

export interface EmailContextType {
  scheduledEmails: ScheduledEmailItem[];
  sentEmails: ScheduledEmailItem[];
  archivedEmails: ScheduledEmailItem[];
  scheduledCount: number;
  sentCount: number;
  archivedCount: number;
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  starredIds: Set<string>;
  toggleStar: (id: string, e?: React.MouseEvent) => void;
  archivedIds: Set<string>;
  archiveEmail: (id: string, e?: React.MouseEvent) => void;
  unarchiveEmail: (id: string, e?: React.MouseEvent) => void;
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

  const [rawScheduled, setRawScheduled] = useState<ScheduledEmailItem[]>([]);
  const [rawSent, setRawSent] = useState<ScheduledEmailItem[]>([]);
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

  const [archivedIds, setArchivedIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('mailflow_archived_ids');
        if (saved) return new Set(JSON.parse(saved));
      } catch {}
    }
    return new Set<string>();
  });

  // Persist starred and archived states
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('mailflow_starred_ids', JSON.stringify(Array.from(starredIds)));
      } catch {}
    }
  }, [starredIds]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('mailflow_archived_ids', JSON.stringify(Array.from(archivedIds)));
      } catch {}
    }
  }, [archivedIds]);

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

  const archiveEmail = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setArchivedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    toast.success('Email archived', { duration: 1500 });
  }, []);

  const unarchiveEmail = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setArchivedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    toast.success('Email restored from archive', { duration: 1500 });
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
          setRawScheduled(sched);
          setRawSent(sent);
        } else {
          const [schedRes, sentRes] = await Promise.all([
            api.getScheduledEmails(senderId, backendToken, 1, 50),
            api.getSentEmails(senderId, backendToken, 1, 50),
          ]);

          setRawScheduled(schedRes.data);
          setRawSent(sentRes.data);
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

  // All raw emails
  const allEmails = [...rawScheduled, ...rawSent];

  // Filter out archived emails from active views
  const scheduledEmails = rawScheduled.filter((e) => !archivedIds.has(e.id));
  const sentEmails = rawSent.filter((e) => !archivedIds.has(e.id));
  const archivedEmails = allEmails.filter((e) => archivedIds.has(e.id));
  const scheduledCount = scheduledEmails.length;
  const sentCount = sentEmails.length;
  const archivedCount = archivedEmails.length;

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
        throw new Error('Not authenticated. Please sign in first.');
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
        toast.error(err.message || 'Error occurred while scheduling');
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
        archivedEmails,
        scheduledCount,
        sentCount,
        archivedCount,
        loading,
        searchQuery,
        setSearchQuery,
        starredIds,
        toggleStar,
        archivedIds,
        archiveEmail,
        unarchiveEmail,
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
