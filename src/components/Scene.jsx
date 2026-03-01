import React, { Suspense, useState, useCallback, useEffect, Component } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Environment, Sparkles, OrbitControls } from '@react-three/drei';
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
import { isMobile, isLowEnd, safeDpr } from '../lib/deviceDetect';

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

/** Simple warm gradient background for mobile — no HDR loading needed */
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

/**
 * Adaptive performance monitor — watches FPS and lowers pixel ratio
 * if the device is struggling. This prevents freezes on low-end phones.
 */
function PerformanceMonitor() {
    const { gl } = useThree();
    const frameTimesRef = React.useRef([]);
    const lowFpsCountRef = React.useRef(0);

    useFrame(() => {
        const now = performance.now();
        const frameTimes = frameTimesRef.current;
        frameTimes.push(now);

        // Keep last 60 frame timestamps
        while (frameTimes.length > 60) frameTimes.shift();

        if (frameTimes.length < 30) return; // Need enough samples

        // Calculate average FPS over the window
        const elapsed = frameTimes[frameTimes.length - 1] - frameTimes[0];
        const avgFps = ((frameTimes.length - 1) / elapsed) * 1000;

        if (avgFps < 20) {
            lowFpsCountRef.current++;
            // If consistently low FPS, reduce pixel ratio
            if (lowFpsCountRef.current > 3) {
                const currentDpr = gl.getPixelRatio();
                if (currentDpr > 1) {
                    const newDpr = Math.max(1, currentDpr - 0.25);
                    gl.setPixelRatio(newDpr);
                    console.log(`[Sunflower] Reducing DPR to ${newDpr} for performance`);
                    lowFpsCountRef.current = 0;
                    frameTimesRef.current = [];
                }
            }
        } else {
            lowFpsCountRef.current = Math.max(0, lowFpsCountRef.current - 1);
        }
    });

    return null;
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
            {/* Adaptive performance monitor */}
            {isMobile && <PerformanceMonitor />}

            {/* Background — HDR environment on desktop, simple gradient on mobile */}
            {isMobile ? (
                <GradientBackground />
            ) : (
                <Environment preset="sunset" background backgroundBlurriness={0.8} />
            )}

            {/* Fog for atmosphere — shorter range on mobile */}
            <fog attach="fog" args={['#1a0f00', isMobile ? 6 : 8, isMobile ? 20 : 30]} />

            {/* Main directional light matching sun position */}
            <directionalLight
                position={sunPosition}
                intensity={2.8}
                color="#FFD080"
                castShadow={false}
                shadow-mapSize={[512, 512]}
            />

            {/* Warm ambient fill — brighter on mobile to compensate for no Environment */}
            <ambientLight intensity={isMobile ? 0.8 : 0.3} color="#FFE0A0" />

            {/* Hemisphere light for mobile — fills in the missing HDR illumination */}
            {isMobile && (
                <hemisphereLight
                    args={['#87CEEB', '#8B7355', 0.6]}
                />
            )}

            {/* Backlight for enhanced SSS — behind the flower */}
            {!isLowEnd && (
                <pointLight
                    position={[-3, 4, -5]}
                    intensity={2.2}
                    color="#FF8C00"
                    distance={20}
                    decay={2}
                />
            )}

            {/* Rim light from below — skip on low-end */}
            {!isLowEnd && (
                <pointLight
                    position={[0, -2, 3]}
                    intensity={0.8}
                    color="#FFD700"
                    distance={15}
                    decay={2}
                />
            )}

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

            {/* Floating dust motes — reduced on mobile */}
            <Sparkles
                count={isLowEnd ? 30 : isMobile ? 50 : 200}
                scale={[12, 8, 12]}
                size={isMobile ? 2 : 3}
                speed={0.3}
                opacity={0.5}
                color="#FFD700"
                noise={1}
            />

            {/* Intimate sparkles near the flower — skip on low-end */}
            {!isLowEnd && (
                <Sparkles
                    count={isMobile ? 15 : 80}
                    scale={[3, 3, 3]}
                    position={[0, 0.5, 0]}
                    size={2}
                    speed={0.15}
                    opacity={0.7}
                    color="#FFF8E1"
                    noise={0.5}
                />
            )}

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

            {/* Postprocessing — desktop gets full suite, mobile gets subtle bloom only */}
            {isMobile ? (
                !isLowEnd && (
                    <PostProcessingErrorBoundary>
                        <EffectComposer multisampling={0}>
                            <Bloom
                                intensity={0.3}
                                luminanceThreshold={0.8}
                                luminanceSmoothing={0.4}
                                kernelSize={KernelSize.SMALL}
                            />
                        </EffectComposer>
                    </PostProcessingErrorBoundary>
                )
            ) : (
                sunMesh && (
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
                )
            )}
        </>
    );
}

