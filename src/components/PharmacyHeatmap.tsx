import React, { useEffect, useState } from 'react';
import { useMap, APIProvider, Map } from '@vis.gl/react-google-maps';
import { GoogleMapsOverlay } from '@deck.gl/google-maps';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import { useTranslation } from "react-i18next";
import { useGoogleMapsStatus } from "../hooks/useGoogleMapsStatus";

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY' && API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY';

function DeckGlOverlay({ layers }: { layers: any[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const overlay = new GoogleMapsOverlay({ layers });
    overlay.setMap(map);
    return () => overlay.setMap(null);
  }, [map, layers]);
  return null;
}

export function PharmacyHeatmap({ pharmacies }: { pharmacies: any[] }) {
  const { t } = useTranslation();
  const { mapsFailed } = useGoogleMapsStatus();
  
  if (!hasValidKey || mapsFailed) {
    return (
      <div className="w-full h-[300px] bg-slate-100 dark:bg-zinc-800/80 rounded-xl flex items-center justify-center p-6 text-center border border-slate-200 dark:border-zinc-700">
        <div>
          <h2 className="font-bold text-slate-800 dark:text-white mb-1.5 text-sm uppercase tracking-wide">Carte de chaleur de la demande</h2>
          <p className="text-xs text-slate-600 dark:text-zinc-400 max-w-sm">
            {pharmacies.length} officines enregistrées dans la zone de couverture. Analyse de densité en temps réel.
          </p>
        </div>
      </div>
    );
  }

  // Generate heatmap data points based on pharmacies
  // In a real scenario, this would come from delivery/demand data
  // For visualization purposes, we use pharmacy locations (mocked or real)
  // Assuming pharmacy has lat, lng or coordinates
  
  const heatmapData = pharmacies.map(p => {
     // Generate some mock coordinates if none exist
     const lat = p.lat || p.coordinates?.lat || 37.7749 + (Math.random() - 0.5) * 0.1;
     const lng = p.lng || p.coordinates?.lng || -122.4194 + (Math.random() - 0.5) * 0.1;
     // Random weight for demand
     const weight = Math.floor(Math.random() * 10) + 1;
     return {
        position: [lng, lat], // deck.gl expects [lng, lat]
        weight
     };
  });

  const layers = [
    new HeatmapLayer({
      id: 'pharmacy-demand-heatmap',
      data: heatmapData,
      getPosition: (d: any) => d.position,
      getWeight: (d: any) => d.weight,
      radiusPixels: 40,
      intensity: 1,
      threshold: 0.05
    })
  ];

  return (
    <div className="w-full h-[300px] rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-zinc-800">
      <APIProvider apiKey={API_KEY} version="weekly">
        <Map
          defaultCenter={{lat: 37.7749, lng: -122.4194}}
          defaultZoom={12}
          mapId="PHARMACY_HEATMAP_ID"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{width: '100%', height: '100%'}}
          gestureHandling="cooperative"
          disableDefaultUI={true}
        >
          <DeckGlOverlay layers={layers} />
        </Map>
      </APIProvider>
    </div>
  );
}
