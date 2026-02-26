import { useState, useEffect, useRef } from 'react';

export function useDeviceOrientation() {
    const [heading, setHeading] = useState(0);
    const [isSupported, setIsSupported] = useState(false);
    const simulatedRef = useRef(0);

    useEffect(() => {
        // Check if DeviceOrientationEvent is available
        const hasOrientation = 'DeviceOrientationEvent' in window;

        if (hasOrientation) {
            const handleOrientation = (event) => {
                // webkitCompassHeading for iOS, alpha for Android
                let compassHeading = event.webkitCompassHeading ?? (360 - (event.alpha || 0));
                setHeading(compassHeading);
                setIsSupported(true);
            };

            // iOS 13+ requires permission
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                // Permission will be requested on first user gesture (handled in UI)
                window.__requestOrientationPermission = async () => {
                    try {
                        const result = await DeviceOrientationEvent.requestPermission();
                        if (result === 'granted') {
                            window.addEventListener('deviceorientation', handleOrientation, true);
                            setIsSupported(true);
                        }
                    } catch (e) {
                        console.warn('Orientation permission denied:', e);
                    }
                };
            } else {
                window.addEventListener('deviceorientation', handleOrientation, true);
            }

            return () => {
                window.removeEventListener('deviceorientation', handleOrientation, true);
            };
        }

        // Desktop fallback: slowly drift the heading for visual demo
        setIsSupported(false);
        const interval = setInterval(() => {
            simulatedRef.current = (simulatedRef.current + 0.15) % 360;
            setHeading(simulatedRef.current);
        }, 50);

        return () => clearInterval(interval);
    }, []);

    return { heading, isSupported };
}
