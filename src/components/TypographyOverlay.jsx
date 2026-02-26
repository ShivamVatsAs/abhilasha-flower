import React, { useState, useRef, useEffect } from 'react';

/**
 * UI overlay — shows title, distance, and connection status.
 * On first load, text appears automatically then fades.
 * On subsequent touches, it reappears briefly.
 */
export default function TypographyOverlay({ distance, isConnected, hasPartner }) {
    const [visible, setVisible] = useState(true);
    const timerRef = useRef(null);
    const firstLoadRef = useRef(true);

    const handleInteraction = () => {
        setVisible(true);

        // Request orientation permission on first touch (iOS)
        if (window.__requestOrientationPermission) {
            window.__requestOrientationPermission();
            window.__requestOrientationPermission = null;
        }

        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setVisible(false), 3000);
    };

    useEffect(() => {
        if (firstLoadRef.current) {
            firstLoadRef.current = false;
            timerRef.current = setTimeout(() => setVisible(false), 4000);
        }

        window.addEventListener('pointerdown', handleInteraction);
        return () => {
            window.removeEventListener('pointerdown', handleInteraction);
            clearTimeout(timerRef.current);
        };
    }, []);

    // Format distance
    const formatDistance = (meters) => {
        if (meters == null) return null;
        if (meters < 1000) return `${Math.round(meters)}m away`;
        if (meters < 100000) return `${(meters / 1000).toFixed(1)}km away`;
        return `${Math.round(meters / 1000)}km away`;
    };

    // Determine what to show in the distance area
    const distanceText = formatDistance(distance);
    const showWaiting = !hasPartner || distance == null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                pointerEvents: 'none',
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '60px 24px',
                opacity: visible ? 1 : 0,
                transition: 'opacity 1s ease-in-out',
            }}
        >
            {/* Top — title */}
            <div
                style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize: 'clamp(14px, 3vw, 20px)',
                    fontWeight: 300,
                    letterSpacing: '0.3em',
                    textTransform: 'uppercase',
                    color: 'rgba(255, 248, 225, 0.7)',
                    textShadow: '0 0 30px rgba(255, 183, 0, 0.3)',
                    textAlign: 'center',
                }}
            >
                Eternal Golden Hour
            </div>

            {/* Bottom — distance + status */}
            <div
                style={{
                    textAlign: 'center',
                    fontFamily: "'Playfair Display', Georgia, serif",
                }}
            >
                <div
                    style={{
                        fontSize: showWaiting ? 'clamp(20px, 4.5vw, 32px)' : 'clamp(28px, 6vw, 48px)',
                        fontWeight: 400,
                        fontStyle: 'italic',
                        color: 'rgba(255, 220, 130, 0.9)',
                        textShadow: '0 0 40px rgba(255, 183, 0, 0.4)',
                        marginBottom: '8px',
                    }}
                >
                    {showWaiting ? 'Thinking of you...' : distanceText}
                </div>
                <div
                    style={{
                        fontSize: 'clamp(10px, 2vw, 13px)',
                        fontWeight: 300,
                        letterSpacing: '0.2em',
                        color: isConnected
                            ? hasPartner
                                ? 'rgba(180, 255, 180, 0.6)'
                                : 'rgba(255, 220, 150, 0.5)'
                            : 'rgba(255, 200, 150, 0.5)',
                        textTransform: 'uppercase',
                    }}
                >
                    {isConnected
                        ? hasPartner
                            ? '● connected'
                            : '○ waiting for her'
                        : '○ dreaming'
                    }
                </div>
            </div>
        </div>
    );
}
