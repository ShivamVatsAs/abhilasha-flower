import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

// Mobile detection
const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/**
 * Photorealistic sunflower using texture-mapped petals
 * and a realistic center disc.
 */

function createPetalShape() {
    const shape = new THREE.Shape();
    // Realistic sunflower petal: narrow base, widening in middle, tapering to pointed tip
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.06, 0.08, 0.14, 0.25, 0.13, 0.45);
    shape.bezierCurveTo(0.12, 0.6, 0.09, 0.75, 0.05, 0.88);
    shape.bezierCurveTo(0.02, 0.95, 0.005, 0.98, 0, 1.0);
    shape.bezierCurveTo(-0.005, 0.98, -0.02, 0.95, -0.05, 0.88);
    shape.bezierCurveTo(-0.09, 0.75, -0.12, 0.6, -0.13, 0.45);
    shape.bezierCurveTo(-0.14, 0.25, -0.06, 0.08, 0, 0);
    return shape;
}

function createCurvedPetalGeometry(petalShape, ring) {
    const extrudeSettings = isMobile
        ? { depth: 0.008, bevelEnabled: false, curveSegments: 4 }
        : {
            depth: 0.008,
            bevelEnabled: true,
            bevelThickness: 0.003,
            bevelSize: 0.004,
            bevelSegments: 2,
            curveSegments: 8,
        };

    const geom = new THREE.ExtrudeGeometry(petalShape, extrudeSettings);

    if (!isMobile) {
        const posAttr = geom.attributes.position;
        const arr = posAttr.array;
        for (let i = 0; i < posAttr.count; i++) {
            const x = arr[i * 3];
            const y = arr[i * 3 + 1];
            const z = arr[i * 3 + 2];

            // Longitudinal curve — petals curl backward at tip
            const curlAmount = 0.05 + ring * 0.025;
            arr[i * 3 + 2] = z + Math.pow(y, 2) * curlAmount;

            // Transverse curve — slight channel shape
            const channelDepth = 0.015 + ring * 0.008;
            arr[i * 3 + 2] += Math.pow(Math.abs(x) * 6, 2) * channelDepth * (1 - y * 0.5);

            // Slight twist
            arr[i * 3 + 2] += x * y * 0.12;
        }
        posAttr.needsUpdate = true;
    }

    geom.computeVertexNormals();
    return geom;
}

function Petal({ index, total, ring, ringRadius, timeOffset, heartbeatScale, petalTexture }) {
    const meshRef = useRef();
    const angle = (index / total) * Math.PI * 2;
    const petalShape = useMemo(() => createPetalShape(), []);
    const geometry = useMemo(() => createCurvedPetalGeometry(petalShape, ring), [petalShape, ring]);

    const petalLength = 0.75 + ring * 0.22;

    // Per-ring tilt — inner more upright, outer droop outward
    const baseTilt = -(Math.PI / 2) + 0.6 - ring * 0.22;

    // Natural variation
    const randomDroop = useMemo(() => (Math.random() - 0.5) * 0.12, []);
    const randomTwist = useMemo(() => (Math.random() - 0.5) * 0.06, []);

    // Slight hue shift per petal for natural variation
    const hueShift = useMemo(() => (Math.random() - 0.5) * 0.06, []);

    useFrame((state) => {
        if (!meshRef.current) return;
        const t = state.clock.elapsedTime + timeOffset;

        const windStrength = 0.012 + ring * 0.006;
        const swayX = Math.sin(t * 0.6 + index * 0.4) * windStrength;
        const swayZ = Math.cos(t * 0.45 + index * 0.3) * windStrength * 0.7;

        meshRef.current.rotation.x = baseTilt + randomDroop + swayX;
        meshRef.current.rotation.z = randomTwist + swayZ;

        if (heartbeatScale) {
            const s = heartbeatScale.current || 1;
            meshRef.current.scale.setScalar(s * petalLength);
        }
    });

    // Clone texture so each petal can have independent settings
    const clonedTexture = useMemo(() => {
        if (!petalTexture) return null;
        const t = petalTexture.clone();
        t.needsUpdate = true;
        // Rotate texture slightly per petal for variation
        t.rotation = hueShift * 0.3;
        t.center.set(0.5, 0.5);
        return t;
    }, [petalTexture, hueShift]);

    return (
        <mesh
            ref={meshRef}
            geometry={geometry}
            position={[
                Math.cos(angle) * ringRadius,
                0.02,
                Math.sin(angle) * ringRadius,
            ]}
            rotation={[baseTilt + randomDroop, -angle + Math.PI / 2, randomTwist]}
            scale={[petalLength, petalLength, 1]}
        >
            <meshStandardMaterial
                map={clonedTexture}
                roughness={0.45}
                metalness={0.0}
                side={THREE.DoubleSide}
                emissive="#FFB300"
                emissiveIntensity={0.04}
                transparent
                alphaTest={0.1}
            />
        </mesh>
    );
}

