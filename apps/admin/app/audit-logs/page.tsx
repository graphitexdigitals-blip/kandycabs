'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminNavbar } from '@/components/AdminNavbar';

export const dynamic = 'force-dynamic';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalCount: 0, totalPages: 1, limit: 30, page: 1 });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: '30',
        action: actionFilter,
        ...(search ? { search } : {}),
      });

      const res = await fetch(`/api/admin/audit-logs?${queryParams}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        if (data.pagination) setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes('APPROVED') || action.includes('VERIFIED')) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    }
    if (action.includes('REJECTED') || action.includes('CANCELLED')) {
      return 'bg-rose-100 text-rose-800 border-rose-300';
    }
    if (action.includes('OVERRIDE')) {
      return 'bg-amber-100 text-amber-800 border-amber-300';
    }
    if (action.includes('DISPATCH') || action.includes('ACCEPTED')) {
      return 'bg-blue-100 text-blue-800 border-blue-300';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <AdminNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-6 lg:px-8 py-3 sm:py-6 space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 sm:gap-4 bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              System & Operational Audit Logs
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1">
              Immutable, chronological record of all administrative, dispatch, KYC, payment, and security actions
            </p>
          </div>
          <button
            onClick={() => fetchLogs()}
            className="self-end sm:self-auto px-3 py-1.5 sm:px-3.5 sm:py-2 bg-slate-50 hover:bg-slate-100 text-xs font-semibold rounded-lg border border-slate-200 flex items-center gap-1.5 text-slate-700 transition shadow-2xs shrink-0"
          >
            Refresh
          </button>
        </div>

        {/* Filters & Search */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row gap-2.5 sm:gap-4 justify-between items-stretch md:items-center shadow-xs">
          <div className="flex flex-wrap gap-1 sm:gap-1.5">
            {[
              { id: 'ALL', label: 'All Events' },
              { id: 'PAYMENT_VERIFIED_WEBHOOK', label: 'Payments' },
              { id: 'DRIVER_KYC_APPROVED', label: 'KYC Approved' },
              { id: 'DRIVER_KYC_REJECTED', label: 'KYC Rejected' },
              { id: 'OTP_OVERRIDE_APPROVED', label: 'OTP Overrides' },
              { id: 'BOOKING_DISPATCHED', label: 'Dispatches' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActionFilter(tab.id);
                  setPage(1);
                }}
                className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition ${
                  actionFilter === tab.id
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSearchSubmit} className="w-full md:w-80 flex gap-1.5 sm:gap-2">
            <input
              type="text"
              placeholder="Search by action, reason, user, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-slate-50 sm:bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
            />
            <button
              type="submit"
              className="px-3 sm:px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition shadow-xs shrink-0"
            >
              Search
            </button>
          </form>
        </div>

        {/* Audit Logs Table / Feed */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          {loading ? (
            <div className="py-14 sm:py-20 text-center text-slate-400 text-xs sm:text-sm">
              <div className="w-6 h-6 border-2 border-slate-300 border-t-amber-500 rounded-full animate-spin mx-auto mb-2" />
              <div>Loading audit trail...</div>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 sm:py-16 text-center text-slate-400 text-xs sm:text-sm">
              <div>No audit logs found matching your query.</div>
            </div>
          ) : (
            <>
              {/* Mobile Card Feed (visible on < md) */}
              <div className="divide-y divide-slate-100 md:hidden">
                {logs.map((log) => (
                  <div key={log.id} className="p-3 space-y-1.5 hover:bg-slate-50 transition">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getActionBadgeColor(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(log.createdAt).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        {new Date(log.createdAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-0.5">
                      <div className="font-semibold text-slate-900">
                        {log.actorName}{' '}
                        <span className="text-[10px] font-bold text-amber-800 uppercase">({log.actorRole})</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 truncate max-w-[130px]" title={log.entityId}>
                        {log.entityType} {log.entityId ? `• ${log.entityId.slice(0, 8)}` : ''}
                      </div>
                    </div>

                    {log.reason && (
                      <div className="text-[11px] text-slate-600 bg-slate-50 rounded p-1.5 border border-slate-100 leading-snug">
                        {log.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table (hidden on mobile, visible md+) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3.5">Timestamp</th>
                      <th className="py-2.5 px-3.5">Action</th>
                      <th className="py-2.5 px-3.5">Actor</th>
                      <th className="py-2.5 px-3.5">Entity</th>
                      <th className="py-2.5 px-3.5">Details & Rationale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          <div className="font-mono font-medium text-slate-800">
                            {new Date(log.createdAt).toLocaleDateString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">
                            {new Date(log.createdAt).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </div>
                        </td>

                        <td className="py-2.5 px-3.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getActionBadgeColor(
                              log.action
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>

                        <td className="py-2.5 px-3.5">
                          <div className="font-semibold text-slate-900">{log.actorName}</div>
                          {log.actorPhone && <div className="text-[10px] text-slate-500">{log.actorPhone}</div>}
                          <div className="text-[9px] text-amber-800 font-bold uppercase">{log.actorRole}</div>
                        </td>

                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          <div className="text-slate-800 font-medium">{log.entityType}</div>
                          <div className="text-[10px] font-mono text-slate-500 truncate max-w-[140px]" title={log.entityId}>
                            {log.entityId}
                          </div>
                        </td>

                        <td className="py-2.5 px-3.5">
                          <div className="text-slate-700 text-xs leading-relaxed max-w-xl">
                            {log.reason || 'No additional details logged.'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Pagination */}
          <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] sm:text-xs text-slate-600">
            <div>
              Showing {logs.length} of {pagination.totalCount} log records
            </div>
            <div className="flex gap-1.5 sm:gap-2 items-center">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-50 text-slate-700 rounded transition shadow-2xs font-medium"
              >
                Previous
              </button>
              <span className="px-2 py-1 font-semibold text-slate-700">
                Page {page} of {pagination.totalPages}
              </span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-50 text-slate-700 rounded transition shadow-2xs font-medium"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
