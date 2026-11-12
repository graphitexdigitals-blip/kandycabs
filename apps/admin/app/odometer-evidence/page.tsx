'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminNavbar } from '@/components/AdminNavbar';
import { reverseGeocodeLocation } from '@/lib/geocoding';
import { resolveImageUrl } from '@/lib/resolveImageUrl';
import { getTripVerificationPhotos, getTripTimingMilestones } from '@/lib/bookingHelpers';

export const dynamic = 'force-dynamic';

export default function AdminOdometerEvidencePage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState('10');
  const [discrepancyOnly, setDiscrepancyOnly] = useState(false);
  const [summary, setSummary] = useState({ totalCount: 0, discrepancyCount: 0 });

  // Lightbox Modal state
  const [lightboxItem, setLightboxItem] = useState<any | null>(null);
  const [startLocName, setStartLocName] = useState<string>('');
  const [finalLocName, setFinalLocName] = useState<string>('');
  const [driverLiveLocName, setDriverLiveLocName] = useState<string>('');

  // Resolve reverse-geocoded area/place names whenever a lightbox item is selected
  useEffect(() => {
    if (!lightboxItem) {
      setStartLocName('');
      setFinalLocName('');
      setDriverLiveLocName('');
      return;
    }

    if (lightboxItem.startGpsLat && lightboxItem.startGpsLng) {
      reverseGeocodeLocation(lightboxItem.startGpsLat, lightboxItem.startGpsLng).then(setStartLocName);
    } else if (lightboxItem.pickupAddress) {
      setStartLocName(lightboxItem.pickupAddress);
    }

    if (lightboxItem.finalGpsLat && lightboxItem.finalGpsLng) {
      reverseGeocodeLocation(lightboxItem.finalGpsLat, lightboxItem.finalGpsLng).then(setFinalLocName);
    } else if (lightboxItem.dropAddress) {
      setFinalLocName(lightboxItem.dropAddress);
    }

    if (lightboxItem.driverCurrentLat && lightboxItem.driverCurrentLng) {
      reverseGeocodeLocation(lightboxItem.driverCurrentLat, lightboxItem.driverCurrentLng).then(setDriverLiveLocName);
    }
  }, [lightboxItem]);

  const fetchOdometerData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/odometer-evidence?threshold=${threshold}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setSummary({
          totalCount: data.totalCount || 0,
          discrepancyCount: data.discrepancyCount || 0,
        });
      }
    } catch (err) {
      console.error('Failed to load odometer audit data:', err);
    } finally {
      setLoading(false);
    }
  }, [threshold]);

  useEffect(() => {
    fetchOdometerData();
  }, [fetchOdometerData]);

  const displayedItems = discrepancyOnly ? items.filter((i) => i.hasDiscrepancy) : items;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <AdminNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              Odometer & GPS Distance Audit
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Verify starting vs final odometer photos against Flow A breadcrumb GPS distance
            </p>
          </div>
          <button
            onClick={() => fetchOdometerData()}
            className="px-3.5 py-2 bg-white hover:bg-slate-100 text-xs font-semibold rounded-lg border border-slate-200 flex items-center gap-1.5 text-slate-700 transition shadow-xs"
          >
            Refresh
          </button>
        </div>

        {/* Stats & Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Audited Trips</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{summary.totalCount}</div>
            <div className="text-[10px] text-slate-400 mt-1">With photo evidence</div>
          </div>

          <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl shadow-xs">
            <div className="text-[11px] font-medium text-rose-700 uppercase tracking-wider">Flagged Discrepancies</div>
            <div className="text-2xl font-black text-rose-700 mt-1">{summary.discrepancyCount}</div>
            <div className="text-[10px] text-rose-600 mt-1">&gt;{threshold}% variance vs GPS/Est</div>
          </div>

          <div className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col justify-center shadow-xs">
            <label className="text-[11px] font-semibold text-slate-700 mb-1.5">Discrepancy Threshold:</label>
            <select
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="5">5% Variance</option>
              <option value="10">10% Variance (Recommended)</option>
              <option value="15">15% Variance</option>
              <option value="20">20% Variance</option>
            </select>
          </div>

          <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center justify-between shadow-xs">
            <div>
              <div className="text-xs font-bold text-slate-900">Filter Flags</div>
              <div className="text-[10px] text-slate-500">Show only flagged trips</div>
            </div>
            <input
              type="checkbox"
              checked={discrepancyOnly}
              onChange={(e) => setDiscrepancyOnly(e.target.checked)}
              className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Audit Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          {loading ? (
            <div className="py-20 text-center text-slate-400 text-sm">
              <div className="w-6 h-6 border-2 border-slate-300 border-t-amber-500 rounded-full animate-spin mx-auto mb-2" />
              <div>Analyzing odometer photos and GPS breadcrumbs...</div>
            </div>
          ) : displayedItems.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              <div>No trip evidence found matching the selected filter.</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Booking / Trip</th>
                    <th className="py-3 px-4">Driver & Vehicle</th>
                    <th className="py-3 px-4">Starting Odometer</th>
                    <th className="py-3 px-4">Final Odometer</th>
                    <th className="py-3 px-4">Odometer Dist.</th>
                    <th className="py-3 px-4">GPS Dist.</th>
                    <th className="py-3 px-4">Variance / Audit</th>
                    <th className="py-3 px-4 text-right">Photo Lightbox</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedItems.map((item) => (
                    <tr
                      key={item.bookingId}
                      className={`hover:bg-slate-50 transition ${
                        item.hasDiscrepancy ? 'bg-rose-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-amber-800">{item.humanReadableRef}</div>
                        <div className="text-slate-900 font-medium">{item.customerName}</div>
                        <div className="text-[10px] text-slate-500 uppercase">{item.tripType}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{item.driverName}</div>
                        <div className="text-[10px] text-slate-500">{item.vehiclePlate}</div>
                        <div className="text-[10px] text-slate-500">{item.category}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900">
                          {item.startingOdometer !== null ? `${item.startingOdometer} km` : '—'}
                        </div>
                        {item.startingOdometerImagePath ? (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
                            Photo attached
                          </div>
                        ) : (
                          <div className="mt-1 text-[10px] text-slate-400">No photo</div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900">
                          {item.finalOdometer !== null ? `${item.finalOdometer} km` : '—'}
                        </div>
                        {item.finalOdometerImagePath ? (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
                            Photo attached
                          </div>
                        ) : (
                          <div className="mt-1 text-[10px] text-slate-400">No photo</div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900">
                          {item.odometerDistanceKm !== null ? `${item.odometerDistanceKm} km` : '—'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {item.gpsTrackedDistanceKm !== null ? (
                          <div>
                            <div className="font-bold text-blue-700">{item.gpsTrackedDistanceKm} km</div>
                            <div className="text-[9px] text-slate-500">
                              ({item.breadcrumbPointsCount} GPS points)
                            </div>
                          </div>
                        ) : (
                          <div className="text-slate-600">
                            <div>Est: {item.estimatedDistanceKm} km</div>
                            <div className="text-[9px] text-slate-400">(No breadcrumbs)</div>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {item.discrepancyPercent !== null ? (
                          <div>
                            <div className="font-bold text-slate-900">{item.discrepancyPercent}%</div>
                            {item.hasDiscrepancy ? (
                              <span className="inline-block mt-0.5 px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded text-[10px] font-black animate-pulse">
                                &gt;{threshold}% VARIANCE
                              </span>
                            ) : (
                              <span className="inline-block mt-0.5 px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[10px] font-semibold">
                                ✓ Verified In-Range
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setLightboxItem(item)}
                          className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-xs font-semibold transition shadow-2xs"
                        >
                          Compare Photos
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Lightbox Side-by-Side Photo Modal */}
      {lightboxItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  Odometer Photo Evidence: {lightboxItem.humanReadableRef}
                </h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-0.5">
                  <span>Driver: <strong className="text-slate-800">{lightboxItem.driverName}</strong> ({lightboxItem.driverPhone})</span>
                  <span>•</span>
                  <span>Vehicle: <strong className="text-slate-800">{lightboxItem.vehiclePlate}</strong></span>
                  {lightboxItem.driverCurrentLat && lightboxItem.driverCurrentLng && (
                    <>
                      <span>•</span>
                      <span className="text-emerald-700 font-mono flex items-center gap-1 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Live GPS: {lightboxItem.driverCurrentLat.toFixed(5)}, {lightboxItem.driverCurrentLng.toFixed(5)}
                        {driverLiveLocName ? ` (${driverLiveLocName})` : ''}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => setLightboxItem(null)}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-lg bg-white border border-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Side-by-Side Images */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Starting Odometer */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col">
                  <div className="w-full flex justify-between items-center mb-3">
                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                      1. Starting Odometer Photo
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs">
                      {lightboxItem.startingOdometer !== null ? `${lightboxItem.startingOdometer} KM` : 'N/A'}
                    </span>
                  </div>
                  {lightboxItem.startingOdometerImagePath && !lightboxItem.startingOdometerImagePath.startsWith('file://') ? (
                    <img
                      src={resolveImageUrl(lightboxItem.startingOdometerImagePath)}
                      alt="Starting Odometer"
                      className="w-full h-72 object-contain bg-slate-900 rounded-lg border border-slate-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://placehold.co/800x600/e2e8f0/475569?text=Image+Unavailable';
                      }}
                    />
                  ) : (
                    <div className="w-full h-72 flex flex-col items-center justify-center bg-white rounded-lg text-slate-500 border border-slate-200 p-4 text-center">
                      <div className="text-xs font-semibold text-slate-700">
                        {lightboxItem.startingOdometerImagePath?.startsWith('file://')
                          ? 'Photo captured on driver device (Local URI from older test)'
                          : 'No starting photo recorded'}
                      </div>
                      {lightboxItem.startingOdometerImagePath?.startsWith('file://') && (
                        <div className="text-[10px] text-amber-700 mt-1">
                          New photos taken with updated driver app will render here automatically in HD.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Starting Photo Location Details Card */}
                  <div className="mt-3 bg-white border border-slate-200 rounded-lg p-3 text-xs space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-700">
                      <span>START GPS LOCATION</span>
                      {lightboxItem.startGpsLat && lightboxItem.startGpsLng && (
                        <a
                          href={`https://www.google.com/maps?q=${lightboxItem.startGpsLat},${lightboxItem.startGpsLng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-sky-600 hover:text-sky-700 underline flex items-center gap-0.5"
                        >
                          Open in Maps ↗
                        </a>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-slate-700">
                      Coordinates: <span className="text-slate-900 font-bold">{lightboxItem.startGpsLat ? `${lightboxItem.startGpsLat.toFixed(5)}° N, ${lightboxItem.startGpsLng.toFixed(5)}° E` : 'Not recorded'}</span>
                    </div>
                    <div className="text-[11px] text-slate-700">
                      <strong className="text-slate-900">Area / Building:</strong>{' '}
                      <span className="text-emerald-700 font-medium">
                        {startLocName || lightboxItem.pickupAddress || 'Locating area...'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Final Odometer */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col">
                  <div className="w-full flex justify-between items-center mb-3">
                    <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                      2. Final Odometer Photo
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs">
                      {lightboxItem.finalOdometer !== null ? `${lightboxItem.finalOdometer} KM` : 'N/A'}
                    </span>
                  </div>
                  {lightboxItem.finalOdometerImagePath && !lightboxItem.finalOdometerImagePath.startsWith('file://') ? (
                    <img
                      src={resolveImageUrl(lightboxItem.finalOdometerImagePath)}
                      alt="Final Odometer"
                      className="w-full h-72 object-contain bg-slate-900 rounded-lg border border-slate-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://placehold.co/800x600/e2e8f0/475569?text=Image+Unavailable';
                      }}
                    />
                  ) : (
                    <div className="w-full h-72 flex flex-col items-center justify-center bg-white rounded-lg text-slate-500 border border-slate-200 p-4 text-center">
                      <div className="text-xs font-semibold text-slate-700">
                        {lightboxItem.finalOdometerImagePath?.startsWith('file://')
                          ? 'Photo captured on driver device (Local URI from older test)'
                          : 'No final photo recorded'}
                      </div>
                      {lightboxItem.finalOdometerImagePath?.startsWith('file://') && (
                        <div className="text-[10px] text-amber-700 mt-1">
                          New photos taken with updated driver app will render here automatically in HD.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Final Photo Location Details Card */}
                  <div className="mt-3 bg-white border border-slate-200 rounded-lg p-3 text-xs space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-blue-700">
                      <span>FINAL GPS LOCATION</span>
                      {lightboxItem.finalGpsLat && lightboxItem.finalGpsLng && (
                        <a
                          href={`https://www.google.com/maps?q=${lightboxItem.finalGpsLat},${lightboxItem.finalGpsLng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-sky-600 hover:text-sky-700 underline flex items-center gap-0.5"
                        >
                          Open in Maps ↗
                        </a>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-slate-700">
                      Coordinates: <span className="text-slate-900 font-bold">{lightboxItem.finalGpsLat ? `${lightboxItem.finalGpsLat.toFixed(5)}° N, ${lightboxItem.finalGpsLng.toFixed(5)}° E` : 'Not recorded'}</span>
                    </div>
                    <div className="text-[11px] text-slate-700">
                      <strong className="text-slate-900">Area / Building:</strong>{' '}
                      <span className="text-blue-700 font-medium">
                        {finalLocName || lightboxItem.dropAddress || 'Locating area...'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trip Execution Timings & Milestones */}
              {(() => {
                const timings = getTripTimingMilestones(lightboxItem);
                return (
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                          Trip Timings & Execution Milestones
                        </h4>
                      </div>
                      {timings.totalTripDuration && (
                        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded">
                          Total Duration: {timings.totalTripDuration}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      {timings.milestones.map((m) => (
                        <div
                          key={m.id}
                          className="bg-white border border-slate-200 rounded-lg p-2.5 flex flex-col justify-between shadow-2xs"
                        >
                          <div>
                            <span className="text-[11px] font-bold text-slate-900 block leading-tight">
                              {m.label}
                            </span>
                            <span className="text-[9px] text-slate-500 truncate block mt-0.5">
                              {m.sub}
                            </span>
                          </div>

                          <div className="mt-2.5 pt-1.5 border-t border-slate-100 flex items-end justify-between gap-1">
                            <div>
                              <span className="text-xs sm:text-sm font-black font-mono text-slate-900 block">
                                {m.timeStr || '--:--'}
                              </span>
                              {m.extraInfo && (
                                <span className="text-[9px] text-slate-600 font-medium truncate block mt-0.5">
                                  {m.extraInfo}
                                </span>
                              )}
                            </div>

                            {/* Status Icon Arranged Below */}
                            {m.status === 'COMPLETED' ? (
                              <span
                                className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center justify-center shrink-0 shadow-2xs mb-0.5"
                                title="Completed"
                              >
                                <svg className="w-3 h-3 stroke-[3]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </span>
                            ) : m.status === 'IN_PROGRESS' ? (
                              <span
                                className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 border border-blue-300 flex items-center justify-center shrink-0 shadow-2xs mb-0.5"
                                title="In Progress"
                              >
                                <svg className="w-3 h-3 stroke-[2.5] animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                </svg>
                              </span>
                            ) : (
                              <span
                                className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center shrink-0 mb-0.5"
                                title="Pending"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Trip Start Verification & Vehicle Inspection Photos (5 Photos) */}
              {(() => {
                const verificationData = getTripVerificationPhotos(lightboxItem);
                return (
                  <div className="bg-sky-50/50 border border-sky-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-sky-950 uppercase tracking-wider">
                          Trip Start Verification & Inspection (5 Photos)
                        </span>
                      </div>
                      <span className="text-[10px] bg-sky-100 text-sky-800 font-bold px-2 py-0.5 rounded-md border border-sky-200">
                        {verificationData.uploadedCount}/5 Attached
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      {verificationData.photos.map((item) => {
                        const photoUrl = item.url ? resolveImageUrl(item.url) : null;
                        return (
                          <div
                            key={item.key}
                            className="bg-white border border-slate-200 rounded-lg p-2.5 flex flex-col items-center text-center shadow-2xs"
                          >
                            <span className="text-[11px] font-bold text-slate-800 leading-tight">{item.label}</span>
                            <span className="text-[9px] text-slate-500 mb-1.5 truncate max-w-full">{item.sub}</span>
                            {photoUrl ? (
                              <div className="w-full h-28 bg-slate-900 rounded border border-emerald-300 overflow-hidden relative group">
                                <img
                                  src={photoUrl}
                                  alt={item.label}
                                  className="w-full h-full object-cover group-hover:scale-105 transition"
                                />
                                <a
                                  href={photoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-[10px] font-bold"
                                >
                                  Open Full HD ↗
                                </a>
                              </div>
                            ) : (
                              <div className="w-full h-28 bg-slate-100 rounded border border-dashed border-slate-300 flex flex-col items-center justify-center text-[10px] text-slate-400 p-2">
                                <span>Not Captured</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Distance Summary Metrics */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center shadow-xs">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Odometer Distance</div>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">
                    {lightboxItem.odometerDistanceKm !== null ? `${lightboxItem.odometerDistanceKm} km` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">GPS Breadcrumb Dist</div>
                  <div className="text-lg font-bold text-blue-700 mt-0.5">
                    {lightboxItem.gpsTrackedDistanceKm !== null ? `${lightboxItem.gpsTrackedDistanceKm} km` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Booked Estimated Dist</div>
                  <div className="text-lg font-bold text-slate-800 mt-0.5">{lightboxItem.estimatedDistanceKm} km</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Discrepancy</div>
                  <div
                    className={`text-lg font-black mt-0.5 ${
                      lightboxItem.hasDiscrepancy ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {lightboxItem.discrepancyPercent !== null ? `${lightboxItem.discrepancyPercent}%` : '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setLightboxItem(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition"
              >
                Close Lightbox
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
