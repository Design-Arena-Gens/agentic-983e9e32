import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyVoiceProfile } from '@/lib/voice';

const schema = z.object({
  contactId: z.string(),
  vector: z.array(z.number()),
  threshold: z.number().min(0).max(1).optional(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    const result = await verifyVoiceProfile(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to verify voice profile', error);
    return NextResponse.json({ error: 'Failed to verify voice profile' }, { status: 500 });
  }
}
