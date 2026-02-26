import React, { Suspense, useState, useCallback, Component } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, Sparkles, OrbitControls, Sky } from '@react-three/drei';
import {
    EffectComposer,
    Bloom,
    Vignette,
    Noise,
    GodRays,
} from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import * as THREE from 'three';

import Sunflower from './Sunflower';
import GodRaySource from './GodRaySource';
import { useSunPosition } from '../hooks/useSunPosition';
import { usePartnerLocation } from '../hooks/usePartnerLocation';
import { useDeviceOrientation } from '../hooks/useDeviceOrientation';
import { useFlowerRotation } from '../hooks/useFlowerRotation';
import { useHeartbeat } from '../hooks/useHeartbeat';

// Mobile detection
const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/**
 * Error boundary that catches WebGL / postprocessing crashes
 * and renders children without the crashing subtree.
 */
class PostProcessingErrorBoundary extends Component {
    state = { hasError: false };
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(err) {
        console.warn('[Sunflower] Postprocessing error, disabling effects:', err);
    }
    render() {
        if (this.state.hasError) return null;
        return this.props.children;
    }
}

/** Simple gradient background for mobile — no HDR loading needed */
function GradientBackground() {
    return (
        <>
            <color attach="background" args={['#8B7355']} />
            <mesh position={[0, 5, -15]} scale={[40, 20, 1]}>
                <planeGeometry />
                <meshBasicMaterial
                    color="#C4A882"
                    transparent
                    opacity={0.6}
                    side={THREE.DoubleSide}
                />
            </mesh>
            <mesh position={[0, 15, -15]} scale={[40, 20, 1]}>
                <planeGeometry />
                <meshBasicMaterial
                    color="#9BB8D3"
                    transparent
                    opacity={0.5}
                    side={THREE.DoubleSide}
                />
            </mesh>
        </>
    );
}

