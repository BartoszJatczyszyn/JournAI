import React, { useMemo, useState } from 'react';
import { Card } from 'shared/ui';

// Generic weekly trends table
// props:
// - title: string
// - rows: [{ week: string, ...metrics }]
// - columns: [{ key: string, label: string, format?: (v,row)=>ReactNode, tooltip?: (value, row, prevRow)=>string|null|undefined }]
export default function WeeklyTrends({
  title = 'Weekly Trends',
  rows = [],
  columns = [],
  defaultSortKey = 'week',
  defaultSortDir = 'desc', // 'asc' | 'desc' (default changed to desc)
  stickyFirstColumn = true,
} = {}) {
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDir, setSortDir] = useState(defaultSortDir);

  const safeRows = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);

  // Build a stable chronological view by ISO week (YYYY-Www) ascending for tooltips
  const byWeekAsc = useMemo(() => {
    const arr = (Array.isArray(safeRows) ? safeRows.slice() : []).filter(r => r && r.week);
    arr.sort((a, b) => String(a.week).localeCompare(String(b.week)));
    return arr;
  }, [safeRows]);

  const prevByWeek = useMemo(() => {
    const map = new Map();
    for (let i = 0; i < byWeekAsc.length; i++) {
      const cur = byWeekAsc[i];
      const prev = i > 0 ? byWeekAsc[i - 1] : null;
      if (cur?.week) map.set(cur.week, prev || null);
    }
    return map;
  }, [byWeekAsc]);

  const formatDeltaTooltip = (cur, prev) => {
    const toNum = (v) => {
      const n = typeof v === 'number' ? v : (v == null ? NaN : Number(v));
      return Number.isFinite(n) ? n : null;
    };
    const c = toNum(cur);
    const p = toNum(prev);
    if (c == null || p == null) return null;
    const d = c - p;
    const arrow = d > 0 ? '↑' : d < 0 ? '↓' : '·';
    const fmt = (x) => {
      const ax = Math.abs(x);
      if (ax >= 100) return Math.round(x).toString();
      if (ax >= 10) return x.toFixed(1);
      return x.toFixed(2);
    };
    const pct = p !== 0 ? ((d / p) * 100) : null;
    const pctTxt = pct == null ? '' : ` (${d>0?'+':''}${fmt(pct)}%)`;
    // Short message in English
    return `${arrow} ${d>0?'+':''}${fmt(d)}${pctTxt} vs previous week`;
  };

  const isoWeekToRange = (isoStr) => {
    try {
      const m = /^([0-9]{4})-W([0-9]{2})$/.exec(String(isoStr));
      if (!m) return null;
      const year = Number(m[1]);
      const week = Number(m[2]);
      // Thursday in current week gives ISO year
      const thursday = new Date(Date.UTC(year, 0, 4 + (week - 1) * 7));
      // Find Monday of this week
      const day = thursday.getUTCDay(); // 0..6, Sun=0
      const monday = new Date(thursday);
      const dayMonIdx = (day + 6) % 7; // Mon=0
      monday.setUTCDate(thursday.getUTCDate() - dayMonIdx);
      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);
      const pad = (n) => String(n).padStart(2, '0');
      const fmt = (d) => `${pad(d.getUTCDate())}.${pad(d.getUTCMonth()+1)}`;
      const title = `${fmt(monday)} - ${fmt(sunday)} ${sunday.getUTCFullYear()}`;
      return { start: monday, end: sunday, title };
    } catch (_) { return null; }
  };

  const onToggleSort = (key) => {
    if (!key) return;
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Default: strings ascend, numbers descend by default can be surprising — keep ascend
      setSortDir('asc');
    }
  };

  const sortedRows = useMemo(() => {
    const arr = [...safeRows];
    const getVal = (r) => r?.[sortKey];
    const cmp = (a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      const an = typeof va === 'number' || (!isNaN(parseFloat(va)) && isFinite(va));
      const bn = typeof vb === 'number' || (!isNaN(parseFloat(vb)) && isFinite(vb));
      const na = an ? Number(va) : null;
      const nb = bn ? Number(vb) : null;
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (an && bn) return na - nb;
      // try date-like ISO strings for 'week' field (YYYY-Www)
      if (typeof va === 'string' && typeof vb === 'string') {
        return String(va).localeCompare(String(vb));
      }
      return String(va).localeCompare(String(vb));
    };
    arr.sort(cmp);
    if (sortDir === 'desc') arr.reverse();

    // Optional debug
    try {
      if (typeof window !== 'undefined' && localStorage.getItem('debugWeeklyTrends') === '1') {
        // eslint-disable-next-line no-console
        console.log('[WeeklyTrends] sort', { sortKey, sortDir, sampleIn: safeRows.slice(0, 2), sampleOut: arr.slice(0, 2) });
      }
    } catch (e) {
      // ignore logging errors
    }

    return arr;
  }, [safeRows, sortKey, sortDir]);

  const isEmpty = sortedRows.length === 0;

  return (
    <Card title={title}>
      {isEmpty ? (
        <div className="px-3 py-2 text-sm text-gray-500">No data available.</div>
      ) : (
        <div className="weekly-trends-widget overflow-x-auto text-gray-800 dark:text-gray-100">
          <table className="min-w-full text-xs md:text-[13px] border-separate border-spacing-0 text-gray-800 dark:text-gray-100">
            <thead>
              <tr className="text-left bg-gray-200 dark:bg-gray-900 text-gray-800 dark:text-gray-100">
                {/* First column is Week, sticky by default for readability */}
                <th
                  className={`py-2 px-3 font-medium text-[11px] uppercase tracking-wide align-bottom cursor-pointer select-none ${stickyFirstColumn ? 'sticky left-0 z-10 bg-white dark:bg-gray-900' : ''}`}
                  onClick={() => onToggleSort('week')}
                >
                  Week {sortKey === 'week' ? (<span className="text-[9px] ml-0.5">{sortDir === 'asc' ? '▲' : '▼'}</span>) : null}
                </th>
                {columns.map(col => {
                  const active = sortKey === col.key;
                  return (
                    <th
                      key={col.key}
                      onClick={() => onToggleSort(col.key)}
                      className={`py-2 px-3 font-medium text-[11px] uppercase tracking-wide align-bottom cursor-pointer select-none ${col.className || ''}`}
                    >
                      {col.label} {active ? (<span className="text-[9px] ml-0.5">{sortDir === 'asc' ? '▲' : '▼'}</span>) : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r, idx) => {
                const weekRange = r?.week ? isoWeekToRange(r.week) : null;
                return (
                  <tr key={r.week || idx} className="group border-b last:border-b-0 hover:bg-indigo-100 dark:hover:bg-indigo-900/20 transition-colors bg-white dark:bg-gray-900">
                    <td
                      className={`py-2 px-3 font-semibold ${stickyFirstColumn ? 'sticky left-0 bg-white dark:bg-gray-900 z-10' : ''}`}
                      title={weekRange?.title || undefined}
                    >
                      {r.week ?? '-'}
                    </td>
                    {columns.map(col => {
                      const prev = prevByWeek.get(r.week);
                      const customTt = typeof col.tooltip === 'function' ? col.tooltip(r[col.key], r, prev || null) : undefined;
                      const defTt = formatDeltaTooltip(r[col.key], prev ? prev[col.key] : null);
                      const tt = (customTt === null || customTt === undefined) ? defTt : customTt;
                      return (
                        <td key={col.key} className={`py-2 px-3 ${col.tdClassName || ''}`} title={tt || undefined}>
                          {col.format ? col.format(r[col.key], r) : (r[col.key] ?? '-')}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* Scoped contrast styles to match Activity table */}
          <style>{`
            .weekly-trends-widget table.min-w-full thead tr { border-bottom: 1px solid rgba(15,23,42,0.08); }
            .weekly-trends-widget table.min-w-full th { padding: 10px 12px; background-clip: padding-box; font-weight: 600; }
            .weekly-trends-widget table.min-w-full td { padding: 10px 12px; font-weight: 500; }
            .weekly-trends-widget table.min-w-full tbody tr { border-bottom: 1px solid rgba(15,23,42,0.06); }
            /* alternating rows for stronger contrast */
            .weekly-trends-widget table.min-w-full tbody tr:nth-child(odd) { background: rgba(255,255,255,1); }
            .weekly-trends-widget table.min-w-full tbody tr:nth-child(even) { background: rgba(247,250,252,1); }
            .dark .weekly-trends-widget table.min-w-full tbody tr:nth-child(odd) { background: rgba(6,10,15,1); }
            .dark .weekly-trends-widget table.min-w-full tbody tr:nth-child(even) { background: rgba(10,14,20,0.95); }
            /* stronger text colors for legibility */
            .weekly-trends-widget table.min-w-full, 
            .weekly-trends-widget table.min-w-full th, 
            .weekly-trends-widget table.min-w-full td { color: #071028; }
            .dark .weekly-trends-widget table.min-w-full, 
            .dark .weekly-trends-widget table.min-w-full th, 
            .dark .weekly-trends-widget table.min-w-full td { color: #e6eef8; }
            /* sticky left column must be opaque */
            .weekly-trends-widget table.min-w-full th.sticky, 
            .weekly-trends-widget table.min-w-full td.sticky { background: white; }
            .dark .weekly-trends-widget table.min-w-full th.sticky, 
            .dark .weekly-trends-widget table.min-w-full td.sticky { background: #071028; }
          `}</style>
        </div>
      )}
    </Card>
  );
}
