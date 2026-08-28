'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useEmails } from '@/lib/emailContext';
import toast from 'react-hot-toast';

interface ComposeViewProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduled?: () => void;
}

export function ComposeView({ isOpen, onClose, onScheduled }: ComposeViewProps) {
  const { data: session } = useSession();
  const { scheduleNewCampaign } = useEmails();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState('');
  const [delaySec, setDelaySec] = useState('00');
  const [hourlyLimit, setHourlyLimit] = useState('50');
  const [startTime, setStartTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendLaterOpen, setSendLaterOpen] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ name: string; size: string; preview: string }>>([]);

  const user = session?.user;
  const senderEmail = user?.email || 'sender@domain.com';

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Preset time generators
  const getPresetTime = (hoursFromNow: number) => {
    const d = new Date(Date.now() + hoursFromNow * 3600 * 1000);
    return d.toISOString().slice(0, 16);
  };

  const presets = [
    { label: 'Tomorrow', value: getPresetTime(24) },
    { label: 'Tomorrow, 10:00 AM', value: getPresetTime(18) },
    { label: 'Tomorrow, 11:00 AM', value: getPresetTime(19) },
    { label: 'Tomorrow, 3:00 PM', value: getPresetTime(23) },
  ];

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setSendLaterOpen(false);
      }
    };
    if (sendLaterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sendLaterOpen]);

  // Handle CSV / Text lead list upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const raw = text.split(/[,\n\r;]+/).map((s) => s.trim().toLowerCase());
      const valid = raw.filter((email) => emailRegex.test(email));
      const deduped = Array.from(new Set([...recipients, ...valid]));
      setRecipients(deduped);
      toast.success(`Loaded ${valid.length} valid email(s) from ${file.name}`);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle image attachment upload
  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
    const newAtt = {
      name: file.name,
      size: `${sizeInMB} MB`,
      preview: URL.createObjectURL(file),
    };
    setAttachments((prev) => [...prev, newAtt]);
    toast.success(`Attached ${file.name}`);
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Add recipient on Enter or Comma
  const handleAddRecipientKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = recipientInput.trim().toLowerCase();
      if (trimmed && emailRegex.test(trimmed)) {
        if (!recipients.includes(trimmed)) {
          setRecipients([...recipients, trimmed]);
        }
        setRecipientInput('');
      } else if (trimmed) {
        toast.error('Invalid email address format');
      }
    }
  };

  const removeRecipient = (indexToRemove: number) => {
    setRecipients(recipients.filter((_, idx) => idx !== indexToRemove));
  };

  // Rich toolbar formatting actions
  const applyFormat = (prefix: string, suffix = '') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = body.substring(start, end);
    const replacement = `${prefix}${selected || 'text'}${suffix}`;
    const newBody = body.substring(0, start) + replacement + body.substring(end);
    setBody(newBody);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + replacement.length - suffix.length);
    }, 10);
  };

  const handleSendOrSchedule = async (immediate = false) => {
    let finalRecipients = [...recipients];
    if (recipientInput.trim() && emailRegex.test(recipientInput.trim())) {
      finalRecipients.push(recipientInput.trim().toLowerCase());
    }

    if (finalRecipients.length === 0) {
      toast.error('Please enter or upload at least one recipient email');
      return;
    }
    if (!subject.trim()) {
      toast.error('Please enter an email subject');
      return;
    }
    if (!body.trim()) {
      toast.error('Please write an email message');
      return;
    }

    const scheduledDate = !immediate && startTime
      ? new Date(startTime).toISOString()
      : new Date().toISOString();

    const delayMs = parseInt(delaySec, 10) * 1000 || 1000;
    const limit = parseInt(hourlyLimit, 10) || 50;

    setLoading(true);

    try {
      await scheduleNewCampaign({
        recipients: finalRecipients,
        subject,
        body,
        startTime: scheduledDate,
        delayMs,
        hourlyLimit: limit,
      });

      setSubject('');
      setBody('');
      setRecipients([]);
      setRecipientInput('');
      setStartTime('');
      setAttachments([]);
      setSendLaterOpen(false);
      onScheduled?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Error occurred while scheduling');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const displayChips = recipients.slice(0, 3);
  const remainingCount = recipients.length - 3;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-y-auto animate-in fade-in duration-150">
      {/* Top Header Bar */}
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
          <h2 className="text-base font-semibold text-slate-800">Compose New Email</h2>
        </div>

        {/* Right Actions: Paperclip, Clock, Send Later / Send Button */}
        <div className="flex items-center gap-3 relative">
          {/* Paperclip button */}
          <button
            onClick={() => attachmentInputRef.current?.click()}
            className="flex items-center gap-0.5 text-emerald-600 hover:text-emerald-700 p-1.5 rounded-full hover:bg-emerald-50 transition-colors"
            title="Attach image or file"
          >
            <svg className="w-4 h-4 transform rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <span className="text-[11px] font-bold">{attachments.length}</span>
          </button>
          <input
            ref={attachmentInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleAttachmentUpload}
            className="hidden"
          />

          {/* Clock Icon (Toggles Send Later Popover) */}
          <button
            onClick={() => setSendLaterOpen(!sendLaterOpen)}
            className="text-emerald-600 hover:text-emerald-700 p-1.5 rounded-full hover:bg-emerald-50 transition-colors"
            title="Schedule time"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth="2" />
              <polyline points="12 6 12 12 16 14" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          {/* Send Later / Send pill button */}
          <div className="relative">
            <button
              onClick={() => handleSendOrSchedule(!startTime)}
              disabled={loading}
              className="py-1.5 px-4 rounded-full border border-emerald-600 hover:bg-emerald-50 text-emerald-600 font-medium text-xs tracking-wide transition-all shadow-sm flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Scheduling...' : startTime ? 'Send Later' : 'Send'}
            </button>

            {/* Send Later Popover */}
            {sendLaterOpen && (
              <div
                ref={popoverRef}
                className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 z-40 animate-in fade-in zoom-in-95 duration-150"
              >
                <h3 className="text-sm font-semibold text-slate-800 mb-3">Send Later</h3>

                <div className="relative mb-3">
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Pick date & time"
                  />
                </div>

                <div className="space-y-1 py-1 border-t border-b border-slate-100 my-3">
                  {presets.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => setStartTime(preset.value)}
                      className={`w-full text-left px-2 py-1.5 text-xs rounded-lg transition-colors flex items-center justify-between ${
                        startTime === preset.value
                          ? 'bg-emerald-50 text-emerald-800 font-semibold'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span>{preset.label}</span>
                      {startTime === preset.value && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => {
                      setStartTime('');
                      setSendLaterOpen(false);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setSendLaterOpen(false);
                      toast.success(
                        `Scheduled for ${new Date(startTime || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      );
                    }}
                    className="py-1 px-4 rounded-full border border-emerald-600 hover:bg-emerald-50 text-emerald-600 font-semibold text-xs tracking-wide transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Compose Form Fields */}
      <div className="max-w-4xl w-full mx-auto px-8 py-6 space-y-4">
        {/* From Field */}
        <div className="flex items-center gap-6">
          <label className="text-xs font-semibold text-slate-700 w-12 shrink-0">From</label>
          <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs text-slate-700">
            <span>{senderEmail}</span>
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* To Field with Email Chips + Upload List */}
        <div className="flex items-center gap-6 border-b border-slate-100 pb-3">
          <label className="text-xs font-semibold text-slate-700 w-12 shrink-0">To</label>
          <div className="flex-1 flex flex-wrap items-center gap-1.5">
            {displayChips.map((email, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 text-xs text-emerald-800 bg-white border border-emerald-500 px-2.5 py-0.5 rounded-full"
              >
                <span>{email}</span>
                <button
                  onClick={() => removeRecipient(idx)}
                  className="hover:text-red-500 ml-0.5 text-slate-400 font-bold"
                >
                  ×
                </button>
              </span>
            ))}

            {remainingCount > 0 && (
              <span className="inline-flex items-center text-xs font-medium text-emerald-800 bg-white border border-emerald-500 px-2 py-0.5 rounded-full">
                +{remainingCount}
              </span>
            )}

            <input
              type="text"
              value={recipientInput}
              onChange={(e) => setRecipientInput(e.target.value)}
              onKeyDown={handleAddRecipientKey}
              placeholder={recipients.length === 0 ? 'recipient@example.com (press Enter)' : 'Add recipient...'}
              className="text-xs text-slate-700 placeholder:text-slate-300 focus:outline-none flex-1 min-w-[140px] py-1 bg-transparent"
            />
          </div>

          {/* Upload List Button */}
          <div className="shrink-0">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>Upload List</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Subject Field */}
        <div className="flex items-center gap-6 border-b border-slate-100 pb-3">
          <label className="text-xs font-semibold text-slate-700 w-12 shrink-0">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1 text-xs text-slate-800 placeholder:text-slate-300 focus:outline-none bg-transparent"
          />
        </div>

        {/* Delay & Hourly Limit Row */}
        <div className="flex items-center gap-8 pt-1">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-700">Delay between 2 emails</label>
            <input
              type="text"
              value={delaySec}
              onChange={(e) => setDelaySec(e.target.value)}
              className="w-14 text-xs text-center text-slate-700 bg-white border border-slate-200 rounded-xl px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="00"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-700">Hourly Limit</label>
            <input
              type="text"
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(e.target.value)}
              className="w-14 text-xs text-center text-slate-700 bg-white border border-slate-200 rounded-xl px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="00"
            />
          </div>
        </div>

        {/* Email Body Container with Figma Toolbar */}
        <div className="mt-4 rounded-2xl bg-slate-50/70 border border-slate-100 p-4 space-y-3 min-h-[360px] flex flex-col justify-between">
          <div>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3.5 pb-3 text-slate-500 text-xs border-b border-slate-200/50">
              <button type="button" onClick={() => applyFormat('')} className="hover:text-slate-800 transition-colors" title="Undo">↶</button>
              <button type="button" onClick={() => applyFormat('')} className="hover:text-slate-800 transition-colors" title="Redo">↷</button>
              <span className="text-slate-200">|</span>
              <button type="button" onClick={() => applyFormat('# ')} className="font-serif hover:text-slate-800 flex items-center gap-0.5" title="Heading">
                <span className="font-bold">T</span>t <span className="text-[9px]">↕</span>
              </button>
              <span className="text-slate-200">|</span>
              <button type="button" onClick={() => applyFormat('**', '**')} className="font-bold hover:text-slate-800" title="Bold">B</button>
              <button type="button" onClick={() => applyFormat('*', '*')} className="italic hover:text-slate-800" title="Italic">I</button>
              <button type="button" onClick={() => applyFormat('<u>', '</u>')} className="underline hover:text-slate-800" title="Underline">U</button>
              <span className="text-slate-200">|</span>
              <button type="button" onClick={() => applyFormat('')} className="hover:text-slate-800" title="Align">≡</button>
              <button type="button" onClick={() => applyFormat('\n\n')} className="hover:text-slate-800" title="Spacing">↕</button>
              <span className="text-slate-200">|</span>
              <button type="button" onClick={() => applyFormat('1. ')} className="hover:text-slate-800" title="Numbered List">1≡</button>
              <button type="button" onClick={() => applyFormat('- ')} className="hover:text-slate-800" title="Bullet List">•≡</button>
              <button type="button" onClick={() => applyFormat('  ')} className="hover:text-slate-800" title="Indent">⇥</button>
              <button type="button" onClick={() => applyFormat('')} className="hover:text-slate-800" title="Outdent">⇤</button>
              <span className="text-slate-200">|</span>
              <button type="button" onClick={() => applyFormat('> ')} className="hover:text-slate-800 font-serif" title="Quote">“</button>
              <button type="button" onClick={() => applyFormat('`', '`')} className="hover:text-slate-800 font-mono text-[10px]" title="Code">{'</>'}</button>
              <button type="button" onClick={() => applyFormat('~~', '~~')} className="hover:text-slate-800 line-through" title="Strikethrough">S</button>
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type Your Reply..."
              className="w-full text-xs text-slate-800 placeholder:text-slate-300 bg-transparent focus:outline-none resize-none pt-3 font-sans leading-relaxed"
            />
          </div>

          {/* Attachment Previews */}
          {attachments.length > 0 && (
            <div className="pt-2 flex flex-wrap gap-3">
              {attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="w-36 bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm relative group"
                >
                  <button
                    onClick={() => removeAttachment(idx)}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    title="Remove attachment"
                  >
                    ×
                  </button>
                  <div className="h-16 bg-slate-100 flex items-center justify-center overflow-hidden">
                    <img
                      src={att.preview}
                      alt={att.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-2">
                    <p className="text-[10px] font-semibold text-slate-800 truncate">{att.name}</p>
                    <p className="text-[9px] text-slate-400">{att.size}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
