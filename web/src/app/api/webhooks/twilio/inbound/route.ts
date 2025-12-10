import { NextResponse } from 'next/server';
import { createCallRecord } from '@/lib/calls';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const formData = await request.formData();
  const from = formData.get('From')?.toString();
  const to = formData.get('To')?.toString();
  const callSid = formData.get('CallSid')?.toString();
  const recordingUrl = formData.get('RecordingUrl')?.toString();

  if (!from || !to) {
    return new NextResponse('<Response><Say>Invalid call payload.</Say></Response>', {
      status: 400,
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  const contact = await prisma.contact.findUnique({
    where: { phone: from.replace('whatsapp:', '').replace('tel:', '') },
  });

  await createCallRecord({
    contactId: contact?.id,
    to,
    subject: 'Inbound call',
    direction: 'INBOUND',
    recordingUrl: recordingUrl ?? null,
    metadata: {
      inboundFrom: from,
      twilioSid: callSid,
    },
  });

  const twiml = `<Response>
  <Say voice="Polly.Joanna">Hello${contact ? ` ${contact.name}` : ''}, thanks for calling. An AI agent will assist you now.</Say>
  <Record timeout="3" transcribe="false" />
</Response>`;

  return new NextResponse(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}

export const dynamic = 'force-dynamic';
