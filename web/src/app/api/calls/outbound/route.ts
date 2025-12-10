import { NextResponse } from 'next/server';
import { z } from 'zod';
import { initiateOutboundCall } from '@/lib/calls';
import { getEnv } from '@/lib/env';

const outboundSchema = z.object({
  contactId: z.string().optional(),
  to: z.string().min(5),
  subject: z.string().optional(),
  agentGreeting: z.string().optional(),
  whisperPrompt: z.string().optional(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = outboundSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    const env = getEnv();
    const callbackUrl =
      env.VERCEL_URL && env.VERCEL_URL.length
        ? `https://${env.VERCEL_URL}/api/webhooks/twilio/status`
        : undefined;

    const result = await initiateOutboundCall({
      ...parsed.data,
      statusCallbackUrl: callbackUrl,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Failed to initiate outbound call', error);
    return NextResponse.json({ error: 'Failed to initiate outbound call' }, { status: 500 });
  }
}
