'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { TrackReference, AgentState } from '@livekit/components-react';
import { ParticleSphereVisualizer } from './particle-sphere-visualizer';
import { cn } from '@/lib/utils';

interface AudioReactiveParticleSphereProps {
    trackRef?: TrackReference;
    state: AgentState;
    className?: string;
    size?: number;
}

export function AudioReactiveParticleSphere({
    trackRef,
    state,
    className,
    size = 300,
}: AudioReactiveParticleSphereProps) {
    const [audioLevel, setAudioLevel] = useState(0);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    const updateAudioLevel = useCallback(() => {
        if (!analyserRef.current) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average volume level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const average = sum / dataArray.length / 255; // Normalize to 0-1

        setAudioLevel(average);
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    }, []);

    useEffect(() => {
        if (!trackRef?.publication?.track) {
            setAudioLevel(0);
            return;
        }

        const track = trackRef.publication.track;
        const mediaStream = track.mediaStream;

        if (!mediaStream) {
            setAudioLevel(0);
            return;
        }

        // Create audio context and analyser
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;

        const source = audioContext.createMediaStreamSource(mediaStream);
        source.connect(analyser);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        sourceRef.current = source;

        // Start the audio level update loop
        updateAudioLevel();

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            if (sourceRef.current) {
                sourceRef.current.disconnect();
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
            analyserRef.current = null;
            audioContextRef.current = null;
            sourceRef.current = null;
        };
    }, [trackRef, updateAudioLevel]);

    return (
        <div className={cn('flex items-center justify-center', className)}>
            <ParticleSphereVisualizer
                state={state}
                audioLevel={audioLevel}
                size={size}
            />
        </div>
    );
}
