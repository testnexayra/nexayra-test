"use client";

import { useState } from "react";
import { MapPin, Loader2, ExternalLink } from "lucide-react";

export type LocationData = {
  lat: number;
  lng: number;
  address?: string;
  capturedAt: string;
};

type LocationCaptureProps = {
  /** Existing location data (for displaying currently saved value) */
  value?: LocationData | null;
  /** Called when a new location is captured */
  onChange: (loc: LocationData | null) => void;
  /** Optional label shown above the widget */
  label?: string;
};

export default function LocationCapture({ value, onChange, label = "Location" }: LocationCaptureProps) {
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState("");

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }
    setError("");
    setCapturing(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(`/api/geocode?lat=${latitude}&lng=${longitude}`);
          const data = await res.json();
          onChange({
            lat: latitude,
            lng: longitude,
            address: data.address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            capturedAt: new Date().toISOString(),
          });
        } catch (err) {
          // If geocoding fails, still save raw coordinates
          onChange({
            lat: latitude,
            lng: longitude,
            address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            capturedAt: new Date().toISOString(),
          });
        } finally {
          setCapturing(false);
        }
      },
      (err) => {
        setCapturing(false);
        if (err.code === 1) setError("Permission denied. Allow location access in your browser settings.");
        else if (err.code === 2) setError("Location unavailable. Try again outdoors.");
        else if (err.code === 3) setError("Location request timed out.");
        else setError(`Failed to get location: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const clearLocation = () => {
    onChange(null);
  };

  return (
    <div>
      {label && <label className="text-xs font-bold text-navy-400 uppercase block mb-1">{label}</label>}
      <div className="bg-surface-2 border border-border rounded-xl p-3">
        {value ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <MapPin size={16} className="text-gold mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-navy dark:text-white font-semibold truncate">{value.address || "—"}</p>
                <p className="text-[11px] text-navy-400 font-mono">{value.lat.toFixed(6)}, {value.lng.toFixed(6)}</p>
                <p className="text-[10px] text-navy-300 mt-0.5">
                  Captured {new Date(value.capturedAt).toLocaleString()}
                </p>
              </div>
              <a
                href={`https://www.google.com/maps?q=${value.lat},${value.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold hover:text-gold-600 flex items-center gap-1 text-xs font-bold whitespace-nowrap shrink-0"
                title="Open in Google Maps"
              >
                <ExternalLink size={12} /> Maps
              </a>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={captureLocation}
                disabled={capturing}
                className="flex-1 px-2.5 py-1.5 bg-navy hover:bg-navy-700 disabled:opacity-50 text-white dark:bg-gold-400 dark:text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                {capturing ? <><Loader2 size={12} className="animate-spin" /> Capturing…</> : <><MapPin size={12} /> Update</>}
              </button>
              <button
                type="button"
                onClick={clearLocation}
                className="px-2.5 py-1.5 bg-surface text-navy-400 hover:text-red-500 rounded-lg text-xs font-semibold border border-border"
              >
                Clear
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={captureLocation}
            disabled={capturing}
            className="w-full px-3 py-2 bg-navy hover:bg-navy-700 disabled:opacity-50 text-white dark:bg-gold-400 dark:text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all"
          >
            {capturing ? <><Loader2 size={14} className="animate-spin" /> Getting your location…</> : <><MapPin size={14} /> Capture Current Location</>}
          </button>
        )}
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>
    </div>
  );
}