function CenterDisc({ discTexture }) {
    const meshRef = useRef();

    useFrame((state) => {
        if (!meshRef.current) return;
        meshRef.current.rotation.y = state.clock.elapsedTime * 0.015;
    });

    return (
        <group ref={meshRef}>
            {/* Main disc with texture */}
            <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.30, 0.33, 0.08, 32]} />
                <meshStandardMaterial
                    map={discTexture}
                    roughness={0.9}
                    metalness={0.02}
                    bumpMap={discTexture}
                    bumpScale={0.04}
                />
            </mesh>
            {/* Raised center dome for 3D effect */}
            <mesh position={[0, 0.11, 0]}>
                <sphereGeometry args={[0.20, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2.5]} />
                <meshStandardMaterial
                    map={discTexture}
                    roughness={0.92}
                    metalness={0.03}
                    bumpMap={discTexture}
                    bumpScale={0.05}
                />
            </mesh>
        </group>
    );
}

function Stem() {
    const curve = useMemo(() => {
        return new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, -3.5, 0),
            new THREE.Vector3(0.04, -2.8, 0.03),
            new THREE.Vector3(-0.02, -2.0, -0.02),
            new THREE.Vector3(0.03, -1.2, 0.01),
            new THREE.Vector3(-0.01, -0.5, -0.01),
            new THREE.Vector3(0, 0, 0),
        ]);
    }, []);

    const geometry = useMemo(() => {
        if (isMobile) {
            return new THREE.TubeGeometry(curve, 16, 0.045, 6, false);
        }

        try {
            const tubeSegments = 24;
            const radialSegments = 8;
            const points = curve.getPoints(tubeSegments);
            const frames = curve.computeFrenetFrames(tubeSegments, false);

            const vertices = [];
            const normals = [];
            const uvs = [];
            const indices = [];

            for (let i = 0; i <= tubeSegments; i++) {
                const t = i / tubeSegments;
                const radius = 0.055 - t * 0.02;
                const N = frames.normals[i];
                const B = frames.binormals[i];
                const P = points[i];

                for (let j = 0; j <= radialSegments; j++) {
                    const theta = (j / radialSegments) * Math.PI * 2;
                    const sin = Math.sin(theta);
                    const cos = Math.cos(theta);

                    const nx = cos * N.x + sin * B.x;
                    const ny = cos * N.y + sin * B.y;
                    const nz = cos * N.z + sin * B.z;

                    vertices.push(P.x + radius * nx, P.y + radius * ny, P.z + radius * nz);
                    normals.push(nx, ny, nz);
                    uvs.push(j / radialSegments, t);
                }
            }

            for (let i = 0; i < tubeSegments; i++) {
                for (let j = 0; j < radialSegments; j++) {
                    const a = i * (radialSegments + 1) + j;
                    const b = a + 1;
                    const c = (i + 1) * (radialSegments + 1) + j;
                    const d = c + 1;
                    indices.push(a, b, c);
                    indices.push(b, d, c);
                }
            }

            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
            geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            geom.setIndex(indices);
            geom.computeVertexNormals();
            return geom;
        } catch (e) {
            console.warn('[Sunflower] Tapered stem failed, falling back:', e);
            return new THREE.TubeGeometry(curve, 16, 0.045, 6, false);
        }
    }, [curve]);

    return (
        <mesh geometry={geometry}>
            <meshStandardMaterial
                color="#2D5A1E"
                roughness={0.65}
                metalness={0.05}
            />
        </mesh>
    );
}

