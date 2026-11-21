'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ALL_LOCATIONS, PlaceLocation } from '@/lib/locations';

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  targetType: 'PICKUP' | 'DROP' | 'STOP';
  selectedAddress: string;
  onSelectLocation: (place: PlaceLocation) => void;
}

export function LocationPickerModal({
  isOpen,
  onClose,
  title,
  targetType,
  selectedAddress,
  onSelectLocation,
}: LocationPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [osmResults, setOsmResults] = useState<PlaceLocation[]>([]);
  const [isSearchingOsm, setIsSearchingOsm] = useState(false);
  const [fetchingGps, setFetchingGps] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setOsmResults([]);
      setGpsError('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Live OSM Nominatim Search (Debounced 350ms)
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setOsmResults([]);
      setIsSearchingOsm(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingOsm(true);
      try {
        const q = encodeURIComponent(`${searchQuery.trim()}, Karnataka, India`);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${q}&countrycodes=in&limit=8&addressdetails=1`
        );
        if (res.ok) {
          const data = await res.json();
          const places: PlaceLocation[] = data.map((item: any) => {
            const parts = item.display_name.split(',');
            return {
              label: parts[0]?.trim() || item.display_name,
              sublabel: parts.slice(1, 4).join(',').trim(),
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
              category: 'OUTSTATION',
              source: 'OSM_LIVE',
            };
          });
          setOsmResults(places);
        }
      } catch (err) {
        console.error('OSM Search Error:', err);
      } finally {
        setIsSearchingOsm(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch Live Current Location via Browser GPS & OSM Reverse Geocode
  const handleFetchCurrentLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setFetchingGps(true);
    setGpsError('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
          );
          if (res.ok) {
            const data = await res.json();
            const parts = (data.display_name || '').split(',');
            const label = parts.slice(0, 2).join(',').trim() || 'Current Location';
            const sublabel = parts.slice(2, 5).join(',').trim() || `GPS: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            
            const place: PlaceLocation = {
              label: `${label} (Current Location)`,
              sublabel,
              lat: latitude,
              lng: longitude,
              category: 'MANGALURU',
              source: 'OSM_LIVE',
            };
            onSelectLocation(place);
            onClose();
          } else {
            throw new Error('Reverse geocode failed');
          }
        } catch {
          const place: PlaceLocation = {
            label: `Current GPS Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
            sublabel: 'Browser Live Location',
            lat: latitude,
            lng: longitude,
            category: 'MANGALURU',
            source: 'OSM_LIVE',
          };
          onSelectLocation(place);
          onClose();
        } finally {
          setFetchingGps(false);
        }
      },
      (err) => {
        setFetchingGps(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError('Location permission denied. Please allow location access in your browser.');
        } else {
          setGpsError('Unable to retrieve your location. Please select from the list.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Filter verified locations
  const filteredPresetLocations = ALL_LOCATIONS.filter((loc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      loc.label.toLowerCase().includes(q) ||
      loc.sublabel?.toLowerCase().includes(q) ||
      loc.keywords?.some((k) => k.toLowerCase().includes(q))
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white text-slate-900 animate-fadeIn">
      {/* Modal Header */}
      <div className="px-3.5 py-2.5 sm:py-3 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <h3 className="text-sm sm:text-base font-bold text-slate-900">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition text-xs font-bold"
        >
          ✕
        </button>
      </div>

      {/* Search Bar & GPS Button */}
      <div className="px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/80 space-y-2 shrink-0">
        <div className="relative flex items-center">
          <svg className="w-4 h-4 text-slate-400 absolute left-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search area, landmark, airport, temple, beach..."
            className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-8 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-medium shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 text-slate-400 hover:text-slate-600 text-[11px] font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Quick Current Location GPS Pill - ONLY for PICKUP */}
        {targetType === 'PICKUP' && (
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleFetchCurrentLocation}
              disabled={fetchingGps}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-full text-[11px] sm:text-xs font-bold transition shadow-2xs disabled:opacity-50"
            >
              {fetchingGps ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin text-[#f0750f]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Detecting GPS Location...</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-[#f0750f] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21 3L3 10.53v.98l6.84 2.65L12.49 21h.98L21 3z" />
                  </svg>
                  <span>Use My Current Location</span>
                </>
              )}
            </button>
            {gpsError && (
              <span className="text-[10.5px] text-red-600 font-medium">{gpsError}</span>
            )}
          </div>
        )}
      </div>

      {/* Locations List — scrollable */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1 divide-y divide-slate-100 custom-scrollbar bg-white">
        {/* OSM Live Loading Indicator */}
        {isSearchingOsm && (
          <div className="p-3 text-center text-xs text-orange-600 font-medium flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin text-orange-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Searching OpenStreetMap across Karnataka...</span>
          </div>
        )}

        {/* Live OpenStreetMap Results */}
        {osmResults.length > 0 && (
          <div className="pb-2">
            <div className="px-3 py-1 text-[11px] font-bold text-orange-700 uppercase tracking-wider flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>OpenStreetMap Live Matches</span>
            </div>
            {osmResults.map((loc, idx) => (
              <button
                key={`osm-${idx}`}
                type="button"
                onClick={() => {
                  onSelectLocation(loc);
                  onClose();
                }}
                className="w-full p-2.5 rounded-xl text-left hover:bg-orange-50/70 transition flex items-start justify-between gap-3 group border border-transparent"
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex-shrink-0 text-[#f0750f]">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-slate-900 group-hover:text-orange-600 transition">
                        {loc.label}
                      </span>
                      <span className="text-[9px] bg-orange-100 text-orange-800 border border-orange-300 px-1 rounded font-black">
                        OSM Live
                      </span>
                    </div>
                    {loc.sublabel && (
                      <p className="text-xs text-slate-500 line-clamp-1">{loc.sublabel}</p>
                    )}
                  </div>
                </div>
                <span className="text-xs text-orange-600 font-bold opacity-0 group-hover:opacity-100 transition self-center">
                  Select →
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Verified Presets */}
        <div>
          {osmResults.length > 0 && (
            <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span>Verified Karnataka Hubs & Landmarks</span>
            </div>
          )}

          {filteredPresetLocations.length === 0 && osmResults.length === 0 && !isSearchingOsm && (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <div className="flex justify-center text-slate-300">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-700">No exact preset found for &quot;{searchQuery}&quot;</p>
              <p className="text-xs text-slate-500">
                Try searching by area or town name (e.g. Shakthinagar, Mudipu, Surathkal, Belur).
              </p>
            </div>
          )}

          {filteredPresetLocations.map((loc, idx) => {
            const isSelected = selectedAddress === loc.label;
            return (
              <button
                key={`preset-${idx}`}
                type="button"
                onClick={() => {
                  onSelectLocation(loc);
                  onClose();
                }}
                className={`w-full p-2.5 rounded-xl text-left transition flex items-start justify-between gap-3 group ${
                  isSelected
                    ? 'bg-orange-50/90 border border-orange-300'
                    : 'hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`mt-0.5 flex-shrink-0 ${isSelected ? 'text-[#f0750f]' : 'text-slate-400 group-hover:text-[#f0750f]'}`}>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-bold transition ${
                          isSelected ? 'text-orange-900' : 'text-slate-800 group-hover:text-orange-600'
                        }`}
                      >
                        {loc.label}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded-full font-bold">
                          ✓ Selected
                        </span>
                      )}
                    </div>
                    {loc.sublabel && (
                      <p className={`text-xs line-clamp-1 ${isSelected ? 'text-orange-700/80' : 'text-slate-500'}`}>
                        {loc.sublabel}
                      </p>
                    )}
                  </div>
                </div>
                <span className={`text-xs transition self-center font-bold ${
                  isSelected ? 'text-orange-600' : 'text-slate-400 group-hover:text-orange-600'
                }`}>
                  ›
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0">
        <div className="flex items-center gap-1.5 text-slate-500">
          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>100% Free OpenStreetMap & OSRM Routing</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg font-bold transition shadow-xs"
        >
          Close
        </button>
      </div>
    </div>
  );
}
