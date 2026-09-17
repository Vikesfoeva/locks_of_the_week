import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  buildRaceModel,
  movement,
  CHART_W,
  CHART_H,
  MARGIN,
  PLOT_W,
  COLORS,
  LABEL_H,
} from '../utils/rankRace';

const MD_QUERY = '(min-width: 768px)';

// On md+ the wrapper has a CSS height (it is sized to fit the viewport), so the
// viewBox height follows the wrapper's aspect ratio and the drawing fills it
// instead of letterboxing. Below md the wrapper is height-auto and the SVG sets
// its own height from the design's 1200x820 box, so no measuring happens there.
function useFittedChartHeight(wrapRef, playerCount) {
  const [chartH, setChartH] = useState(CHART_H);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(MD_QUERY);
    const minH = Math.max(560, playerCount * LABEL_H + MARGIN.top + MARGIN.bottom + 24);

    const fit = () => {
      if (!mq.matches) {
        setChartH(CHART_H);
        return;
      }
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      const fitted = Math.round((CHART_W * height) / width);
      setChartH(Math.min(1000, Math.max(minH, fitted)));
    };

    fit();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    if (observer) observer.observe(el);
    mq.addEventListener('change', fit);
    return () => {
      if (observer) observer.disconnect();
      mq.removeEventListener('change', fit);
    };
  }, [wrapRef, playerCount]);

  return chartH;
}

function movementLabel(delta) {
  if (delta === null) return { text: '—', className: 'font-medium text-gray-400', color: undefined };
  if (delta === 0) return { text: '±0', className: 'font-medium text-gray-400', color: undefined };
  if (delta > 0) return { text: `▲ ${delta}`, className: 'font-bold', color: COLORS.perfectDot };
  return { text: `▼ ${Math.abs(delta)}`, className: 'font-bold', color: COLORS.last };
}

// Colored lines (top 5, last place, the viewer) keep their color when focused;
// gray lines switch to ink so the focused line is always readable.
const focusColorOf = p => ((p.featured || p.isSelf) ? p.color : COLORS.ink);

/**
 * Rank-over-time bump chart. `data` is the GET /api/standings/history response.
 * Hover isolates a player; the pinned player (controlled via `pinnedId` /
 * `onPinChange`) stays isolated until cleared by clicking the background,
 * clicking the player again, or pressing Escape. The viewer's own line
 * (`viewerId`) is always drawn in ink with a "You" tag and only dims part-way.
 */