/** Loading overlay shown while the 3D scene is loading */
function LoadingScreen({ ready }) {
    const [fadeOut, setFadeOut] = useState(false);
    const [hidden, setHidden] = useState(false);

    useEffect(() => {
        if (ready) {
            // Start fade-out after a small delay to ensure first frame is rendered
            const t1 = setTimeout(() => setFadeOut(true), 300);
            const t2 = setTimeout(() => setHidden(true), 1800);
            return () => { clearTimeout(t1); clearTimeout(t2); };
        }
    }, [ready]);

    if (hidden) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'linear-gradient(180deg, #1a0f00 0%, #0d0800 100%)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000,
                opacity: fadeOut ? 0 : 1,
                transition: 'opacity 1.5s ease-in-out',
                pointerEvents: fadeOut ? 'none' : 'auto',
            }}
        >
            <div
                style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize: 'clamp(18px, 4vw, 28px)',
                    fontWeight: 300,
                    letterSpacing: '0.3em',
                    textTransform: 'uppercase',
                    color: 'rgba(255, 248, 225, 0.8)',
                    textShadow: '0 0 30px rgba(255, 183, 0, 0.4)',
                    marginBottom: '30px',
                }}
            >
                🌻
            </div>
            <div
                style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize: 'clamp(11px, 2.5vw, 14px)',
                    fontWeight: 300,
                    letterSpacing: '0.25em',
                    textTransform: 'uppercase',
                    color: 'rgba(255, 220, 130, 0.6)',
                    animation: 'pulse 2s ease-in-out infinite',
                }}
            >
                Blooming for you...
            </div>
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 1; }
                }
            `}</style>
        </div>
    );
}

export default function Scene() {
    const [loaded, setLoaded] = useState(false);

    return (
        <>
            <LoadingScreen ready={loaded} />
            <Canvas
                shadows={false}
                camera={{
                    position: [0, 1.5, 5],
                    fov: 45,
                    near: 0.1,
                    far: isMobile ? 50 : 100,
                }}
                gl={{
                    antialias: !isMobile,
                    toneMapping: THREE.ACESFilmicToneMapping,
                    toneMappingExposure: 1.35,
                    outputColorSpace: THREE.SRGBColorSpace,
                    powerPreference: isMobile ? 'low-power' : 'high-performance',
                    failIfMajorPerformanceCaveat: false,
                    // Limit precision on mobile to help GPU
                    precision: 'highp',
                }}
                dpr={[1, safeDpr]}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                }}
                onCreated={(state) => {
                    const gl = state.gl;
                    console.log('[Sunflower] WebGL renderer:', gl.info);
                    console.log('[Sunflower] Max textures:', gl.capabilities.maxTextures);
                    console.log('[Sunflower] Mobile mode:', isMobile);
                    console.log('[Sunflower] Low-end mode:', isLowEnd);
                    // Signal that the canvas is ready
                    setLoaded(true);
                }}
            >
                <Suspense fallback={null}>
                    <SceneContent />
                </Suspense>
            </Canvas>
        </>
    );
}
