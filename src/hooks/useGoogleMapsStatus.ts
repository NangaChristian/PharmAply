import { useState, useEffect } from 'react';

export function useGoogleMapsStatus() {
  const [mapsFailed, setMapsFailed] = useState(() => Boolean((window as any).__googleMapsAuthFailed));

  useEffect(() => {
    const handleAuthFailed = () => setMapsFailed(true);
    window.addEventListener('google-maps-auth-failed', handleAuthFailed);
    return () => window.removeEventListener('google-maps-auth-failed', handleAuthFailed);
  }, []);

  return { mapsFailed };
}
