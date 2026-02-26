import { useState, useEffect } from 'react';

/**
 * Simple solar position calculator.
 * Returns azimuth (0-360, 0=North) and elevation (-90 to 90) in degrees.
 */
function calcSunPosition(date, lat, lon) {
    const rad = Math.PI / 180;
    const dayOfYear = Math.floor(
        (date - new Date(date.getFullYear(), 0, 0)) / 86400000
    );

    // Solar declination (simplified)
    const declination = -23.45 * Math.cos(rad * (360 / 365) * (dayOfYear + 10));

    // Hour angle
    const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60;
    const solarNoon = 12 - lon / 15;
    const hourAngle = (utcHours - solarNoon) * 15;

    // Elevation
    const sinElev =
        Math.sin(lat * rad) * Math.sin(declination * rad) +
        Math.cos(lat * rad) * Math.cos(declination * rad) * Math.cos(hourAngle * rad);
    const elevation = Math.asin(sinElev) / rad;

    // Azimuth
    const cosAz =
        (Math.sin(declination * rad) - Math.sin(lat * rad) * sinElev) /
        (Math.cos(lat * rad) * Math.cos(elevation * rad));
    let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) / rad;
    if (hourAngle > 0) azimuth = 360 - azimuth;

    return { azimuth, elevation };
}

export function useSunPosition(lat = 28.6139, lon = 77.2090) {
    const [sunPos, setSunPos] = useState({ azimuth: 220, elevation: 15 });

    useEffect(() => {
        const update = () => {
            const pos = calcSunPosition(new Date(), lat, lon);
            setSunPos(pos);
        };

        update();
        const interval = setInterval(update, 60000); // Update every minute
        return () => clearInterval(interval);
    }, [lat, lon]);

    // Convert azimuth/elevation to 3D position for the light
    const azRad = (sunPos.azimuth * Math.PI) / 180;
    const elRad = (Math.max(sunPos.elevation, 5) * Math.PI) / 180; // Clamp above horizon

    const distance = 15;
    const x = distance * Math.cos(elRad) * Math.sin(azRad);
    const y = distance * Math.sin(elRad);
    const z = distance * Math.cos(elRad) * Math.cos(azRad);

    return {
        azimuth: sunPos.azimuth,
        elevation: sunPos.elevation,
        position: [x, y, z],
    };
}