function SceneContent() {
    const [sunMesh, setSunMesh] = useState(null);
    const sunRef = useCallback((node) => {
        if (node) setSunMesh(node);
    }, []);

    const { position: sunPosition } = useSunPosition();
    const { bearing, distance } = usePartnerLocation();
    const { heading } = useDeviceOrientation();
    const flowerRef = useFlowerRotation(bearing, heading);
    const heartbeatScale = useHeartbeat(distance);

    return (
        <>
            {/* Background — HDR environment on desktop, simple gradient on mobile */}
            {isMobile ? (
                <GradientBackground />
            ) : (
                <Environment preset="sunset" background backgroundBlurriness={0.8} />
            )}

            {/* Fog for atmosphere */}
            <fog attach="fog" args={['#1a0f00', 8, 30]} />

            {/* Main directional light matching sun position */}
            <directionalLight
                position={sunPosition}
                intensity={2.5}
                color="#FFD080"
                castShadow={!isMobile}
                shadow-mapSize={isMobile ? [512, 512] : [1024, 1024]}
                shadow-camera-far={50}
                shadow-camera-left={-10}
                shadow-camera-right={10}
                shadow-camera-top={10}
                shadow-camera-bottom={-10}
            />

            {/* Warm ambient fill — brighter on mobile to compensate for no Environment */}
            <ambientLight intensity={isMobile ? 0.7 : 0.3} color="#FFE0A0" />

            {/* Hemisphere light for mobile — fills in the missing HDR illumination */}
            {isMobile && (
                <hemisphereLight
                    args={['#87CEEB', '#8B7355', 0.6]}
                />
            )}

            {/* Backlight for enhanced SSS — behind the flower */}
            <pointLight
                position={[-3, 4, -5]}
                intensity={1.5}
                color="#FF8C00"
                distance={20}
                decay={2}
            />

            {/* Rim light from below */}
            <pointLight
                position={[0, -2, 3]}
                intensity={0.8}
                color="#FFD700"
                distance={15}
                decay={2}
            />

            {/* Extra fill light on mobile for visibility */}
            {isMobile && (
                <pointLight
                    position={[3, 2, 5]}
                    intensity={0.8}
                    color="#FFF0D0"
                    distance={20}
                    decay={2}
                />
            )}

            {/* The Sunflower — tilted slightly toward viewer */}
            <group ref={flowerRef} position={[0, -0.5, 0]}>
                <group rotation={[0.15, 0, 0]}>
                    <Sunflower heartbeatScale={heartbeatScale} />
                </group>
            </group>

            {/* God Ray light source — desktop only */}
            {!isMobile && (
                <GodRaySource position={sunPosition} sunRef={sunRef} />
            )}

            {/* Floating dust motes — wide atmospheric */}
            <Sparkles
                count={isMobile ? 60 : 200}
                scale={[12, 8, 12]}
                size={isMobile ? 2 : 3}
                speed={0.3}
                opacity={0.5}
                color="#FFD700"
                noise={1}
            />

            {/* Intimate sparkles near the flower */}
            <Sparkles
                count={isMobile ? 20 : 80}
                scale={[3, 3, 3]}
                position={[0, 0.5, 0]}
                size={2}
                speed={0.15}
                opacity={0.7}
                color="#FFF8E1"
                noise={0.5}
            />

            {/* Orbit controls */}
            <OrbitControls
                enablePan={false}
                enableZoom={true}
                minDistance={2}
                maxDistance={12}
                minPolarAngle={Math.PI / 6}
                maxPolarAngle={Math.PI / 2.2}
                autoRotate
                autoRotateSpeed={0.3}
                enableDamping
                dampingFactor={0.05}
                target={[0, 0.3, 0]}
            />

            {/* Postprocessing — desktop only, wrapped in error boundary */}
            {!isMobile && sunMesh && (
                <PostProcessingErrorBoundary>
                    <EffectComposer multisampling={0}>
                        <GodRays
                            sun={sunMesh}
                            blendFunction={BlendFunction.SCREEN}
                            samples={30}
                            density={0.94}
                            decay={0.94}
                            weight={0.35}
                            exposure={0.4}
                            clampMax={1}
                            kernelSize={KernelSize.SMALL}
                        />
                        <Bloom
                            intensity={0.5}
                            luminanceThreshold={0.7}
                            luminanceSmoothing={0.3}
                            kernelSize={KernelSize.LARGE}
                        />
                        <Noise
                            premultiply
                            blendFunction={BlendFunction.ADD}
                            opacity={0.03}
                        />
                        <Vignette
                            offset={0.3}
                            darkness={0.7}
                            blendFunction={BlendFunction.NORMAL}
                        />
                    </EffectComposer>
                </PostProcessingErrorBoundary>
            )}
        </>
    );
}

export default function Scene() {
    return (
        <Canvas
            shadows={!isMobile}
            camera={{
                position: [0, 1.5, 5],
                fov: 45,
                near: 0.1,
                far: 100,
            }}
            gl={{
                antialias: !isMobile,
                toneMapping: THREE.ACESFilmicToneMapping,
                toneMappingExposure: 1.2,
                outputColorSpace: THREE.SRGBColorSpace,
                powerPreference: isMobile ? 'low-power' : 'high-performance',
                // Fallback to WebGL1 if WebGL2 is unavailable
                failIfMajorPerformanceCaveat: false,
            }}
            dpr={isMobile ? [1, 1.5] : [1, 2]}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
            }}
            onCreated={(state) => {
                // Log WebGL capabilities for debugging
                const gl = state.gl;
                console.log('[Sunflower] WebGL renderer:', gl.info);
                console.log('[Sunflower] Max textures:', gl.capabilities.maxTextures);
                console.log('[Sunflower] Mobile mode:', isMobile);
            }}
        >
            <Suspense fallback={null}>
                <SceneContent />
            </Suspense>
        </Canvas>
    );
}
