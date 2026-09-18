import { useMemo, useState } from 'react';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { FunnelIcon as FunnelIconOutline } from '@heroicons/react/24/outline';
import { FunnelIcon as FunnelIconSolid } from '@heroicons/react/24/solid';
import { PRIZE_RANKS } from '../utils/rankRace';

const PRESET_CLS = 'rounded border border-gray-300 bg-white px-2.5 py-2.5 text-xs font-medium text-gray-700 hover:bg-gray-100 md:py-1.5';

// Every typed word must start some word of the name (case-insensitive), so "al kru"
// finds "Alex Krupiak"; a bare number ("12" / "#12") matches that exact rank.
function matches(player, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const rank = q.replace(/^#/, '');
  if (/^\d+$/.test(rank)) return String(player.finalRank) === rank;
  const words = String(player.name).toLowerCase().split(/\s+/);
  return q.split(/\s+/).every(token => words.some(word => word.startsWith(token)));
}

/**
 * Show/hide players on the Standings Race chart. `roster` is every plottable player
 * ({ id, name, finalRank }, already in rank order); `hiddenIds` is the Set of players
 * not drawn (empty = everyone). Changes apply live, and `onChange` always receives a
 * NEW Set — the chart memoizes on its identity. Hiding is render-only: ranks never
 * change.
 */
export default function RacePlayerPicker({ roster, hiddenIds, onChange, viewerId = null }) {
  const total = roster.length;
  const visible = roster.filter(p => !hiddenIds.has(p.id)).length;
  const filtered = visible < total;

  return (
    <Popover className="relative flex-none">
      <PopoverButton
        className={`flex items-center gap-1.5 rounded px-2.5 py-2 text-xs font-medium md:py-1 ${
          filtered
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'border border-gray-400 bg-white text-gray-700 hover:bg-gray-100'
        }`}
      >
        {filtered ? <FunnelIconSolid className="h-3.5 w-3.5" /> : <FunnelIconOutline className="h-3.5 w-3.5" />}
        <span>Players</span>
        <span className={`min-w-[4.5rem] rounded-full px-1.5 py-0.5 text-center tabular-nums ${filtered ? 'bg-white text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
          {visible} of {total}
          <span className="sr-only"> shown</span>
        </span>
      </PopoverButton>

      {/* Portaled: the chart card is overflow-hidden. Headless UI caps the height from
          --anchor-max-height and scrolls the panel itself once the list hits its floor. */}
      <PopoverPanel
        portal
        anchor={{ to: 'bottom start', gap: 4, padding: 8 }}
        data-race-picker
        className="z-50 flex w-72 flex-col rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-lg [--anchor-max-height:28rem]"
      >
        <PickerBody roster={roster} hiddenIds={hiddenIds} onChange={onChange} viewerId={viewerId} />
      </PopoverPanel>
    </Popover>
  );
}

// Mounted only while the panel is open, so the search box starts empty every time.
function PickerBody({ roster, hiddenIds, onChange, viewerId }) {
  const [search, setSearch] = useState('');

  const total = roster.length;
  const visible = roster.filter(p => !hiddenIds.has(p.id)).length;
  const viewerInRoster = viewerId != null && roster.some(p => p.id === viewerId);

  // The viewer's own row leads the list; everyone else stays in rank order.
  const rows = useMemo(() => {
    const ordered = [...roster.filter(p => p.id === viewerId), ...roster.filter(p => p.id !== viewerId)];
    return ordered.filter(p => matches(p, search));
  }, [roster, viewerId, search]);

  const showOnly = keep => onChange(new Set(roster.filter(p => !keep(p)).map(p => p.id)));
  const toggle = id => {
    const next = new Set(hiddenIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  // Enter toggles the first match and selects the text, so the next name overwrites it.
  const searchKeyDown = e => {
    if (e.key !== 'Enter' || !search.trim() || rows.length === 0) return;
    e.preventDefault();
    toggle(rows[0].id);
    e.currentTarget.select();
  };

  return (
    <>
      <input
        type="search"
        value={search}
        onChange={e => setSearch(e.target.value)}
        onKeyDown={searchKeyDown}
        placeholder="Search players…"
        aria-label="Search players"
        className="w-full flex-none rounded border border-gray-300 px-2.5 py-1.5 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 lg:text-sm"
      />

      <div className="mt-2 flex flex-none flex-wrap gap-1.5">
        <button type="button" className={PRESET_CLS} onClick={() => onChange(new Set())}>All {total}</button>
        <button type="button" className={PRESET_CLS} onClick={() => showOnly(() => false)}>None</button>
        <button type="button" className={PRESET_CLS} onClick={() => showOnly(p => p.finalRank <= PRIZE_RANKS)}>Top {PRIZE_RANKS}</button>
        {viewerInRoster && (
          <>
            <button type="button" className={PRESET_CLS} onClick={() => showOnly(p => p.id === viewerId)}>Just me</button>
            <button type="button" className={PRESET_CLS} onClick={() => showOnly(p => p.id === viewerId || p.finalRank <= PRIZE_RANKS)}>
              Me + Top {PRIZE_RANKS}
            </button>
          </>
        )}
        <button type="button" className={PRESET_CLS} onClick={() => showOnly(p => hiddenIds.has(p.id))}>Invert</button>
      </div>

      <div role="group" aria-label="Players" className="mt-2 min-h-[8rem] flex-1 overflow-y-auto overscroll-contain border-t border-gray-100 pt-1">
        <ul>
          {rows.map(p => {
            const isSelf = p.id === viewerId;
            return (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-2 hover:bg-gray-50 md:py-1">
                  <input
                    type="checkbox"
                    checked={!hiddenIds.has(p.id)}
                    onChange={() => toggle(p.id)}
                    className="h-4 w-4 flex-none rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="w-7 flex-none text-right font-mono text-xs tabular-nums text-gray-500">#{p.finalRank}</span>
                  <span className={`truncate ${isSelf ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                    {p.name}
                    {isSelf && <span className="font-medium text-gray-500"> (you)</span>}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <p role="status" className={rows.length === 0 ? 'px-1 py-2 text-gray-500' : 'sr-only'}>{rows.length === 0 ? 'No matches' : ''}</p>
      </div>

      <div className="mt-2 flex-none border-t border-gray-100 pt-2 text-xs text-gray-500">
        <span aria-live="polite" aria-atomic="true" className="font-medium text-gray-700">{visible} of {total} shown</span>
        <span> · Hidden players still count toward ranks</span>
      </div>
    </>
  );
}