export default function RankRaceChart({ data, viewerId = null, pinnedId = null, onPinChange }) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const tipRef = useRef(null);

  const playerCount = Array.isArray(data?.players) ? data.players.length : 0;
  const chartH = useFittedChartHeight(wrapRef, playerCount);
  const model = useMemo(() => buildRaceModel(data, { chartH, viewerId }), [data, chartH, viewerId]);

  const [hoverId, setHoverId] = useState(null);
  const [tip, setTip] = useState(null); // { id, w }
  const activeId = pinnedId ?? hoverId;
  const dimming = activeId != null;

  // Draw the focused player last so its halo and dots sit above every other line.
  const orderedPlayers = useMemo(() => {
    const active = activeId != null ? model.byId[activeId] : null;
    if (!active) return model.players;
    return [...model.players.filter(p => p.id !== activeId), active];
  }, [model, activeId]);

  const setPin = useCallback(id => {
    if (onPinChange) onPinChange(id);
  }, [onPinChange]);

  const enterLine = useCallback(e => setHoverId(e.currentTarget.dataset.id), []);
  const leaveLine = useCallback(() => setHoverId(null), []);
  const enterPoint = useCallback(e => {
    const { id, w } = e.currentTarget.dataset;
    setHoverId(id);
    setTip({ id, w: Number(w) });
  }, []);
  const leavePoint = useCallback(() => {
    setHoverId(null);
    setTip(null);
  }, []);
  const togglePin = useCallback(e => {
    e.stopPropagation(); // the wrapper's click clears the pin
    const { id } = e.currentTarget.dataset;
    setPin(pinnedId === id ? null : id);
  }, [pinnedId, setPin]);
  const clearPin = useCallback(() => {
    setPin(null);
    setTip(null);
  }, [setPin]);
  const labelKeyDown = useCallback(e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      togglePin(e);
    }
  }, [togglePin]);

  useEffect(() => {
    if (pinnedId == null) return undefined;
    const onKey = e => {
      if (e.key === 'Escape') clearPin();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pinnedId, clearPin]);

  // Anchor the HTML tooltip at the hovered/focused data point, clamped inside the wrapper.
  useLayoutEffect(() => {
    const box = tipRef.current;
    const svg = svgRef.current;
    const wrap = wrapRef.current;
    if (!tip || !box || !svg || !wrap || typeof svg.getScreenCTM !== 'function') return;
    const player = model.byId[tip.id];
    const pt = player && player.points[tip.w];
    const ctm = svg.getScreenCTM();
    if (!pt || !ctm) return;
    const p = svg.createSVGPoint();
    p.x = pt.x;
    p.y = pt.y;
    const s = p.matrixTransform(ctm);
    const wr = wrap.getBoundingClientRect();
    const tw = box.offsetWidth;
    const th = box.offsetHeight;
    let left = s.x - wr.left + 14;
    let top = s.y - wr.top - 10;
    if (left + tw > wr.width - 4) left = s.x - wr.left - 14 - tw;
    left = Math.max(4, left);
    top = Math.max(4, Math.min(top, wr.height - th - 4));
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
  }, [tip, model]);

  // Everything but the focused player fades out; the viewer's own line stays
  // faintly visible so the focused player can be compared against it.
  const dim = id => {
    if (!dimming || id === activeId) return 'opacity-100';
    if (viewerId != null && id === viewerId) return 'opacity-[0.35]';
    return 'opacity-[0.08]';
  };
  const plotBottom = MARGIN.top + model.plotH;
  const lastIdx = model.WEEKS - 1;
  const showAllEndpoints = model.WEEKS === 1; // a single week has no line to see

  // Invisible hit targets on every point make the whole chart hoverable despite
  // having almost no visible dots. Static apart from the pin toggle.
  const hitLayer = useMemo(() => (
    <g>
      {model.players.map(p => p.points.map(pt => (
        <circle
          key={`${p.id}-${pt.w}`}
          cx={pt.x}
          cy={pt.y}
          r="8"
          fill="transparent"
          pointerEvents="all"
          className="cursor-pointer"
          data-id={p.id}
          data-w={pt.w}
          onMouseEnter={enterPoint}
          onMouseLeave={leavePoint}
          onClick={togglePin}
        />
      )))}
    </g>
  ), [model, enterPoint, leavePoint, togglePin]);

  const tipPlayer = tip ? model.byId[tip.id] : null;
  const tipColor = tipPlayer ? (tipPlayer.id === activeId ? focusColorOf(tipPlayer) : tipPlayer.color) : null;
  const tipRank = tipPlayer ? tipPlayer.ranks[tip.w] : null;
  const tipMove = tipPlayer ? movementLabel(movement(tipPlayer.ranks, tip.w)) : null;
  const tipPerfect = tipPlayer ? tipPlayer.perfect.includes(tip.w + 1) : false;

  return (
    <div ref={wrapRef} className="relative w-full h-full" onClick={clearPin}>
      <p className="sr-only">
        Rank over time for every league member, one line per player, with rank 1 at the top.
        The same data is available as a table on the Standings page.
      </p>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CHART_W} ${model.chartH}`}
        preserveAspectRatio="xMidYMid meet"
        className="block w-full h-auto md:h-full select-none"
        role="group"
        aria-label="Rank over time chart"
      >
        <defs>
          <linearGradient id="race-last-band" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#fef2f2" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#fdf2f8" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Last-place band */}
        {model.bandY != null && (
          <rect
            x={MARGIN.left}
            y={model.bandY - model.rowH / 2}
            width={PLOT_W}
            height={model.rowH}
            fill="url(#race-last-band)"
            pointerEvents="none"
          />
        )}

        {/* Sparse gridlines */}
        {model.weekTicks.map(t => (
          <line key={`wg${t.week}`} x1={t.x} x2={t.x} y1={MARGIN.top} y2={plotBottom} stroke="#f3f4f6" strokeWidth="1" />
        ))}
        {model.rankTicks.map(t => (
          <line key={`rg${t.rank}`} x1={MARGIN.left} x2={MARGIN.left + PLOT_W} y1={t.y} y2={t.y} stroke="#e5e7eb" strokeWidth="1" />
        ))}

        {/* Prize cutoff below rank 5 */}
        {model.cutoffY != null && (
          <>
            <line
              x1={MARGIN.left}
              x2={MARGIN.left + PLOT_W}
              y1={model.cutoffY}
              y2={model.cutoffY}
              stroke="#facc15"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.7"
            />
            <text
              x={MARGIN.left + 6}
              y={model.cutoffY - 4}
              fill="#a16207"
              className="text-[10px] font-semibold uppercase tracking-[0.04em]"
            >
              Prize cutoff
            </text>
          </>
        )}

        {/* Axes */}
        {model.weekTicks.map(t => (
          <text
            key={`wt${t.week}`}
            x={t.x}
            y={plotBottom + 18}
            textAnchor="middle"
            fill="#4b5563"
            className="text-[10px] font-bold uppercase tracking-wide"
          >
            Wk {t.week}
          </text>
        ))}
        {model.rankTicks.map(t => (
          <text
            key={`rt${t.rank}`}
            x={MARGIN.left - 8}
            y={t.y + 4}
            textAnchor="end"
            fill="#6b7280"
            className="font-mono text-[11px] font-semibold"
          >
            {t.rank}
          </text>
        ))}

        {/* Lines: pack first, then colored lines, the viewer, and finally the focused player */}
        {orderedPlayers.map(p => {
          const active = p.id === activeId;
          const stroke = active ? focusColorOf(p) : p.color;
          const strokeWidth = active ? 3.5 : p.isSelf ? 3 : p.featured ? 2 : 1;
          const end = p.points[lastIdx];
          return (
            <g key={p.id} className={`transition-opacity duration-200 ${dim(p.id)}`}>
              {active && (
                <path
                  d={p.path}
                  fill="none"
                  stroke={COLORS.halo}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.9"
                  pointerEvents="none"
                  data-role="halo"
                />
              )}
              <path
                d={p.path}
                fill="none"
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="none"
                className="transition-[stroke-width] duration-200"
                data-role="line"
              />
              {/* Wide invisible twin so the thin line is easy to hover */}
              <path
                d={p.path}
                fill="none"
                stroke="transparent"
                strokeWidth="10"
                pointerEvents="stroke"
                className="cursor-pointer"
                data-id={p.id}
                onMouseEnter={enterLine}
                onMouseLeave={leaveLine}
                onClick={togglePin}
              />
              {active && p.points.map(pt => (
                <circle
                  key={`f${pt.w}`}
                  cx={pt.x}
                  cy={pt.y}
                  r="3"
                  fill={stroke}
                  stroke="#fff"
                  strokeWidth="1.5"
                  pointerEvents="none"
                  data-role="week-dot"
                />
              ))}
              {(p.featured || showAllEndpoints) && (
                <circle cx={end.x} cy={end.y} r={active ? 4.5 : 4} fill={stroke} stroke="#fff" strokeWidth="1.5" pointerEvents="none" />
              )}
              {p.points
                .filter(pt => p.perfect.includes(pt.w + 1))
                .map(pt => (
                  <circle
                    key={pt.w}
                    cx={pt.x}
                    cy={pt.y}
                    r="3.5"
                    fill={COLORS.perfectDot}
                    stroke="#fff"
                    strokeWidth="1.5"
                    pointerEvents="none"
                  />
                ))}
            </g>
          );
        })}

        {hitLayer}

        {/* End labels: one per player, collision-resolved */}
        {model.labels.map(l => {
          const active = l.id === activeId;
          const player = model.byId[l.id];
          const fill = active ? focusColorOf(player) : l.color;
          const sizeCls = active
            ? 'text-[12px] font-bold'
            : l.isSelf
              ? 'text-[11px] font-bold'
              : l.featured
                ? 'text-[11px] font-semibold'
                : 'text-[10px] font-medium';
          const textOpacity = active || l.isSelf ? 'opacity-100' : l.featured ? '' : 'opacity-70';
          const rankOpacity = active ? 'opacity-100' : l.featured ? 'opacity-[0.85]' : 'opacity-60';
          return (
            <g key={l.id} className={`transition-opacity duration-200 ${dim(l.id)}`}>
              {l.leader && (
                <line
                  x1={l.x - 4}
                  y1={l.yIdeal}
                  x2={l.x - 1}
                  y2={l.y}
                  stroke={fill}
                  strokeWidth={active ? 1.5 : 1}
                  opacity={active ? 0.8 : l.featured ? 0.5 : 0.3}
                  pointerEvents="none"
                />
              )}
              <text
                x={l.x}
                y={l.y}
                fill={fill}
                dominantBaseline="middle"
                tabIndex={0}
                role="button"
                aria-label={`${player.name}${l.isSelf ? ' (you)' : ''}, rank ${l.rank}`}
                data-id={l.id}
                data-w={lastIdx}
                paintOrder={active ? 'stroke' : undefined}
                stroke={active ? COLORS.halo : undefined}
                strokeWidth={active ? 3 : undefined}
                strokeLinejoin="round"
                className={`cursor-pointer outline-none ${sizeCls} ${textOpacity}`}
                onMouseEnter={enterLine}
                onMouseLeave={leaveLine}
                onFocus={enterPoint}
                onBlur={leavePoint}
                onClick={togglePin}
                onKeyDown={labelKeyDown}
              >
                <tspan className={`font-mono font-semibold tabular-nums ${rankOpacity}`}>{l.rank}</tspan>
                <tspan dx="5">{l.name}</tspan>
                {l.isSelf && <tspan dx="4" className="font-medium opacity-70">· You</tspan>}
              </text>
            </g>
          );
        })}
      </svg>

      {tipPlayer && (
        <div
          ref={tipRef}
          className="pointer-events-none absolute z-10 min-w-[180px] rounded-md border border-gray-200 bg-white p-2.5 shadow-lg"
          style={{ left: 0, top: 0, borderLeft: `4px solid ${tipColor}` }}
        >
          <div className="flex items-center gap-2 text-sm font-bold leading-tight text-gray-900">
            <span className="inline-block h-2.5 w-2.5 flex-none rounded-sm" style={{ background: tipColor }} />
            {tipPlayer.name}
            {tipPlayer.isSelf && <span className="text-xs font-medium text-gray-500">(you)</span>}
          </div>
          <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-gray-500">
            Week {tip.w + 1}
            {tipPerfect && (
              <>
                {' · '}
                <span className="font-bold" style={{ color: COLORS.perfectDot }}>3-0 Week 🎉</span>
              </>
            )}
          </div>
          <div className="mt-2 flex justify-between gap-4 text-sm">
            <span className="text-gray-600">Rank</span>
            <b className="font-mono text-gray-900">#{tipRank}</b>
          </div>
          <div className="mt-1 flex justify-between gap-4 text-sm">
            <span className="text-gray-600">Movement</span>
            <span className={tipMove.className} style={{ color: tipMove.color }}>{tipMove.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}
