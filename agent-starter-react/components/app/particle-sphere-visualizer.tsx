'use client';

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { type AgentState } from '@livekit/components-react';
import { cn } from '@/lib/utils';

interface ParticleSphereVisualizerProps {
    state: AgentState;
    audioLevel?: number;
    className?: string;
    size?: number;
}

interface Particle {
    x: number;
    y: number;
    z: number;
    originalX: number;
    originalY: number;
    originalZ: number;
    size: number;
}

export function ParticleSphereVisualizer({
    state,
    audioLevel = 0,
    className,
    size = 300,
}: ParticleSphereVisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | null>(null);
    const particlesRef = useRef<Particle[]>([]);
    const rotationRef = useRef({ x: 0, y: 0 });
    const audioLevelRef = useRef(0);

    // Generate particles in a sphere shape
    const generateParticles = useCallback((radius: number): Particle[] => {
        const particles: Particle[] = [];
        const numParticles = 800; // Number of particles
        const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle

        for (let i = 0; i < numParticles; i++) {
            const y = 1 - (i / (numParticles - 1)) * 2; // y goes from 1 to -1
            const radiusAtY = Math.sqrt(1 - y * y);
            const theta = phi * i;

            const x = Math.cos(theta) * radiusAtY;
            const z = Math.sin(theta) * radiusAtY;

            // Add some randomness for natural look
            const randomOffset = 0.02;
            const rx = x * radius + (Math.random() - 0.5) * randomOffset * radius;
            const ry = y * radius + (Math.random() - 0.5) * randomOffset * radius;
            const rz = z * radius + (Math.random() - 0.5) * randomOffset * radius;

            particles.push({
                x: rx,
                y: ry,
                z: rz,
                originalX: rx,
                originalY: ry,
                originalZ: rz,
                size: 1 + Math.random() * 1.5,
            });
        }

        return particles;
    }, []);

    // Initialize particles
    useEffect(() => {
        const radius = size * 0.35;
        particlesRef.current = generateParticles(radius);
    }, [size, generateParticles]);

    // Update audio level ref
    useEffect(() => {
        audioLevelRef.current = audioLevel;
    }, [audioLevel]);

    // Animation loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size with device pixel ratio for sharpness
        const dpr = window.devicePixelRatio || 1;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        ctx.scale(dpr, dpr);

        const centerX = size / 2;
        const centerY = size / 2;
        const focalLength = size;

        const animate = () => {
            // Clear canvas with transparent background
            ctx.clearRect(0, 0, size, size);

            const isSpeaking = state === 'speaking';
            const isThinking = state === 'thinking';
            const isListening = state === 'listening';
            const isConnecting = state === 'connecting';

            // Rotation speed varies based on state
            let rotationSpeed = 0.002; // Base rotation
            if (isSpeaking) {
                rotationSpeed = 0.008 + audioLevelRef.current * 0.02;
            } else if (isThinking) {
                rotationSpeed = 0.02;
            } else if (isListening) {
                rotationSpeed = 0.003;
            } else if (isConnecting) {
                rotationSpeed = 0.015;
            }

            rotationRef.current.y += rotationSpeed;
            rotationRef.current.x = Math.sin(Date.now() * 0.0005) * 0.1; // Reduced X wobble

            const cosY = Math.cos(rotationRef.current.y);
            const sinY = Math.sin(rotationRef.current.y);
            const cosX = Math.cos(rotationRef.current.x);
            const sinX = Math.sin(rotationRef.current.x);

            // Calculate expansion factor based on audio
            const expansionFactor = isSpeaking ? 1 + audioLevelRef.current * 0.8 : 1;
            const pulseOffset = isSpeaking
                ? Math.sin(Date.now() * 0.01) * audioLevelRef.current * 30
                : isThinking
                    ? Math.sin(Date.now() * 0.008) * 5
                    : 0;

            // Project and sort particles by z-depth
            const projectedParticles: Array<{
                x: number;
                y: number;
                z: number;
                size: number;
                alpha: number;
            }> = [];

            for (const particle of particlesRef.current) {
                // Apply expansion and pulse
                let px = particle.originalX * expansionFactor;
                let py = particle.originalY * expansionFactor;
                let pz = particle.originalZ * expansionFactor;

                // Add pulse effect for speaking
                if (isSpeaking) {
                    const dist = Math.sqrt(px * px + py * py + pz * pz);
                    const pulseWave = Math.sin(dist * 0.05 - Date.now() * 0.005) * pulseOffset;
                    const norm = dist > 0 ? pulseWave / dist : 0;
                    px += px * norm * 0.5;
                    py += py * norm * 0.5;
                    pz += pz * norm * 0.5;
                }

                // Rotation around Y axis
                const x1 = px * cosY - pz * sinY;
                const z1 = px * sinY + pz * cosY;

                // Rotation around X axis
                const y1 = py * cosX - z1 * sinX;
                const z2 = py * sinX + z1 * cosX;

                // Perspective projection
                const scale = focalLength / (focalLength + z2);
                const projectedX = centerX + x1 * scale;
                const projectedY = centerY + y1 * scale;

                // Calculate alpha based on z-depth for 3D effect
                const normalizedZ = (z2 + size * 0.35) / (size * 0.7);
                const alpha = 0.2 + normalizedZ * 0.8;

                projectedParticles.push({
                    x: projectedX,
                    y: projectedY,
                    z: z2,
                    size: particle.size * scale * (isSpeaking ? 1 + audioLevelRef.current * 0.8 : 1),
                    alpha: Math.max(0.1, Math.min(1, alpha)),
                });
            }

            // Sort by z-depth (back to front)
            projectedParticles.sort((a, b) => b.z - a.z);

            // Draw particles
            for (const p of projectedParticles) {
                // Color based on state - using cyan/blue/slate palette to blend with UI
                let r, g, b;

                if (isSpeaking) {
                    // Cyan/Teal for speaking (matches cyan-400)
                    r = 34;
                    g = 211;
                    b = 238;
                } else if (isThinking) {
                    // Violet/Purple pulse for thinking
                    r = 167;
                    g = 139;
                    b = 250;
                } else if (isListening) {
                    // White/Blue tint for listening (attentive)
                    r = 224;
                    g = 242;
                    b = 254;
                } else if (isConnecting) {
                    // Amber/Yellow for connecting
                    r = 251;
                    g = 191;
                    b = 36;
                } else {
                    // Default slate/cyan
                    r = 148;
                    g = 163;
                    b = 184;
                }

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.alpha})`;
                ctx.fill();
            }

            // Add subtle glow effect for speaking state
            if (isSpeaking && audioLevelRef.current > 0.05) {
                const gradient = ctx.createRadialGradient(
                    centerX, centerY, size * 0.2,
                    centerX, centerY, size * 0.6
                );
                gradient.addColorStop(0, `rgba(34, 211, 238, ${audioLevelRef.current * 0.2})`);
                gradient.addColorStop(1, 'rgba(34, 211, 238, 0)');
                ctx.beginPath();
                ctx.arc(centerX, centerY, size * 0.6, 0, Math.PI * 2);
                ctx.fillStyle = gradient;
                ctx.fill();
            }

            animationRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [size, state]);

    return (
        <div className={cn('flex items-center justify-center', className)}>
            <canvas
                ref={canvasRef}
                style={{ width: size, height: size }}
                className="rounded-full"
            />
        </div>
    );
}