function Leaf({ side, yPos }) {
    const leafShape = useMemo(() => {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.bezierCurveTo(0.18, 0.08, 0.32, 0.22, 0.42, 0.5);
        shape.bezierCurveTo(0.38, 0.72, 0.18, 0.88, 0, 1.0);
        shape.bezierCurveTo(-0.06, 0.65, -0.03, 0.3, 0, 0);
        return shape;
    }, []);

    const geometry = useMemo(() => {
        const geom = new THREE.ExtrudeGeometry(leafShape, {
            depth: 0.004,
            bevelEnabled: !isMobile,
            bevelThickness: 0.002,
            bevelSize: 0.003,
            bevelSegments: 1,
        });

        if (!isMobile) {
            const posAttr = geom.attributes.position;
            const arr = posAttr.array;
            for (let i = 0; i < posAttr.count; i++) {
                const x = arr[i * 3];
                const y = arr[i * 3 + 1];
                arr[i * 3 + 2] += Math.pow(y, 2) * 0.08;
                arr[i * 3 + 2] += Math.abs(x) * 0.06;
            }
            posAttr.needsUpdate = true;
        }

        geom.computeVertexNormals();
        return geom;
    }, [leafShape]);

    const meshRef = useRef();
    useFrame((state) => {
        if (!meshRef.current) return;
        const t = state.clock.elapsedTime;
        meshRef.current.rotation.z = side * 0.3 + Math.sin(t * 0.35 + yPos) * 0.04;
    });

    return (
        <group position={[side * 0.08, yPos, 0]} rotation={[0, 0, side * 0.8]}>
            <mesh
                ref={meshRef}
                geometry={geometry}
                scale={[0.6, 0.6, 1]}
            >
                <meshStandardMaterial
                    color="#3A7D28"
                    roughness={0.55}
                    metalness={0.02}
                    side={THREE.DoubleSide}
                />
            </mesh>
            {/* Center vein */}
            <mesh
                position={[0, 0.3, 0.006]}
                scale={[0.6, 0.6, 1]}
            >
                <cylinderGeometry args={[0.003, 0.002, 0.55, 4]} />
                <meshStandardMaterial color="#2A5A18" roughness={0.7} />
            </mesh>
        </group>
    );
}

export default function Sunflower({ heartbeatScale }) {
    // Load textures using drei's useTexture (handles caching and loading)
    const [petalTexture, discTexture] = useTexture(['/petal.png', '/disc.png']);

    // Configure petal texture
    useMemo(() => {
        petalTexture.wrapS = THREE.ClampToEdgeWrapping;
        petalTexture.wrapT = THREE.ClampToEdgeWrapping;
        petalTexture.colorSpace = THREE.SRGBColorSpace;
        petalTexture.generateMipmaps = true;
        petalTexture.minFilter = THREE.LinearMipmapLinearFilter;
        petalTexture.magFilter = THREE.LinearFilter;

        discTexture.wrapS = THREE.RepeatWrapping;
        discTexture.wrapT = THREE.RepeatWrapping;
        discTexture.colorSpace = THREE.SRGBColorSpace;
    }, [petalTexture, discTexture]);

    const petalRings = useMemo(() => {
        const rings = [];

        // Inner ring — 13 petals
        for (let i = 0; i < 13; i++) {
            rings.push({ index: i, total: 13, ring: 0, ringRadius: 0.33, timeOffset: i * 0.2 });
        }
        // Middle ring — 21 petals (skip on mobile for perf)
        if (!isMobile) {
            for (let i = 0; i < 21; i++) {
                rings.push({ index: i, total: 21, ring: 1, ringRadius: 0.40, timeOffset: i * 0.15 + 1 });
            }
        }
        // Outer ring
        const outerCount = isMobile ? 21 : 34;
        for (let i = 0; i < outerCount; i++) {
            rings.push({
                index: i,
                total: outerCount,
                ring: isMobile ? 1 : 2,
                ringRadius: isMobile ? 0.42 : 0.48,
                timeOffset: i * 0.1 + 2,
            });
        }

        return rings;
    }, []);

    return (
        <group>
            {/* Flower head */}
            <group position={[0, 0.5, 0]}>
                {petalRings.map((petal, i) => (
                    <Petal
                        key={i}
                        {...petal}
                        heartbeatScale={heartbeatScale}
                        petalTexture={petalTexture}
                    />
                ))}
                <CenterDisc discTexture={discTexture} />
            </group>

            {/* Stem */}
            <Stem />

            {/* Leaves */}
            <Leaf side={1} yPos={-1.2} />
            <Leaf side={-1} yPos={-2.0} />
            <Leaf side={1} yPos={-2.8} />
        </group>
    );
}
