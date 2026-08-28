'use client';

import { useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { Modal } from './Modal';
import { Input, Textarea } from './Input';
import { Button } from './Button';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduled?: () => void;
}

export function ComposeModal({ isOpen, onClose, onScheduled }: ComposeModalProps) {
  const { data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('');
  const [delayMs, setDelayMs] = useState('1000');
  const [hourlyLimit, setHourlyLimit] = useState('50');
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /** Parse CSV/text file: split by commas/newlines, filter valid, deduplicate */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const raw = text.split(/[,\n\r;]+/).map((s) => s.trim().toLowerCase());
      const valid = raw.filter((email) => emailRegex.test(email));
      const deduped = Array.from(new Set(valid));
      setRecipients(deduped);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    if (!subject.trim()) {
      toast.error('Subject is required');
      return;
    }
    if (!body.trim()) {
      toast.error('Email body is required');
      return;
    }
    if (recipients.length === 0) {
      toast.error('Upload a CSV with at least one valid email');
      return;
    }
    if (!startTime) {
      toast.error('Start time is required');
      return;
    }

    const senderId = (session as any)?.user?.senderId;
    const backendToken = (session as any)?.backendToken;

    if (!senderId || !backendToken) {
      toast.error('Session expired. Please sign in again.');
      return;
    }

    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/emails/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${backendToken}`,
        },
        body: JSON.stringify({
          senderId,
          recipients,
          subject,
          body,
          startTime: new Date(startTime).toISOString(),
          delayMs: parseInt(delayMs, 10),
          hourlyLimit: parseInt(hourlyLimit, 10),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to schedule emails');
      }

      toast.success(data.message || `Scheduled ${data.scheduled} emails`);

      // Reset form
      setSubject('');
      setBody('');
      setRecipients([]);
      setStartTime('');
      setFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      onScheduled?.();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to schedule emails');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Compose New Email" maxWidth="max-w-xl">
      <div className="space-y-4">
        <Input
          label="Subject"
          placeholder="Enter email subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />

        <Textarea
          label="Body"
          placeholder="Enter email body (HTML supported)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
        />

        {/* CSV Upload */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-primary-800">Recipients</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-primary-300 rounded hover:bg-primary-50 text-primary-700 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Upload CSV / Text
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            {fileName && (
              <span className="text-xs text-primary-500">{fileName}</span>
            )}
          </div>
          {recipients.length > 0 && (
            <p className="text-xs text-primary-600 mt-1.5 flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-accent-light text-accent text-xs font-semibold">
                {recipients.length}
              </span>
              valid, deduplicated email{recipients.length !== 1 ? 's' : ''} detected
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Start time"
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <Input
            label="Delay between emails"
            type="number"
            value={delayMs}
            onChange={(e) => setDelayMs(e.target.value)}
            helpText="milliseconds"
            min="0"
          />
          <Input
            label="Hourly limit"
            type="number"
            value={hourlyLimit}
            onChange={(e) => setHourlyLimit(e.target.value)}
            helpText="per sender"
            min="1"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-surface-border">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            Schedule {recipients.length > 0 ? `${recipients.length} email${recipients.length !== 1 ? 's' : ''}` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
