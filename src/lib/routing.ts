/**
 * Real-time road network routing utility
 * Traces actual road streets, turns, and highways between GPS coordinates.
 */

export interface RouteResult {
  coordinates: [number, number][]; // [lat, lng] array
  distanceMeters: number;
  durationSeconds: number;
  summary?: string;
}

const routeCache = new Map<string, { result: RouteResult; timestamp: number }>();
const CACHE_TTL_MS = 15000; // 15 seconds cache for nearby calls

/**
 * Fetch real turn-by-turn road polyline from OSRM driving service
 */
export async function getRoadRoute(
  origin: [number, number],
  destination: [number, number]
): Promise<RouteResult> {
  const [lat1, lon1] = origin;
  const [lat2, lon2] = destination;

  // Validate coordinates
  if (!lat1 || !lon1 || !lat2 || !lon2 || isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
    return {
      coordinates: [origin, destination],
      distanceMeters: 0,
      durationSeconds: 0,
    };
  }

  // Round for cache key
  const cacheKey = `${lat1.toFixed(4)},${lon1.toFixed(4)}_${lat2.toFixed(4)},${lon2.toFixed(4)}`;
  const cached = routeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });

    if (!response.ok) {
      throw new Error(`Routing HTTP error ${response.status}`);
    }

    const data = await response.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const primaryRoute = data.routes[0];
      const rawCoords = primaryRoute.geometry.coordinates; // [ [lon, lat], ... ]
      const latLngCoords: [number, number][] = rawCoords.map(([lng, lat]: [number, number]) => [lat, lng]);

      const result: RouteResult = {
        coordinates: latLngCoords,
        distanceMeters: Math.round(primaryRoute.distance || 0),
        durationSeconds: Math.round(primaryRoute.duration || 0),
        summary: primaryRoute.legs?.[0]?.summary || ''
      };

      routeCache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    }
  } catch (error) {
    console.warn("Road routing fetch fallback to direct route:", error);
  }

  // Fallback: direct line with Haversine distance
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distKm = 6371 * c;
  const distMeters = Math.round(distKm * 1000);
  const durSec = Math.round((distKm / 25) * 3600); // 25km/h avg

  return {
    coordinates: [origin, destination],
    distanceMeters: distMeters,
    durationSeconds: durSec,
  };
}
