import React, { useEffect, useRef } from 'react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';

export function RouteDisplay({ origin, destination, onDuration }: {
  origin: string | google.maps.LatLngLiteral;
  destination: string | google.maps.LatLngLiteral;
  onDuration?: (millis: number) => void;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!routesLib || !map || !origin || !destination) return;
    // Clear previous route
    polylinesRef.current.forEach(p => p.setMap(null));
    
    // New computeRoutes api expects specific formats, but if the example relies on an adapter or standard format we pass it
    // Wait, the new Routes API taking origin/destination as string natively in JS SDK?
    // Let's pass what's provided. If it's a string, we might need to wrap it.
    // The example code passes it directly: `origin, destination`

    let reqOrigin = null;
    let reqDestination = null;

    if (typeof origin === 'string') {
        reqOrigin = { address: origin };
    } else if (origin) {
        reqOrigin = { location: { latLng: origin } };
    }

    if (typeof destination === 'string') {
        reqDestination = { address: destination };
    } else if (destination) {
        reqDestination = { location: { latLng: destination } };
    }

    // fallback if no wrapper is needed, we will try standard
    const run = async () => {
       try {
           const { routes } = await routesLib.Route.computeRoutes({
             origin: reqOrigin || origin,
             destination: reqDestination || destination,
             travelMode: 'DRIVING',
             fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
           });
           
           if (routes?.[0]) {
             const newPolylines = routes[0].createPolylines();
             newPolylines.forEach(p => {
                 p.setOptions({ strokeColor: '#4f46e5', strokeWeight: 5 });
                 p.setMap(map);
             });
             polylinesRef.current = newPolylines;
             if (routes[0].viewport) map.fitBounds(routes[0].viewport, 40);
             if (onDuration && routes[0].durationMillis) onDuration(routes[0].durationMillis);
           }
       } catch (err) {
           console.error("Route computation failed", err);
       }
    };
    
    run();

    return () => polylinesRef.current.forEach(p => p.setMap(null));
  }, [routesLib, map, origin, destination]);

  return null;
}
