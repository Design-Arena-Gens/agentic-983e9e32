import { NextResponse } from 'next/server';
import { upsertCallByTwilioSid } from '@/lib/calls';

export async function POST(request: Request) {
  const formData = await request.formData();
  const callSid = formData.get('CallSid')?.toString();
  const callStatus = formData.get('CallStatus')?.toString();
  const recordingUrl = formData.get('RecordingUrl')?.toString();

  if (!callSid) {
    return NextResponse.json({ error: 'Missing CallSid' }, { status: 400 });
  }

  await upsertCallByTwilioSid(callSid, {
    status: callStatus ?? undefined,
    recordingUrl: recordingUrl ?? undefined,
  });

  return new NextResponse('', {
    status: 204,
  });
}

export const dynamic = 'force-dynamic';
