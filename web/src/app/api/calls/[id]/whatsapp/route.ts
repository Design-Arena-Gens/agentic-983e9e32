import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendWhatsappMessage } from '@/lib/whatsapp';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  body: z.string().min(1),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const call = await prisma.call.findUnique({
    where: { id },
    include: {
      contact: true,
    },
  });

  if (!call) {
    return NextResponse.json({ error: 'Call not found' }, { status: 404 });
  }

  if (!call.contact?.phone) {
    return NextResponse.json({ error: 'Contact phone not available' }, { status: 400 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    const message = await sendWhatsappMessage({
      to: call.contact.phone,
      body: parsed.data.body,
      callId: call.id,
    });

    return NextResponse.json({ messageId: message.sid });
  } catch (error) {
    console.error('Failed to send WhatsApp message', error);
    return NextResponse.json({ error: 'Failed to send WhatsApp message' }, { status: 500 });
  }
}
