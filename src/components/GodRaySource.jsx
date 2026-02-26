import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

/**
 * A small emissive sphere at the sun position used as the occlusion source
 * for the GodRays postprocessing effect.
 */
export default function GodRaySource({ position, sunRef }) {
    const meshRef = useRef();

    // Pulsating intensity to simulate atmospheric shimmer
    useFrame((state) => {
        if (!meshRef.current) return;
        const t = state.clock.elapsedTime;
        const pulse = 1.0 + Math.sin(t * 0.3) * 0.1;
        meshRef.current.material.emissiveIntensity = 1.8 * pulse;
    });

    // Assign ref to parent's callback ref so Scene can pass it to GodRays
    const setRef = (el) => {
        meshRef.current = el;
        if (sunRef) sunRef(el);
    };

    return (
        <mesh ref={setRef} position={position}>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial
                color="#FFD700"
                emissive="#FF9500"
                emissiveIntensity={1.8}
                transparent
                opacity={0.7}
                toneMapped={false}
            />
        </mesh>
    );
}
