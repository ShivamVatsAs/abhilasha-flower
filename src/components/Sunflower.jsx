import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { isMobile, isLowEnd } from '../lib/deviceDetect';

/* ---------- constants ---------- */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ≈ 137.508°

/* ================================================================
   Petal shape — wider in the middle, pointed tip, narrow base
   ================================================================ */
function createPetalShape(widthScale = 1) {
    const shape = new THREE.Shape();
    const w = widthScale;
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.08 * w, 0.06, 0.16 * w, 0.22, 0.15 * w, 0.42);
    shape.bezierCurveTo(0.14 * w, 0.58, 0.11 * w, 0.74, 0.06 * w, 0.88);
    shape.bezierCurveTo(0.03 * w, 0.94, 0.008 * w, 0.98, 0, 1.0);
    shape.bezierCurveTo(-0.008 * w, 0.98, -0.03 * w, 0.94, -0.06 * w, 0.88);
    shape.bezierCurveTo(-0.11 * w, 0.74, -0.14 * w, 0.58, -0.15 * w, 0.42);
    shape.bezierCurveTo(-0.16 * w, 0.22, -0.08 * w, 0.06, 0, 0);
    return shape;
}

/* ================================================================
   Curved petal geometry with longitudinal curl and transverse channel
   ================================================================ */
function createCurvedPetalGeometry(petalShape, ring, randomSeed) {
    const extrudeSettings = isMobile
        ? { depth: 0.008, bevelEnabled: false, curveSegments: 4 }
        : {
            depth: 0.008,
            bevelEnabled: true,
            bevelThickness: 0.003,
            bevelSize: 0.004,
            bevelSegments: 2,
            curveSegments: 10,
        };

    const geom = new THREE.ExtrudeGeometry(petalShape, extrudeSettings);

    // Deform vertices for natural curvature
    const posAttr = geom.attributes.position;
    const arr = posAttr.array;
    for (let i = 0; i < posAttr.count; i++) {
        const x = arr[i * 3];
        const y = arr[i * 3 + 1];
        const z = arr[i * 3 + 2];

        // Longitudinal curl — petals curl backward more at tips, outer rings curl more
        const curlAmount = 0.06 + ring * 0.03 + randomSeed * 0.015;
        arr[i * 3 + 2] = z + Math.pow(y, 2.2) * curlAmount;

        // Transverse channel — slight gutter shape
        const channelDepth = 0.018 + ring * 0.01;
        arr[i * 3 + 2] += Math.pow(Math.abs(x) * 6, 2) * channelDepth * (1 - y * 0.4);

        // Slight natural twist
        arr[i * 3 + 2] += x * y * (0.10 + randomSeed * 0.06);

        // Subtle lateral wave for organic feel (desktop only)
        if (!isMobile) {
            arr[i * 3] += Math.sin(y * Math.PI * 2) * 0.005 * (1 + randomSeed);
        }
    }
    posAttr.needsUpdate = true;
    geom.computeVertexNormals();
    return geom;
}

/* ================================================================
   Sepal (bract) shape — shorter, narrower, pointed
   ================================================================ */
function createSepalShape() {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.05, 0.05, 0.09, 0.18, 0.08, 0.35);
    shape.bezierCurveTo(0.06, 0.52, 0.03, 0.7, 0.01, 0.85);
    shape.bezierCurveTo(0.005, 0.92, 0, 0.97, 0, 1.0);
    shape.bezierCurveTo(0, 0.97, -0.005, 0.92, -0.01, 0.85);
    shape.bezierCurveTo(-0.03, 0.7, -0.06, 0.52, -0.08, 0.35);
    shape.bezierCurveTo(-0.09, 0.18, -0.05, 0.05, 0, 0);
    return shape;
}

/* ================================================================
   Individual Petal component
   ================================================================ */
