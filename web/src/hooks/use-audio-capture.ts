 'use client';

import { useCallback, useRef, useState } from 'react';
import { computeVoicePrint } from '@/lib/audio/voiceprint';

interface VoiceCaptureResult {
  vector: number[];
  features: ReturnType<typeof computeVoicePrint>['features'];
  raw: Float32Array;
  sampleRate: number;
}

export function useAudioCapture() {
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const framesRef = useRef<Float32Array[]>([]);
  const [lastResult, setLastResult] = useState<VoiceCaptureResult | null>(null);

  const stop = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;

    const audioContext = audioContextRef.current;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());

    if (audioContext) {
      audioContext.close();
    }

    audioContextRef.current = null;
    mediaStreamRef.current = null;
    setIsRecording(false);
  }, []);

  const start = useCallback(async () => {
    if (isRecording) {
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;
    mediaStreamRef.current = stream;

    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    framesRef.current = [];

    processor.onaudioprocess = (event) => {
      const channelData = event.inputBuffer.getChannelData(0);
      framesRef.current.push(new Float32Array(channelData));
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
    processorRef.current = processor;
    setIsRecording(true);
  }, [isRecording]);

  const finish = useCallback(async () => {
    if (!isRecording) {
      return null;
    }

    const audioContext = audioContextRef.current;
    if (!audioContext) {
      stop();
      return null;
    }

    processorRef.current?.disconnect();
    processorRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;

    const frames = framesRef.current;
    const totalLength = frames.reduce((acc, frame) => acc + frame.length, 0);
    const result = new Float32Array(totalLength);

    let offset = 0;
    frames.forEach((frame) => {
      result.set(frame, offset);
      offset += frame.length;
    });

    const voicePrint = computeVoicePrint(result);
    const payload: VoiceCaptureResult = {
      vector: voicePrint.vector,
      features: voicePrint.features,
      raw: result,
      sampleRate: audioContext.sampleRate,
    };
    setLastResult(payload);

    audioContext.close();
    audioContextRef.current = null;
    setIsRecording(false);
    return payload;
  }, [isRecording, stop]);

  return {
    isRecording,
    start,
    finish,
    stop,
    lastResult,
  };
}
