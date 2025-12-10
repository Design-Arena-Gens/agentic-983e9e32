import { NextResponse } from 'next/server';
import { listRecentCalls } from '@/lib/calls';

export async function GET() {
  const calls = await listRecentCalls();

  const payload = calls.map((call) => ({
    id: call.id,
    direction: call.direction === 'INBOUND' ? 'INBOUND' : 'OUTBOUND',
    status: call.status,
    subject: call.subject,
    startedAt: call.startedAt.toISOString(),
    endedAt: call.endedAt ? call.endedAt.toISOString() : null,
    sentimentScore: call.sentimentScore,
    sentimentLabel: call.sentimentLabel,
    summary: call.summary,
    highlights: call.highlights ? safeParseArray(call.highlights) : [],
    actions: call.actions ? safeParseArray(call.actions) : [],
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

  return NextResponse.json({ calls: payload });
}

function safeParseArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => typeof item === 'string');
    }
    return [];
  } catch {
    return [];
  }
}