function Petal({ index, total, ring, ringRadius, timeOffset, heartbeatScale, petalTexture, goldenOffset }) {
    const meshRef = useRef();
    const angle = (index / total) * Math.PI * 2 + goldenOffset;

    // Per-petal random variations (seeded from index for stability)
    const randomSeed = useMemo(() => {
        const s = Math.sin(index * 127.1 + ring * 311.7) * 43758.5453;
        return s - Math.floor(s); // 0-1 deterministic pseudo-random
    }, [index, ring]);

    const widthVariation = useMemo(() => 0.85 + randomSeed * 0.3, [randomSeed]);
    const petalShape = useMemo(() => createPetalShape(widthVariation), [widthVariation]);
    const geometry = useMemo(() => createCurvedPetalGeometry(petalShape, ring, randomSeed), [petalShape, ring, randomSeed]);

    const petalLength = 0.78 + ring * 0.24 + (randomSeed - 0.5) * 0.08;

    // Per-ring tilt — inner petals more upright, outer droop outward
    const baseTilt = -(Math.PI / 2) + 0.55 - ring * 0.24;

    // Natural per-petal variation
    const randomDroop = useMemo(() => (randomSeed - 0.5) * 0.14, [randomSeed]);
    const randomTwist = useMemo(() => (randomSeed - 0.5) * 0.08, [randomSeed]);

    // Frame counter for throttling on mobile
    const frameCountRef = useRef(0);

    useFrame((state) => {
        if (!meshRef.current) return;

        if (isMobile) {
            frameCountRef.current++;
            const skipFrames = isLowEnd ? 3 : 2;
            if (frameCountRef.current % skipFrames !== 0) return;
        }

        const t = state.clock.elapsedTime + timeOffset;

        // Organic wind sway
        const windStrength = 0.014 + ring * 0.007;
        const swayX = Math.sin(t * 0.55 + index * 0.45) * windStrength;
        const swayZ = Math.cos(t * 0.4 + index * 0.35) * windStrength * 0.6;

        meshRef.current.rotation.x = baseTilt + randomDroop + swayX;
        meshRef.current.rotation.z = randomTwist + swayZ;

        if (heartbeatScale) {
            const s = heartbeatScale.current || 1;
            meshRef.current.scale.setScalar(s * petalLength);
        }
    });

    // Material — MeshPhysicalMaterial for subsurface scattering
    const material = useMemo(() => {
        if (isMobile) {
            return (
                <meshStandardMaterial
                    map={petalTexture}
                    roughness={0.5}
                    metalness={0.0}
                    side={THREE.DoubleSide}
                    emissive="#FFB300"
                    emissiveIntensity={0.06}
                    transparent
                    alphaTest={0.1}
                />
            );
        }

        // Desktop: MeshPhysicalMaterial with SSS
        if (!petalTexture) return null;
        const t = petalTexture.clone();
        t.needsUpdate = true;
        // Slight per-petal texture rotation for variety
        t.rotation = (randomSeed - 0.5) * 0.25;
        t.center.set(0.5, 0.5);

        return (
            <meshPhysicalMaterial
                map={t}
                roughness={0.42}
                metalness={0.0}
                side={THREE.DoubleSide}
                transparent
                alphaTest={0.1}
                // Subsurface scattering effect
                transmission={0.15}
                thickness={0.8}
                attenuationColor="#FF8C00"
                attenuationDistance={0.5}
                // Sheen for velvety petal surface
                sheen={0.4}
                sheenRoughness={0.5}
                sheenColor="#FFD700"
                // Clearcoat for slight gloss like real petals
                clearcoat={0.08}
                clearcoatRoughness={0.6}
                emissive="#FFB300"
                emissiveIntensity={0.03}
            />
        );
    }, [petalTexture, randomSeed]);

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
            {material}
        </mesh>
    );
}

/* ================================================================
   Sepal (bract) — green leaf-like structures behind the petals
   ================================================================ */
