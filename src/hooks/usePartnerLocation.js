import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { getDistance, getGreatCircleBearing } from 'geolib';

// Mock partner location (Taj Mahal, India) for demo when Supabase not configured
const MOCK_PARTNER = { lat: 27.1751, lon: 78.0421 };
const MOCK_SELF = { lat: 28.6139, lon: 77.2090 }; // Delhi

const USER_ID = crypto.randomUUID();

export function usePartnerLocation() {
    const [partnerLat, setPartnerLat] = useState(MOCK_PARTNER.lat);
    const [partnerLon, setPartnerLon] = useState(MOCK_PARTNER.lon);
    const [selfLat, setSelfLat] = useState(MOCK_SELF.lat);
    const [selfLon, setSelfLon] = useState(MOCK_SELF.lon);
    const [isConnected, setIsConnected] = useState(false);
    const channelRef = useRef(null);

    // Calculate distance and bearing
    const distance = getDistance(
        { latitude: selfLat, longitude: selfLon },
        { latitude: partnerLat, longitude: partnerLon }
    );

    const bearing = getGreatCircleBearing(
        { latitude: selfLat, longitude: selfLon },
        { latitude: partnerLat, longitude: partnerLon }
    );

    // Watch own position
    useEffect(() => {
        if (!navigator.geolocation) return;

        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                setSelfLat(pos.coords.latitude);
                setSelfLon(pos.coords.longitude);
            },
            (err) => console.warn('Geolocation error:', err),
            { enableHighAccuracy: true, maximumAge: 5000 }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    // Subscribe to Supabase presence
    useEffect(() => {
        if (!isSupabaseConfigured || !supabase) {
            setIsConnected(false);
            return;
        }

        const channel = supabase.channel('sunflower-location', {
            config: { presence: { key: USER_ID } },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                // Find the other user's presence
                for (const [key, presences] of Object.entries(state)) {
                    if (key !== USER_ID && presences.length > 0) {
                        const p = presences[0];
                        setPartnerLat(p.lat);
                        setPartnerLon(p.lon);
                    }
                }
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    setIsConnected(true);
                    await channel.track({ lat: selfLat, lon: selfLon });
                }
            });

        channelRef.current = channel;

        return () => {
            channel.unsubscribe();
            channelRef.current = null;
        };
    }, []);

    // Update own presence when position changes
    useEffect(() => {
        if (channelRef.current && isConnected) {
            channelRef.current.track({ lat: selfLat, lon: selfLon });
        }
    }, [selfLat, selfLon, isConnected]);

    return { partnerLat, partnerLon, selfLat, selfLon, distance, bearing, isConnected };
}
