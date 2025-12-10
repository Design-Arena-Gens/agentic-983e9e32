import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requestTranscriptionFromRecording, upsertTranscript } from '@/lib/transcription';

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const call = await prisma.call.findUnique({
    where: { id },
  });

  if (!call) {
    return NextResponse.json({ error: 'Call not found' }, { status: 404 });
  }

  if (!call.recordingUrl) {
    return NextResponse.json({ error: 'Call does not have a recording URL' }, { status: 400 });
  }

  try {
    const transcription = await requestTranscriptionFromRecording(call.recordingUrl);

    await upsertTranscript({
      callId: call.id,
      text: transcription.text ?? '',
      redacted: transcription.text ?? '',
      keywords: transcription.auto_highlights_result?.results?.map((item) => item.text) ?? [],
      language: (transcription as { language?: string; language_code?: string }).language ??
        (transcription as { language_code?: string }).language_code ??
        null,
    });

    return NextResponse.json({ transcription });
  } catch (error) {
    console.error('Failed to transcribe call', error);
    return NextResponse.json({ error: 'Failed to transcribe call' }, { status: 500 });
  }
}