function Sepal({ index, total }) {
    const angle = (index / total) * Math.PI * 2;
    const sepalShape = useMemo(() => createSepalShape(), []);
    const geometry = useMemo(() => {
        const extrudeSettings = isMobile
            ? { depth: 0.006, bevelEnabled: false, curveSegments: 3 }
            : { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.003, bevelSegments: 1, curveSegments: 6 };

        const geom = new THREE.ExtrudeGeometry(sepalShape, extrudeSettings);

        // Curl sepals outward and slightly downward
        const posAttr = geom.attributes.position;
        const arr = posAttr.array;
        for (let i = 0; i < posAttr.count; i++) {
            const y = arr[i * 3 + 1];
            const z = arr[i * 3 + 2];
            arr[i * 3 + 2] = z + Math.pow(y, 1.8) * 0.12;
        }
        posAttr.needsUpdate = true;
        geom.computeVertexNormals();
        return geom;
    }, [sepalShape]);

    const sepalLength = 0.45 + (index % 3) * 0.05;
    const tilt = -(Math.PI / 2) + 0.85; // more tilted outward than petals
    const randomDroop = useMemo(() => (Math.sin(index * 173.3) * 0.5 + 0.5 - 0.5) * 0.1, [index]);

    return (
        <mesh
            geometry={geometry}
            position={[
                Math.cos(angle) * 0.36,
                -0.04,
                Math.sin(angle) * 0.36,
            ]}
            rotation={[tilt + randomDroop, -angle + Math.PI / 2, 0]}
            scale={[sepalLength, sepalLength, 1]}
        >
            <meshStandardMaterial
                color="#4A7A2E"
                roughness={0.6}
                metalness={0.02}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
}

/* ================================================================
   Center disc — realistic seed head
   ================================================================ */
function CenterDisc({ discTexture }) {
    const meshRef = useRef();
    const frameCountRef = useRef(0);

    useFrame((state) => {
        if (!meshRef.current) return;
        if (isMobile) {
            frameCountRef.current++;
            if (frameCountRef.current % 2 !== 0) return;
        }
        meshRef.current.rotation.y = state.clock.elapsedTime * 0.012;
    });

    const segments = isMobile ? 24 : 40;

    return (
        <group ref={meshRef}>
            {/* Main disc body */}
            <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.28, 0.32, 0.07, segments]} />
                <meshStandardMaterial
                    map={discTexture}
                    roughness={0.92}
                    metalness={0.02}
                    bumpMap={isMobile ? null : discTexture}
                    bumpScale={0.06}
                />
            </mesh>

            {/* Raised center dome — flattened sphere for puffy seed look */}
            <mesh position={[0, 0.10, 0]} scale={[1, 0.6, 1]}>
                <sphereGeometry args={isMobile ? [0.22, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.2] : [0.22, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2.2]} />
                <meshStandardMaterial
                    map={discTexture}
                    roughness={0.94}
                    metalness={0.03}
                    bumpMap={isMobile ? null : discTexture}
                    bumpScale={0.07}
                />
            </mesh>

            {/* Emissive floret ring — where disc meets petals */}
            {!isMobile && (
                <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[0.31, 0.012, 8, segments]} />
                    <meshStandardMaterial
                        color="#6B8E23"
                        roughness={0.7}
                        emissive="#8B9A1B"
                        emissiveIntensity={0.15}
                    />
                </mesh>
            )}
        </group>
    );
}

/* ================================================================
   Stem — organic tube with trichome hairs
   ================================================================ */
