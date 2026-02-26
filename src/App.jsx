import React from 'react';
import Scene from './components/Scene';
import TypographyOverlay from './components/TypographyOverlay';
import { usePartnerLocation } from './hooks/usePartnerLocation';

export default function App() {
  const { distance, isConnected, hasPartner } = usePartnerLocation();

  return (
    <>
      <Scene />
      <TypographyOverlay distance={distance} isConnected={isConnected} hasPartner={hasPartner} />
    </>
  );
}
