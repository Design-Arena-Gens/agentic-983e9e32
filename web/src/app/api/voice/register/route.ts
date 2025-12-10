import { NextResponse } from 'next/server';
import { z } from 'zod';
import { storeVoiceProfile } from '@/lib/voice';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  contactId: z.string(),
  vector: z.array(z.number()),
  recordingUrl: z.string().optional(),
  modelVersion: z.string().default('mfcc-v1'),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const contact = await prisma.contact.findUnique({
    where: { id: parsed.data.contactId },
  });

  if (!contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
  }

  try {
    const profile = await storeVoiceProfile(parsed.data);
    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Failed to register voice profile', error);
    return NextResponse.json({ error: 'Failed to register voice profile' }, { status: 500 });
  }
}