function Stem() {
    const curve = useMemo(() => {
        return new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, -3.5, 0),
            new THREE.Vector3(0.05, -2.8, 0.04),
            new THREE.Vector3(-0.03, -2.0, -0.02),
            new THREE.Vector3(0.04, -1.2, 0.015),
            new THREE.Vector3(-0.015, -0.5, -0.01),
            new THREE.Vector3(0, 0, 0),
        ]);
    }, []);

    const geometry = useMemo(() => {
        if (isMobile) {
            return new THREE.TubeGeometry(curve, 14, 0.048, 6, false);
        }

        try {
            const tubeSegments = 28;
            const radialSegments = 10;
            const points = curve.getPoints(tubeSegments);
            const frames = curve.computeFrenetFrames(tubeSegments, false);

            const vertices = [];
            const normals = [];
            const uvs = [];
            const indices = [];
            const colors = [];

            for (let i = 0; i <= tubeSegments; i++) {
                const t = i / tubeSegments;
                // Taper: thicker at base, thinner at top
                const radius = 0.058 - t * 0.022;
                // Slight irregular cross section
                const N = frames.normals[i];
                const B = frames.binormals[i];
                const P = points[i];

                for (let j = 0; j <= radialSegments; j++) {
                    const theta = (j / radialSegments) * Math.PI * 2;
                    const sin = Math.sin(theta);
                    const cos = Math.cos(theta);

                    // Subtle irregularity in radius
                    const irregularity = 1 + Math.sin(theta * 3 + t * 5) * 0.03;
                    const r = radius * irregularity;

                    const nx = cos * N.x + sin * B.x;
                    const ny = cos * N.y + sin * B.y;
                    const nz = cos * N.z + sin * B.z;

                    vertices.push(P.x + r * nx, P.y + r * ny, P.z + r * nz);
                    normals.push(nx, ny, nz);
                    uvs.push(j / radialSegments, t);

                    // Color gradient: darker at base, lighter near bloom
                    const baseColor = new THREE.Color('#1E4A10');
                    const tipColor = new THREE.Color('#3A6B25');
                    const c = baseColor.clone().lerp(tipColor, t);
                    colors.push(c.r, c.g, c.b);
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
            geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            geom.setIndex(indices);
            geom.computeVertexNormals();
            return geom;
        } catch (e) {
            console.warn('[Sunflower] Tapered stem failed, falling back:', e);
            return new THREE.TubeGeometry(curve, 14, 0.048, 6, false);
        }
    }, [curve]);

    // Trichome hairs along the stem (desktop only)
    const hairs = useMemo(() => {
        if (isMobile) return [];
        const hairData = [];
        const numHairs = 60;
        for (let i = 0; i < numHairs; i++) {
            const t = 0.1 + (i / numHairs) * 0.75;
            const p = curve.getPoint(t);
            const tangent = curve.getTangent(t);
            const hairAngle = (i * GOLDEN_ANGLE * 3) % (Math.PI * 2);
            const hairLen = 0.015 + Math.random() * 0.012;
            hairData.push({ position: [p.x, p.y, p.z], angle: hairAngle, length: hairLen, tangent });
        }
        return hairData;
    }, [curve]);

    return (
        <group>
            <mesh geometry={geometry}>
                <meshStandardMaterial
                    color="#2D5A1E"
                    vertexColors={!isMobile}
                    roughness={0.62}
                    metalness={0.04}
                />
            </mesh>

            {/* Stem trichome hairs */}
            {hairs.map((hair, i) => (
                <mesh
                    key={i}
                    position={hair.position}
                    rotation={[0, hair.angle, Math.PI / 2 - 0.3]}
                    scale={[1, 1, 1]}
                >
                    <cylinderGeometry args={[0.001, 0.0005, hair.length, 3]} />
                    <meshStandardMaterial color="#4A7030" roughness={0.8} transparent opacity={0.7} />
                </mesh>
            ))}
        </group>
    );
}

/* ================================================================
   Leaf — serrated edges, veins, texture-mapped
   ================================================================ */
function Leaf({ side, yPos, leafTexture }) {
    const leafShape = useMemo(() => {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);

        // Serrated edge — right side
        const serrationsR = 8;
        for (let i = 1; i <= serrationsR; i++) {
            const t = i / serrationsR;
            const baseWidth = Math.sin(t * Math.PI) * 0.38;
            const serrationDepth = 0.02 * Math.sin(t * Math.PI);
            const y = t;
            if (i < serrationsR) {
                // tooth out
                shape.lineTo(baseWidth + serrationDepth, y - 0.01);
                // tooth in
                shape.lineTo(baseWidth - serrationDepth * 0.5, y + 0.02);
            } else {
                shape.lineTo(0, 1.0); // pointed tip
            }
        }

        // Serrated edge — left side (mirror)
        for (let i = serrationsR - 1; i >= 1; i--) {
            const t = i / serrationsR;
            const baseWidth = Math.sin(t * Math.PI) * 0.38;
            const serrationDepth = 0.02 * Math.sin(t * Math.PI);
            const y = t;
            shape.lineTo(-baseWidth - serrationDepth, y + 0.01);
            if (i > 1) {
                shape.lineTo(-baseWidth + serrationDepth * 0.5, y - 0.02);
            }
        }
        shape.lineTo(0, 0);

        return shape;
    }, []);

    const geometry = useMemo(() => {
        const geom = new THREE.ExtrudeGeometry(leafShape, {
            depth: 0.004,
            bevelEnabled: !isMobile,
            bevelThickness: 0.002,
            bevelSize: 0.003,
            bevelSegments: 1,
            curveSegments: isMobile ? 3 : 6,
        });

        // Deform for curvature
        const posAttr = geom.attributes.position;
        const arr = posAttr.array;
        for (let i = 0; i < posAttr.count; i++) {
            const x = arr[i * 3];
            const y = arr[i * 3 + 1];
            // Longitudinal droop
            arr[i * 3 + 2] += Math.pow(y, 2) * 0.10;
            // Transverse curl
            arr[i * 3 + 2] += Math.abs(x) * 0.08;
            // Slight wave
            if (!isMobile) {
                arr[i * 3 + 2] += Math.sin(y * Math.PI * 3) * 0.008;
            }
        }
        posAttr.needsUpdate = true;
        geom.computeVertexNormals();
        return geom;
    }, [leafShape]);

    const meshRef = useRef();
    const frameCountRef = useRef(0);

    useFrame((state) => {
        if (!meshRef.current) return;
        if (isMobile) {
            frameCountRef.current++;
            if (frameCountRef.current % 3 !== 0) return;
        }
        const t = state.clock.elapsedTime;
        meshRef.current.rotation.z = side * 0.3 + Math.sin(t * 0.35 + yPos) * 0.05;
    });

    const leafMaterial = useMemo(() => {
        if (leafTexture && !isMobile) {
            return (
                <meshStandardMaterial
                    map={leafTexture}
                    roughness={0.52}
                    metalness={0.02}
                    side={THREE.DoubleSide}
                    bumpMap={leafTexture}
                    bumpScale={0.02}
                />
            );
        }
        return (
            <meshStandardMaterial
                color="#3A7D28"
                roughness={0.55}
                metalness={0.02}
                side={THREE.DoubleSide}
            />
        );
    }, [leafTexture]);

    return (
        <group position={[side * 0.08, yPos, 0]} rotation={[0, 0, side * 0.8]}>
            <mesh ref={meshRef} geometry={geometry} scale={[0.65, 0.65, 1]}>
                {leafMaterial}
            </mesh>

            {/* Center vein */}
            {!isLowEnd && (
                <mesh position={[0, 0.32, 0.007]} scale={[0.65, 0.65, 1]}>
                    <cylinderGeometry args={[0.004, 0.002, 0.6, 4]} />
                    <meshStandardMaterial color="#2A5A18" roughness={0.7} />
                </mesh>
            )}

            {/* Secondary veins — desktop only */}
            {!isMobile && (
                <>
                    {[0.2, 0.35, 0.5, 0.65].map((veinY, i) => (
                        <React.Fragment key={i}>
                            <mesh
                                position={[0.06, veinY * 0.65, 0.006]}
                                rotation={[0, 0, -0.5]}
                                scale={[0.65, 0.65, 1]}
                            >
                                <cylinderGeometry args={[0.002, 0.001, 0.12, 3]} />
                                <meshStandardMaterial color="#2E6020" roughness={0.75} />
                            </mesh>
                            <mesh
                                position={[-0.06, veinY * 0.65, 0.006]}
                                rotation={[0, 0, 0.5]}
                                scale={[0.65, 0.65, 1]}
                            >
                                <cylinderGeometry args={[0.002, 0.001, 0.12, 3]} />
                                <meshStandardMaterial color="#2E6020" roughness={0.75} />
                            </mesh>
                        </React.Fragment>
                    ))}
                </>
            )}
        </group>
    );
}

