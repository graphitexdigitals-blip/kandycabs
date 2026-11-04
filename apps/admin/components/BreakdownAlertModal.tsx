'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface BreakdownIncident {
  eventId: string;
  incidentId: string;
  bookingId: string;
  bookingRef: string;
  driverName: string;
  driverPhone: string;
  vehiclePlate: string;
  vehicleModel: string;
  customerName: string;
  customerPhone: string;
  latitude: number;
  longitude: number;
  landmark?: string;
  notes?: string;
  googleMapsUrl?: string;
  reportedAt: string;
}

export function BreakdownAlertModal() {
  const [activeIncidents, setActiveIncidents] = useState<BreakdownIncident[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);

  // Web Audio API refs for the siren
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const lfoRef = useRef<OscillatorNode | null>(null);
  const isPlayingRef = useRef<boolean>(false);

  // Start continuous emergency siren
  const startSiren = () => {
    if (isPlayingRef.current || isMuted) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      // Primary tone oscillator
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(750, ctx.currentTime);

      // Low frequency modulation for classic emergency wavering siren
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(1.8, ctx.currentTime); // 1.8 Hz modulation

      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(220, ctx.currentTime); // pitch deviation +/- 220Hz

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      // Master volume gain
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.35, ctx.currentTime); // Loud but comfortable

      osc.connect(gain);
      gain.connect(ctx.destination);

      lfo.start();
      osc.start();

      oscRef.current = osc;
      lfoRef.current = lfo;
      isPlayingRef.current = true;
    } catch (e) {
      console.warn('AudioContext siren autoplay blocked or unavailable:', e);
    }
  };

  const stopSiren = () => {
    try {
      if (oscRef.current) {
        oscRef.current.stop();
        oscRef.current.disconnect();
        oscRef.current = null;
      }
      if (lfoRef.current) {
        lfoRef.current.stop();
        lfoRef.current.disconnect();
        lfoRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    } catch (e) {
      // ignore
    } finally {
      isPlayingRef.current = false;
    }
  };

  // Poll for active breakdowns every 4 seconds
  useEffect(() => {
    let isMounted = true;

    const checkActiveBreakdowns = async () => {
      try {
        const res = await fetch('/api/admin/breakdown/active');
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.incidents)) {
          setActiveIncidents(data.incidents);
          if (data.incidents.length > 0) {
            startSiren();
          } else {
            stopSiren();
          }
        }
      } catch (err) {
        // silent catch
      }
    };

    checkActiveBreakdowns();
    const interval = setInterval(checkActiveBreakdowns, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      stopSiren();
    };
  }, [isMuted]);

  const handleAcknowledge = async (incident: BreakdownIncident) => {
    setAcknowledging(true);
    stopSiren();
    try {
      const res = await fetch('/api/admin/breakdown/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: incident.eventId,
          incidentId: incident.incidentId,
          resolutionNote: 'Acknowledged and silenced by dispatch operator',
        }),
      });

      if (res.ok) {
        setActiveIncidents((prev) => prev.filter((i) => i.eventId !== incident.eventId));
      }
    } catch (err) {
      console.error('Failed to acknowledge breakdown:', err);
    } finally {
      setAcknowledging(false);
    }
  };

  if (activeIncidents.length === 0) return null;

  const current = activeIncidents[currentIndex] || activeIncidents[0];
  const mapsUrl =
    current.googleMapsUrl ||
    (current.latitude && current.longitude
      ? `https://www.google.com/maps?q=${current.latitude},${current.longitude}`
      : `https://www.google.com/maps`);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border-4 border-red-600 overflow-hidden animate-bounce-short">
        {/* Urgent Pulsing Red Header */}
        <div className="bg-red-600 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-pulse">🚨</span>
            <div>
              <h2 className="text-lg font-black tracking-wide uppercase">
                EMERGENCY: VEHICLE BREAKDOWN
              </h2>
              <p className="text-xs font-semibold text-red-100">
                Booking Ref: <span className="underline font-bold">{current.bookingRef}</span> • Live Alarm Active
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              stopSiren();
              setIsMuted(true);
            }}
            className="text-xs bg-red-800/80 hover:bg-red-900 border border-red-400 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors"
          >
            <span>🔕</span> Mute Siren
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {/* Driver & Vehicle Box */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Driver & Cab Details
                </span>
                <p className="text-base font-extrabold text-slate-900 mt-0.5">
                  {current.driverName}
                </p>
                <p className="text-xs font-bold text-slate-600 mt-0.5">
                  Vehicle: <span className="text-slate-900">{current.vehiclePlate}</span> ({current.vehicleModel})
                </p>
              </div>

              {current.driverPhone ? (
                <a
                  href={`tel:${current.driverPhone}`}
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95"
                >
                  <span>📞</span> Call Driver
                </a>
              ) : null}
            </div>
          </div>

          {/* Customer Box */}
          <div className="rounded-xl bg-blue-50/70 border border-blue-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                  Passenger Onboard
                </span>
                <p className="text-base font-extrabold text-slate-900 mt-0.5">
                  {current.customerName}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Phone: <span className="font-bold">{current.customerPhone || 'Not released'}</span>
                </p>
              </div>

              {current.customerPhone ? (
                <a
                  href={`tel:${current.customerPhone}`}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95"
                >
                  <span>📞</span> Call Customer
                </a>
              ) : null}
            </div>
          </div>

          {/* Exact GPS Location Card with Direct Google Maps Link */}
          <div className="rounded-xl bg-amber-50 border border-amber-300 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-1.5 text-amber-900 font-extrabold text-xs">
                  <span>📍</span> EXACT BREAKDOWN GPS COORDINATES
                </div>
                <p className="text-sm font-black text-slate-900 mt-1">
                  {current.latitude && current.longitude
                    ? `${current.latitude.toFixed(5)}° N, ${current.longitude.toFixed(5)}° E`
                    : 'GPS coordinates unavailable'}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Landmark: {current.landmark || 'Highway roadside telemetry'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1 font-mono">
                  Reported: {new Date(current.reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              </div>

              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-3.5 py-2.5 rounded-xl shadow transition-all active:scale-95"
              >
                <span>🗺️</span> Open Maps
              </a>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              onClick={() => handleAcknowledge(current)}
              disabled={acknowledging}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm py-3 px-4 rounded-xl shadow-lg transition-all active:scale-98 disabled:opacity-50"
            >
              {acknowledging ? 'Acknowledging...' : '✓ Acknowledge & Silence Siren'}
            </button>

            <Link
              href={`/bookings`}
              onClick={() => {
                stopSiren();
                handleAcknowledge(current);
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm py-3 px-5 rounded-xl shadow-lg transition-all active:scale-98"
            >
              Dispatch Backup
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

