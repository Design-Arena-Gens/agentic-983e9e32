import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateCallInsights, persistInsights } from '@/lib/insights';

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const call = await prisma.call.findUnique({
    where: { id },
    include: {
      contact: true,
      transcript: true,
    },
  });

  if (!call) {
    return NextResponse.json({ error: 'Call not found' }, { status: 404 });
  }

  if (!call.transcript?.text) {
    return NextResponse.json({ error: 'Transcript not available' }, { status: 400 });
  }

  try {
    const insights = await generateCallInsights({
      transcript: call.transcript.text,
      contactName: call.contact?.name,
      conversationContext: call.subject ?? undefined,
    });

    await persistInsights({ callId: call.id, insights });

    return NextResponse.json({ insights });
  } catch (error) {
    console.error('Failed to generate call insights', error);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}