/* ================================================================
   Main Sunflower component
   ================================================================ */
export default function Sunflower({ heartbeatScale }) {
    // Load textures
    const textures = useTexture(
        isMobile ? ['/petal.png', '/disc.png'] : ['/petal.png', '/disc.png', '/leaf.png']
    );
    const petalTexture = textures[0];
    const discTexture = textures[1];
    const leafTexture = textures[2] || null;

    // Configure textures
    useMemo(() => {
        petalTexture.wrapS = THREE.ClampToEdgeWrapping;
        petalTexture.wrapT = THREE.ClampToEdgeWrapping;
        petalTexture.colorSpace = THREE.SRGBColorSpace;

        if (isMobile) {
            petalTexture.generateMipmaps = false;
            petalTexture.minFilter = THREE.LinearFilter;
            petalTexture.magFilter = THREE.LinearFilter;
        } else {
            petalTexture.generateMipmaps = true;
            petalTexture.minFilter = THREE.LinearMipmapLinearFilter;
            petalTexture.magFilter = THREE.LinearFilter;
        }

        discTexture.wrapS = THREE.RepeatWrapping;
        discTexture.wrapT = THREE.RepeatWrapping;
        discTexture.colorSpace = THREE.SRGBColorSpace;

        if (isMobile) {
            discTexture.generateMipmaps = false;
            discTexture.minFilter = THREE.LinearFilter;
        }

        if (leafTexture) {
            leafTexture.wrapS = THREE.ClampToEdgeWrapping;
            leafTexture.wrapT = THREE.ClampToEdgeWrapping;
            leafTexture.colorSpace = THREE.SRGBColorSpace;
            leafTexture.generateMipmaps = true;
            leafTexture.minFilter = THREE.LinearMipmapLinearFilter;
        }
    }, [petalTexture, discTexture, leafTexture]);

    // Petal rings with Fibonacci golden-angle offsets between rings
    const petalRings = useMemo(() => {
        const rings = [];

        if (isLowEnd) {
            for (let i = 0; i < 11; i++) {
                rings.push({ index: i, total: 11, ring: 0, ringRadius: 0.33, timeOffset: i * 0.2, goldenOffset: 0 });
            }
            for (let i = 0; i < 18; i++) {
                rings.push({ index: i, total: 18, ring: 1, ringRadius: 0.42, timeOffset: i * 0.12 + 1, goldenOffset: GOLDEN_ANGLE * 0.5 });
            }
        } else if (isMobile) {
            for (let i = 0; i < 13; i++) {
                rings.push({ index: i, total: 13, ring: 0, ringRadius: 0.33, timeOffset: i * 0.2, goldenOffset: 0 });
            }
            for (let i = 0; i < 21; i++) {
                rings.push({ index: i, total: 21, ring: 1, ringRadius: 0.42, timeOffset: i * 0.1 + 1, goldenOffset: GOLDEN_ANGLE * 0.5 });
            }
        } else {
            // Desktop: full 3 rings with golden angle offsets
            for (let i = 0; i < 13; i++) {
                rings.push({ index: i, total: 13, ring: 0, ringRadius: 0.33, timeOffset: i * 0.2, goldenOffset: 0 });
            }
            for (let i = 0; i < 21; i++) {
                rings.push({ index: i, total: 21, ring: 1, ringRadius: 0.41, timeOffset: i * 0.15 + 1, goldenOffset: GOLDEN_ANGLE * 0.5 });
            }
            for (let i = 0; i < 34; i++) {
                rings.push({ index: i, total: 34, ring: 2, ringRadius: 0.50, timeOffset: i * 0.1 + 2, goldenOffset: GOLDEN_ANGLE });
            }
        }

        return rings;
    }, []);

    // Sepals
    const sepalCount = isMobile ? (isLowEnd ? 8 : 12) : 18;

    return (
        <group>
            {/* Flower head */}
            <group position={[0, 0.5, 0]}>
                {/* Sepals (bracts) behind petals */}
                {Array.from({ length: sepalCount }).map((_, i) => (
                    <Sepal key={`sepal-${i}`} index={i} total={sepalCount} />
                ))}

                {/* Petals */}
                {petalRings.map((petal, i) => (
                    <Petal
                        key={i}
                        {...petal}
                        heartbeatScale={heartbeatScale}
                        petalTexture={petalTexture}
                    />
                ))}

                {/* Center disc */}
                <CenterDisc discTexture={discTexture} />
            </group>

            {/* Stem */}
            <Stem />

            {/* Leaves — with texture on desktop */}
            <Leaf side={1} yPos={-1.2} leafTexture={leafTexture} />
            <Leaf side={-1} yPos={-2.0} leafTexture={leafTexture} />
            {!isLowEnd && <Leaf side={1} yPos={-2.8} leafTexture={leafTexture} />}
            {/* Extra leaf for fullness — desktop only */}
            {!isMobile && <Leaf side={-1} yPos={-0.6} leafTexture={leafTexture} />}
        </group>
    );
}
