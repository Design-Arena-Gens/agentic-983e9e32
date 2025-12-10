'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { AlertCircle, Mic, PhoneCall, PhoneForwarded, Send, ShieldCheck, UserPlus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAudioCapture } from '@/hooks/use-audio-capture';

export interface DashboardContact {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  company?: string | null;
  whatsappOptIn: boolean;
  tags: string[];
  notes?: string | null;
  createdAt: string;
  voiceProfileId?: string | null;
  voiceModelVersion?: string | null;
}

export interface DashboardCall {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  status: string;
  subject?: string | null;
  startedAt: string;
  endedAt?: string | null;
  sentimentScore?: number | null;
  sentimentLabel?: string | null;
  summary?: string | null;
  highlights: string[];
  actions: string[];
  contact?: {
    id: string;
    name: string;
    phone: string;
  } | null;
  transcript?: {
    text?: string | null;
  } | null;
}

export interface DashboardMetrics {
  totalContacts: number;
  totalCalls: number;
  voiceProfiles: number;
  positiveSentiment: number;
  tasksPending: number;
  whatsappOptIns: number;
}

interface DashboardShellProps {
  contacts: DashboardContact[];
  calls: DashboardCall[];
  metrics: DashboardMetrics;
}

const outboundSchema = z.object({
  to: z.string().min(5),
  subject: z.string().optional(),
  agentGreeting: z.string().optional(),
  contactId: z.string().optional(),
});

const contactSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(5),
  email: z.string().email().or(z.literal('')).optional(),
  company: z.string().optional(),
  whatsappOptIn: z.boolean().optional(),
  tags: z.string().optional(),
  notes: z.string().optional(),
});

const whatsappSchema = z.object({
  callId: z.string(),
  message: z.string().min(3),
});

