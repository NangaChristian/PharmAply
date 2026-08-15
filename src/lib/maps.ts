/**
 * Centralized Google Maps API key resolver
 * Supports AI Studio Secrets (GOOGLE_MAPS_PLATFORM_KEY),
 * Vite env vars (VITE_GOOGLE_MAPS_API_KEY, VITE_GOOGLE_MAPS_PLATFORM_KEY),
 * and runtime globals.
 */
export function getGoogleMapsApiKey(): string {
  try {
    const key =
      process.env.GOOGLE_MAPS_PLATFORM_KEY ||
      (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
      (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ||
      (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
      '';

    if (
      !key ||
      key === 'YOUR_GOOGLE_MAPS_API_KEY' ||
      key === 'YOUR_KEY_HERE' ||
      key === 'YOUR_API_KEY'
    ) {
      return '';
    }
    return key;
  } catch {
    return '';
  }
}

export function hasValidGoogleMapsKey(): boolean {
  return Boolean(getGoogleMapsApiKey());
}
