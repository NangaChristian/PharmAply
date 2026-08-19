import React, { useState, useEffect, useRef } from "react";
import { Search, MapPin, Loader2, X, Check, Navigation, Crosshair } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import toast from "react-hot-toast";

export interface AddressSuggestion {
  description: string;
  mainText: string;
  secondaryText?: string;
  lat: number;
  lng: number;
}

interface GooglePlacesAddressInputProps {
  value: string;
  onChange: (address: string, lat?: number, lng?: number) => void;
  placeholder?: string;
  className?: string;
  onSelectSuggestion?: (suggestion: AddressSuggestion) => void;
  showCurrentLocationBtn?: boolean;
}

export function GooglePlacesAddressInput({
  value,
  onChange,
  placeholder = "Ex: Bastos, Rue 1788, Yaoundé ou Akwa, Douala",
  className = "",
  onSelectSuggestion,
  showCurrentLocationBtn = true
}: GooglePlacesAddressInputProps) {
  const [query, setQuery] = useState(value || "");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<any>(null);
  const theme = useTheme();
  const primaryColor = theme.primaryColor || "#194B4B";

  // Request user's rough geolocation on mount to prioritize local suggestions
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        },
        (err) => {
          // Default to Cameroon urban centers if denied
          setUserCoords({ lat: 4.0511, lng: 9.7679 });
        },
        { timeout: 8000, maximumAge: 60000 }
      );
    } else {
      setUserCoords({ lat: 4.0511, lng: 9.7679 });
    }
  }, []);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchAddressPredictions = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const results: AddressSuggestion[] = [];
    const lat = userCoords?.lat || 4.0511;
    const lng = userCoords?.lng || 9.7679;

    // 1. Try Google Places Autocomplete with Local Location Bias if loaded
    try {
      const g = (window as any).google;
      if (g && g.maps && g.maps.places && g.maps.places.AutocompleteService) {
        const service = new g.maps.places.AutocompleteService();
        const center = new g.maps.LatLng(lat, lng);
        service.getPlacePredictions(
          {
            input: searchQuery,
            location: center,
            radius: 50000, // 50km radius bias around user
            componentRestrictions: { country: ['cm', 'ci', 'sn', 'fr'] }
          },
          (predictions: any[], status: any) => {
            if (status === g.maps.places.PlacesServiceStatus.OK && predictions) {
              predictions.forEach((p) => {
                results.push({
                  description: p.description,
                  mainText: p.structured_formatting?.main_text || p.description,
                  secondaryText: p.structured_formatting?.secondary_text || "",
                  lat: lat,
                  lng: lng
                });
              });
            }
          }
        );
      }
    } catch (e) {
      // Continue to OpenStreetMap / Nominatim
    }

    // 2. Query Live OpenStreetMap & Nominatim Geocoding API with local bounding box bias
    try {
      const delta = 0.8; // ~80km bounding box around user's current city
      const viewBoxParam = `&viewbox=${lng - delta},${lat + delta},${lng + delta},${lat - delta}`;
      
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&addressdetails=1&limit=8${viewBoxParam}&countrycodes=cm,ci,sn,fr,be,ca`,
        {
          headers: {
            "Accept-Language": "fr,en"
          }
        }
      );
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data)) {
          data.forEach((item) => {
            const road = item.address?.road || item.address?.suburb || item.address?.neighbourhood || item.name || item.display_name.split(",")[0];
            const city = item.address?.city || item.address?.town || item.address?.village || item.address?.county || item.address?.state || "";
            const country = item.address?.country || "";
            const secondary = [city, country].filter(Boolean).join(", ");

            if (!results.some(r => r.description === item.display_name)) {
              results.push({
                description: item.display_name,
                mainText: road || item.display_name.split(",")[0],
                secondaryText: secondary || item.display_name.split(",").slice(1).join(",").trim(),
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon)
              });
            }
          });
        }
      }
    } catch (geoErr) {
      console.warn("Geocoding search notice:", geoErr);
    }

    setSuggestions(results);
    setLoading(false);
    setShowDropdown(results.length > 0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setQuery(text);
    onChange(text);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchAddressPredictions(text);
    }, 250);
  };

  const handleSelect = (item: AddressSuggestion) => {
    setQuery(item.description);
    setShowDropdown(false);
    onChange(item.description, item.lat, item.lng);
    if (onSelectSuggestion) {
      onSelectSuggestion(item);
    }
  };

  // 1-Click GPS Current Location Auto-detection & Reverse Geocoding
  const handleUseCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("La géolocalisation n'est pas supportée par votre appareil.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const currentLat = position.coords.latitude;
        const currentLng = position.coords.longitude;
        setUserCoords({ lat: currentLat, lng: currentLng });

        try {
          // Reverse geocode with Nominatim
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${currentLat}&lon=${currentLng}&zoom=18&addressdetails=1`,
            {
              headers: { "Accept-Language": "fr" }
            }
          );
          if (response.ok) {
            const data = await response.json();
            const formatted = data.display_name || `${currentLat.toFixed(5)}, ${currentLng.toFixed(5)}`;
            setQuery(formatted);
            onChange(formatted, currentLat, currentLng);
            if (onSelectSuggestion) {
              onSelectSuggestion({
                description: formatted,
                mainText: data.address?.road || data.address?.suburb || "Position actuelle",
                secondaryText: [data.address?.city || data.address?.town, data.address?.country].filter(Boolean).join(", "),
                lat: currentLat,
                lng: currentLng
              });
            }
            toast.success("Position GPS détectée avec succès !");
          } else {
            const fallback = `Position GPS (${currentLat.toFixed(4)}, ${currentLng.toFixed(4)})`;
            setQuery(fallback);
            onChange(fallback, currentLat, currentLng);
          }
        } catch (e) {
          const fallback = `Position GPS (${currentLat.toFixed(4)}, ${currentLng.toFixed(4)})`;
          setQuery(fallback);
          onChange(fallback, currentLat, currentLng);
        } finally {
          setLocating(false);
          setShowDropdown(false);
        }
      },
      (error) => {
        setLocating(false);
        toast.error("Impossible d'accéder à votre position GPS. Veuillez vérifier les permissions de votre navigateur.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className={`relative w-full space-y-1.5 ${className}`} ref={dropdownRef}>
      <div className="relative flex items-center">
        <MapPin 
          size={18} 
          className="absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors pointer-events-none" 
          style={{ color: primaryColor }}
        />
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          placeholder={placeholder}
          className="w-full pl-10 pr-20 py-3.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white text-xs sm:text-sm outline-none transition focus:border-opacity-100 shadow-xs"
          style={{
            borderColor: showDropdown ? primaryColor : undefined
          }}
        />
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {loading && <Loader2 size={16} className="animate-spin text-gray-400" />}
          {query.length > 0 && !loading && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                onChange("", undefined, undefined);
                setSuggestions([]);
                setShowDropdown(false);
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 rounded-full"
            >
              <X size={15} />
            </button>
          )}
          {showCurrentLocationBtn && (
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={locating}
              className="p-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-[#194B4B] dark:text-teal-400 rounded-lg transition"
              title="Utiliser ma position GPS actuelle"
            >
              {locating ? <Loader2 size={14} className="animate-spin" /> : <Crosshair size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Suggestions Dropdown with Location Bias */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto">
          <div className="px-3 py-2 bg-gray-50 dark:bg-zinc-800/60 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            <span className="flex items-center gap-1">
              <Search size={12} style={{ color: primaryColor }} />
              Suggestions géolocalisées ({userCoords ? "Zone locale" : "Cameroun"})
            </span>
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              className="text-[10px] text-[#194B4B] dark:text-teal-400 hover:underline flex items-center gap-1 normal-case font-bold"
            >
              <Navigation size={10} /> Ma position GPS
            </button>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-zinc-800/60">
            {suggestions.map((item, idx) => (
              <div
                key={`${item.description}-${idx}`}
                onClick={() => handleSelect(item)}
                className="px-3.5 py-2.5 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-zinc-800/80 cursor-pointer transition-colors"
              >
                <div 
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                >
                  <MapPin size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-900 dark:text-white line-clamp-1">
                    {item.mainText}
                  </p>
                  {item.secondaryText && (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                      {item.secondaryText}
                    </p>
                  )}
                </div>
                <Check size={14} className="text-emerald-500 shrink-0 mt-1 opacity-0 hover:opacity-100" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
