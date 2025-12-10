import { DashboardShell, type DashboardCall, type DashboardContact, type DashboardMetrics } from '@/components/dashboard/dashboard-shell';
import { prisma } from '@/lib/prisma';

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => typeof item === 'string');
    }
    return [];
  } catch {
    return [];
  }
}

function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => typeof item === 'string');
    }
    return [];
  } catch {
    return [];
  }
}

export default async function Home() {
  const [contacts, calls] = await Promise.all([
    prisma.contact.findMany({
      include: {
        voiceProfile: true,
        calls: {
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.call.findMany({
      orderBy: { startedAt: 'desc' },
      take: 12,
      include: {
        contact: true,
        transcript: true,
      },
    }),
  ]);

  const contactsPayload: DashboardContact[] = contacts.map((contact) => ({
    id: contact.id,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    company: contact.company,
    whatsappOptIn: contact.whatsappOptIn,
    tags: parseTags(contact.tags),
    notes: contact.notes,
    createdAt: contact.createdAt.toISOString(),
    voiceProfileId: contact.voiceProfile?.id ?? null,
    voiceModelVersion: contact.voiceProfile?.modelVersion ?? null,
  }));

  const callsPayload: DashboardCall[] = calls.map((call) => ({
    id: call.id,
    direction: call.direction === 'INBOUND' ? 'INBOUND' : 'OUTBOUND',
    status: call.status,
    subject: call.subject,
    startedAt: call.startedAt.toISOString(),
    endedAt: call.endedAt ? call.endedAt.toISOString() : null,
    sentimentScore: call.sentimentScore,
    sentimentLabel: call.sentimentLabel,
    summary: call.summary,
    highlights: parseJsonArray(call.highlights),
    actions: parseJsonArray(call.actions),
    contact: call.contact
      ? {
          id: call.contact.id,
          name: call.contact.name,
          phone: call.contact.phone,
        }
      : null,
    transcript: call.transcript
      ? {
          text: call.transcript.text,
        }
      : null,
  }));

  const metrics: DashboardMetrics = {
    totalContacts: contacts.length,
    totalCalls: calls.length,
    voiceProfiles: contacts.filter((contact) => contact.voiceProfile).length,
    positiveSentiment: calls.filter((call) => call.sentimentLabel === 'positive').length,
    tasksPending: calls.reduce((acc, call) => acc + parseJsonArray(call.actions).length, 0),
    whatsappOptIns: contacts.filter((contact) => contact.whatsappOptIn).length,
  };

  return <DashboardShell contacts={contactsPayload} calls={callsPayload} metrics={metrics} />;
}
