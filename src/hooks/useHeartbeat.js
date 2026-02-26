import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

/**
 * Proximity heartbeat pulse.
 * distance: meters to partner
 * Returns a ref whose .current is the pulse scale factor (centered around 1.0).
 */
export function useHeartbeat(distance) {
    const scaleRef = useRef(1);
    const timeRef = useRef(0);

    useFrame((_, delta) => {
        if (distance > 1000) {
            // Too far — no pulse, gracefully return to 1
            scaleRef.current += (1 - scaleRef.current) * 0.05;
            return;
        }

        // BPM scales from 60 (at 1000m) to 120 (at 0m)
        const t = 1 - Math.min(distance / 1000, 1);
        const bpm = 60 + t * 60;
        const frequency = bpm / 60; // beats per second

        timeRef.current += delta;

        // Heartbeat shape: double-bump like a real heartbeat
        const phase = (timeRef.current * frequency * Math.PI * 2) % (Math.PI * 2);
        const beat1 = Math.pow(Math.max(0, Math.sin(phase)), 4);
        const beat2 = Math.pow(Math.max(0, Math.sin(phase + 0.6)), 8) * 0.5;

        const intensity = 0.03 + t * 0.05; // Stronger pulse when closer
        scaleRef.current = 1 + (beat1 + beat2) * intensity;
    });

    return scaleRef;
}