export function DashboardShell({ contacts, calls, metrics }: DashboardShellProps) {
  const queryClient = useQueryClient();

  const contactsQuery = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const response = await fetch('/api/contacts');
      if (!response.ok) throw new Error('Failed to fetch contacts');
      const data = await response.json();
      return data.contacts as DashboardContact[];
    },
    initialData: contacts,
  });

  const callsQuery = useQuery({
    queryKey: ['calls'],
    queryFn: async () => {
      const response = await fetch('/api/calls');
      if (!response.ok) throw new Error('Failed to fetch calls');
      const data = await response.json();
      return data.calls as DashboardCall[];
    },
    initialData: calls,
  });

  const [voiceEnrollmentStatus, setVoiceEnrollmentStatus] = useState<string | null>(null);
  const [voiceVerification, setVoiceVerification] = useState<{
    similarity: number;
    threshold: number;
    verified: boolean;
  } | null>(null);

  const outboundForm = useForm<z.infer<typeof outboundSchema>>({
    resolver: zodResolver(outboundSchema),
    defaultValues: {
      agentGreeting: 'Hi, this is the Atlas AI agent calling on behalf of our team.',
    },
  });

  const contactForm = useForm<z.infer<typeof contactSchema>>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      whatsappOptIn: true,
    },
  });

  const whatsappForm = useForm<z.infer<typeof whatsappSchema>>({
    resolver: zodResolver(whatsappSchema),
    defaultValues: {
      callId: callsQuery.data?.[0]?.id ?? '',
      message: '',
    },
  });

  const outboundMutation = useMutation({
    mutationFn: async (payload: z.infer<typeof outboundSchema>) => {
      const response = await fetch('/api/calls/outbound', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error ?? 'Failed to initiate call');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] });
      outboundForm.reset({
        agentGreeting: 'Hi, this is the Atlas AI agent calling on behalf of our team.',
      });
    },
  });

  const contactMutation = useMutation({
    mutationFn: async (payload: z.infer<typeof contactSchema>) => {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...payload,
          tags: payload.tags ? payload.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [],
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error ?? 'Failed to create contact');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      contactForm.reset({
        whatsappOptIn: true,
      });
    },
  });

  const whatsappMutation = useMutation({
    mutationFn: async (payload: z.infer<typeof whatsappSchema>) => {
      const response = await fetch(`/api/calls/${payload.callId}/whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: payload.message }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error ?? 'Failed to send WhatsApp message');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] });
      whatsappForm.reset({
        callId: callsQuery.data?.[0]?.id ?? '',
        message: '',
      });
    },
  });

  const { isRecording, start, finish, lastResult } = useAudioCapture();

  const contactsData = contactsQuery.data ?? [];
  const callsData = callsQuery.data ?? [];

  const sentimentAverages = useMemo(() => {
    const data = callsQuery.data ?? [];
    const validScores = data.filter((call): call is DashboardCall & { sentimentScore: number } => typeof call.sentimentScore === 'number');
    if (!validScores.length) {
      return { average: 0, label: 'neutral' };
    }
    const average = validScores.reduce((acc, call) => acc + (call.sentimentScore ?? 0), 0) / validScores.length;
    const label = average > 0.25 ? 'Positive' : average < -0.25 ? 'Negative' : 'Neutral';
    return { average, label };
  }, [callsQuery.data]);

  const handleVoiceEnrollment = async (contactId: string) => {
    if (!lastResult) {
      setVoiceEnrollmentStatus('Capture a voice sample first.');
      return;
    }
    setVoiceEnrollmentStatus('Uploading voice profile...');
    try {
      const response = await fetch('/api/voice/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contactId,
          vector: lastResult.vector,
          modelVersion: 'atlas-mfcc-v1',
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error ?? 'Failed to register voice profile');
      }

      await queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setVoiceEnrollmentStatus('Voice profile enrolled successfully.');
    } catch (error: unknown) {
      if (error instanceof Error) {
        setVoiceEnrollmentStatus(error.message);
      } else {
        setVoiceEnrollmentStatus('Failed to enroll voice profile.');
      }
    }
  };

  const handleVoiceVerification = async (contactId: string) => {
    if (!lastResult) {
      setVoiceEnrollmentStatus('Capture a voice sample first.');
      return;
    }

    try {
      const response = await fetch('/api/voice/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contactId,
          vector: lastResult.vector,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error ?? 'Voice verification failed');
      }

      const result = (await response.json()) as {
        similarity: number;
        threshold: number;
        verified: boolean;
      };
      setVoiceVerification(result);
    } catch (error: unknown) {
      if (error instanceof Error) {
        setVoiceEnrollmentStatus(error.message);
      } else {
        setVoiceEnrollmentStatus('Voice verification failed.');
      }
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-10 md:py-12">
      <header className="space-y-6">
        <div className="glass-panel p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <Badge className="mb-4 bg-indigo-500/20 text-indigo-200">Atlas Voice AI Control Center</Badge>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Orchestrate intelligent conversations across calling, biometrics, and messaging.
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-slate-400">
                Manage outbound and inbound voice AI operations with voice print verification, AI call intelligence, CRM context, and proactive WhatsApp follow-ups — all deployable to Vercel.
              </p>
            </div>
            <div className="grid w-full max-w-sm grid-cols-2 gap-3 text-sm font-medium text-slate-300">
              <div className="stat-card">
                <p className="text-xs uppercase tracking-[0.14em] text-indigo-200/70">Active Contacts</p>
                <p className="mt-2 text-2xl font-semibold text-white">{metrics.totalContacts}</p>
                <p className="text-xs text-slate-400">Voice-ready: {metrics.voiceProfiles}</p>
              </div>
              <div className="stat-card">
                <p className="text-xs uppercase tracking-[0.14em] text-indigo-200/70">Sentiment Pulse</p>
                <p className="mt-2 text-2xl font-semibold text-white">{sentimentAverages.label}</p>
                <p className="text-xs text-slate-400">
                  Avg score: {sentimentAverages.average.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="glass-panel p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="panel-title">launch outbound voice agent</h2>
            <Badge className="bg-emerald-500/15 text-emerald-200">Live Twilio Bridge</Badge>
          </div>
          <form
            className="mt-6 grid gap-4"
            onSubmit={outboundForm.handleSubmit((values) =>
              outboundMutation.mutate({
                ...values,
                contactId: values.contactId?.length ? values.contactId : undefined,
              }),
            )}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.18em] text-slate-400">destination number</label>
                <Input placeholder="+1 (555) 000-0000" {...outboundForm.register('to')} />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.18em] text-slate-400">link crm contact</label>
                <select
                  className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  {...outboundForm.register('contactId')}
                >
                  <option value="">Optional</option>
                  {contactsData.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name} · {contact.phone}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.18em] text-slate-400">call subject</label>
                <Input placeholder="Product onboarding follow-up" {...outboundForm.register('subject')} />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.18em] text-slate-400">agent greeting</label>
                <Input {...outboundForm.register('agentGreeting')} />
              </div>
            </div>
            <Button type="submit" className="w-fit" disabled={outboundMutation.isPending}>
              <PhoneForwarded className="h-4 w-4" />
              {outboundMutation.isPending ? 'Dialing...' : 'Launch outbound call'}
            </Button>
            {outboundMutation.error ? (
              <p className="text-xs text-rose-400">{outboundMutation.error.message}</p>
            ) : null}
            {outboundMutation.isSuccess ? (
              <p className="text-xs text-emerald-400">Outbound call orchestrated via Twilio successfully.</p>
            ) : null}
          </form>
        </div>

        <div className="glass-panel p-6">
          <div className="flex items-center justify-between">
            <h2 className="panel-title">quick contact intake</h2>
            <UserPlus className="h-4 w-4 text-indigo-300" />
          </div>
          <form className="mt-5 space-y-4" onSubmit={contactForm.handleSubmit((values) => contactMutation.mutate(values))}>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-[0.18em] text-slate-500">full name</label>
              <Input placeholder="Avery Johnson" {...contactForm.register('name')} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-[0.18em] text-slate-500">phone</label>
              <Input placeholder="+15551234567" {...contactForm.register('phone')} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-[0.18em] text-slate-500">email (optional)</label>
              <Input placeholder="avery@example.com" {...contactForm.register('email')} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-[0.18em] text-slate-500">tags</label>
              <Input placeholder="vip, onboarding, healthtech" {...contactForm.register('tags')} />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
              <span>Opt-in WhatsApp follow-up</span>
              <input type="checkbox" className="h-4 w-4 rounded border-white/30 bg-transparent accent-indigo-500" {...contactForm.register('whatsappOptIn')} />
            </div>
            <Button type="submit" className="w-full" disabled={contactMutation.isPending}>
              {contactMutation.isPending ? 'Saving...' : 'Save contact'}
            </Button>
            {contactMutation.error ? (
              <p className="text-xs text-rose-400">{contactMutation.error.message}</p>
            ) : null}
            {contactMutation.isSuccess ? (
              <p className="text-xs text-emerald-400">Contact captured successfully.</p>
            ) : null}
          </form>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="glass-panel p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="panel-title">recent ai-powered conversations</h2>
            <Badge className="bg-blue-500/20 text-blue-200">Transcriptions & Sentiment</Badge>
          </div>
          <div className="mt-5 space-y-4">
            {callsData.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-slate-400">
                No calls yet. Launch an outbound call to unlock AI insights.
              </div>
            ) : (
              callsData.map((call) => (
                <article key={call.id} className="rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:border-indigo-400/30 hover:bg-white/8">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-200">
                      {call.direction === 'OUTBOUND' ? <PhoneCall className="h-3.5 w-3.5" /> : <PhoneForwarded className="h-3.5 w-3.5" />}
                      {call.direction === 'OUTBOUND' ? 'Outbound' : 'Inbound'}
                    </div>
                    <span className="text-xs text-slate-400">
                      {formatDistanceToNow(new Date(call.startedAt), { addSuffix: true })}
                    </span>
                    {call.sentimentLabel ? (
                      <span
                        className={`text-xs uppercase tracking-[0.2em] ${
                          call.sentimentLabel === 'positive'
                            ? 'text-emerald-300'
                            : call.sentimentLabel === 'negative'
                              ? 'text-rose-300'
                              : 'text-amber-200'
                        }`}
                      >
                        {call.sentimentLabel}
                      </span>
                    ) : null}
                    {call.contact ? (
                      <span className="text-xs text-slate-300">
                        {call.contact.name} · {call.contact.phone}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 text-sm text-slate-200">
                    {call.summary ? (
                      <p className="leading-relaxed">{call.summary}</p>
                    ) : (
                      <p className="italic text-slate-500">No summary yet. Run AI insights after transcription.</p>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
                    {call.highlights.slice(0, 3).map((highlight, index) => (
                      <span key={`${call.id}-highlight-${index}`} className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-indigo-200">
                        {highlight}
                      </span>
                    ))}
                    {call.actions.slice(0, 2).map((action, index) => (
                      <span key={`${call.id}-action-${index}`} className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-amber-200">
                        {action}
                      </span>
                    ))}
                  </div>
                  {call.transcript?.text ? (
                    <details className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                      <summary className="cursor-pointer text-xs uppercase tracking-[0.2em] text-slate-500">full transcript</summary>
                      <p className="mt-3 whitespace-pre-line text-slate-300">{call.transcript.text}</p>
                    </details>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="glass-panel p-6">
            <div className="flex items-center justify-between">
              <h2 className="panel-title">voice biometric engine</h2>
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
            </div>
            <p className="mt-3 text-sm text-slate-400">
              Capture a short sample to generate a voice print (MFCC-inspired vector). Enroll a contact for speaker verification during future calls.
            </p>
            <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-slate-900/30 p-4">
              <div className="flex items-center gap-3">
                <Button variant={isRecording ? 'danger' : 'secondary'} onClick={isRecording ? finish : start} className="w-full">
                  <Mic className="h-4 w-4" />
                  {isRecording ? 'Stop capture' : 'Record voice sample'}
                </Button>
              </div>
              {lastResult ? (
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4 text-xs text-indigo-100">
                  <p className="font-semibold uppercase tracking-[0.2em] text-indigo-200">Voice vector preview</p>
                  <p className="mt-2 break-all">{lastResult.vector.map((value) => value.toFixed(3)).join(' · ')}</p>
                </div>
              ) : null}
              <div className="grid gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Apply to contact</label>
                <select
                  className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-slate-200 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  onChange={(event) => {
                    const contactId = event.target.value;
                    if (!contactId) return;
                    handleVoiceEnrollment(contactId);
                    event.target.value = '';
                  }}
                >
                  <option value="">Enroll contact</option>
                  {contactsData.map((contact) => (
                    <option key={`${contact.id}-enroll`} value={contact.id}>
                      {contact.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Verify contact</label>
                <select
                  className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-slate-200 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  onChange={(event) => {
                    const contactId = event.target.value;
                    if (!contactId) return;
                    handleVoiceVerification(contactId);
                    event.target.value = '';
                  }}
                >
                  <option value="">Check match</option>
                  {contactsData
                    .filter((contact) => contact.voiceProfileId)
                    .map((contact) => (
                      <option key={`${contact.id}-verify`} value={contact.id}>
                        {contact.name}
                      </option>
                    ))}
                </select>
              </div>
              {voiceEnrollmentStatus ? <p className="text-xs text-slate-400">{voiceEnrollmentStatus}</p> : null}
              {voiceVerification ? (
                <div
                  className={`rounded-xl border p-4 text-xs ${voiceVerification.verified ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100' : 'border-rose-500/40 bg-rose-500/10 text-rose-100'}`}
                >
                  <p className="font-semibold uppercase tracking-[0.2em]">{voiceVerification.verified ? 'voice matched' : 'voice mismatch'}</p>
                  <p className="mt-2">
                    Similarity {voiceVerification.similarity.toFixed(3)} vs threshold {voiceVerification.threshold.toFixed(2)}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="glass-panel p-6">
            <div className="flex items-center justify-between">
              <h2 className="panel-title">ai whatsapp follow-up</h2>
              <Send className="h-4 w-4 text-emerald-300" />
            </div>
            <p className="mt-3 text-sm text-slate-400">
              Push a templated WhatsApp recap or action plan directly to the caller via Twilio.
            </p>
            <form className="mt-4 space-y-4" onSubmit={whatsappForm.handleSubmit((values) => whatsappMutation.mutate(values))}>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.2em] text-slate-500">choose call</label>
                <select
                  className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-slate-200 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  {...whatsappForm.register('callId')}
                >
                  <option value="">Select</option>
                  {callsData.map((call) => (
                    <option key={`${call.id}-whatsapp`} value={call.id}>
                      {call.contact?.name ?? 'Unknown'} · {format(new Date(call.startedAt), 'MMM d, HH:mm')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.2em] text-slate-500">message payload</label>
                <Textarea rows={5} placeholder="Thank you for the conversation, here are the next steps..." {...whatsappForm.register('message')} />
              </div>
              <Button type="submit" className="w-full" disabled={whatsappMutation.isPending}>
                {whatsappMutation.isPending ? 'Sending...' : 'Send WhatsApp message'}
              </Button>
              {whatsappMutation.error ? (
                <p className="text-xs text-rose-400">{whatsappMutation.error.message}</p>
              ) : null}
              {whatsappMutation.isSuccess ? (
                <p className="text-xs text-emerald-400">WhatsApp message dispatched successfully.</p>
              ) : null}
            </form>
          </div>
        </div>
      </section>

      <section className="glass-panel p-6">
        <div className="flex items-center justify-between">
          <h2 className="panel-title">crm roster</h2>
          <Badge className="bg-slate-500/20 text-slate-200">Smart segmentation</Badge>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full table-fixed text-left text-sm text-slate-200">
            <thead>
              <tr className="text-xs uppercase tracking-[0.2em] text-slate-500">
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Tags</th>
                <th className="px-4 py-3">Voice Print</th>
                <th className="px-4 py-3">WhatsApp</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {contactsData.map((contact) => {
                const voiceProfile = contact.voiceProfileId;
                return (
                  <tr key={contact.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-white">{contact.name}</span>
                        {contact.email ? <span className="text-xs text-slate-500">{contact.email}</span> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">{contact.phone}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {contact.tags.map((tag) => (
                          <span key={`${contact.id}-${tag}`} className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] uppercase tracking-[0.14em] text-slate-400">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {voiceProfile ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-200">
                          <ShieldCheck className="h-3 w-3" />
                          {contact.voiceModelVersion ?? 'atlas-mfcc-v1'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-3 py-1 text-xs text-rose-200">
                          <AlertCircle className="h-3 w-3" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs ${
                          contact.whatsappOptIn ? 'bg-emerald-500/10 text-emerald-200' : 'bg-slate-700/50 text-slate-400'
                        }`}
                      >
                        <Send className="h-3 w-3" />
                        {contact.whatsappOptIn ? 'Opted-in' : 'Opt-out'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{format(new Date(contact.createdAt), 'MMM d, yyyy')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
