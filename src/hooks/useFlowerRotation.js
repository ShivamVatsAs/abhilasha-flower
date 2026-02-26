import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Smoothly rotates the flower to face the partner.
 * targetBearing: degrees clockwise from north (0-360)
 * deviceHeading: degrees clockwise from north (0-360)
 * Returns a ref to attach to the flower group.
 */
export function useFlowerRotation(targetBearing, deviceHeading) {
    const groupRef = useRef();
    const currentRotation = useRef(0);

    useFrame((_, delta) => {
        if (!groupRef.current) return;

        // The flower should face: bearing relative to device heading
        // Convert to radians
        const relativeAngle = ((targetBearing - deviceHeading + 360) % 360) * (Math.PI / 180);

        // Smooth lerp — damping factor creates organic, heavy movement
        const dampingFactor = 1 - Math.pow(0.001, delta); // ~2-3s settle time
        currentRotation.current = THREE.MathUtils.lerp(
            currentRotation.current,
            relativeAngle,
            dampingFactor * 0.8
        );

        // Apply rotation around Y axis
        groupRef.current.rotation.y = currentRotation.current;
    });

    return groupRef;
}
