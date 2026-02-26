import { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { getDistance, getGreatCircleBearing } from 'geolib';

// Persist a stable user ID across refreshes so Supabase presence
// can distinguish "you" from "her" reliably.
function getOrCreateUserId() {
    const KEY = 'sunflower-user-id';
    let id = localStorage.getItem(KEY);
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(KEY, id);
    }
    return id;
}

const USER_ID = getOrCreateUserId();

export function usePartnerLocation() {
    // Self-location starts null — will be set by geolocation API
    const [selfLat, setSelfLat] = useState(null);
    const [selfLon, setSelfLon] = useState(null);

    // Partner-location starts null — will be set when a partner appears in presence
    const [partnerLat, setPartnerLat] = useState(null);
    const [partnerLon, setPartnerLon] = useState(null);

    const [isConnected, setIsConnected] = useState(false);
    const [hasPartner, setHasPartner] = useState(false);

    const channelRef = useRef(null);
    // Refs to hold latest self-location (avoids stale closures in callbacks)
    const selfLatRef = useRef(selfLat);
    const selfLonRef = useRef(selfLon);

    // Keep refs in sync with state
    useEffect(() => { selfLatRef.current = selfLat; }, [selfLat]);
    useEffect(() => { selfLonRef.current = selfLon; }, [selfLon]);

    // Calculate distance and bearing — only when both positions are known
    const hasBothPositions = selfLat != null && selfLon != null && partnerLat != null && partnerLon != null;

    const distance = hasBothPositions
        ? getDistance(
            { latitude: selfLat, longitude: selfLon },
            { latitude: partnerLat, longitude: partnerLon }
        )
        : null;

    const bearing = hasBothPositions
        ? getGreatCircleBearing(
            { latitude: selfLat, longitude: selfLon },
            { latitude: partnerLat, longitude: partnerLon }
        )
        : 0;

    // Watch own GPS position
    useEffect(() => {
        if (!navigator.geolocation) {
            console.warn('[Sunflower] Geolocation not available');
            return;
        }

        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                setSelfLat(pos.coords.latitude);
                setSelfLon(pos.coords.longitude);
            },
            (err) => console.warn('[Sunflower] Geolocation error:', err),
            { enableHighAccuracy: true, maximumAge: 5000 }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    // Subscribe to Supabase presence channel
    useEffect(() => {
        if (!isSupabaseConfigured || !supabase) {
            console.log('[Sunflower] Supabase not configured, skipping presence');
            setIsConnected(false);
            return;
        }

        const channel = supabase.channel('sunflower-location', {
            config: { presence: { key: USER_ID } },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                let foundPartner = false;

                // Find the other user's presence
                for (const [key, presences] of Object.entries(state)) {
                    if (key !== USER_ID && presences.length > 0) {
                        const p = presences[0];
                        if (p.lat != null && p.lon != null) {
                            setPartnerLat(p.lat);
                            setPartnerLon(p.lon);
                            foundPartner = true;
                        }
                    }
                }

                setHasPartner(foundPartner);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    setIsConnected(true);
                    // Use refs to broadcast the LATEST GPS position (not stale state)
                    const lat = selfLatRef.current;
                    const lon = selfLonRef.current;
                    if (lat != null && lon != null) {
                        await channel.track({ lat, lon });
                    }
                }
            });

        channelRef.current = channel;

        return () => {
            channel.unsubscribe();
            channelRef.current = null;
        };
    }, []);

    // Update own presence whenever GPS position changes
    useEffect(() => {
        if (channelRef.current && isConnected && selfLat != null && selfLon != null) {
            channelRef.current.track({ lat: selfLat, lon: selfLon });
        }
    }, [selfLat, selfLon, isConnected]);

    return {
        partnerLat,
        partnerLon,
        selfLat,
        selfLon,
        distance,
        bearing,
        isConnected,
        hasPartner,
    };
}
