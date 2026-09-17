// Pure geometry + styling rules for the Standings Race bump chart.
// Coordinates are in the SVG viewBox space (CHART_W wide, `chartH` tall).
// Ported from the design handoff prototype; keep the algorithms in step with it.

export const CHART_W = 1200;
export const CHART_H = 820; // design default; the chart may pass a fitted height
export const MARGIN = { top: 32, right: 140, bottom: 48, left: 52 };
export const PLOT_W = CHART_W - MARGIN.left - MARGIN.right;

export const TOP_COLORS = ['#0284c7', '#0369a1', '#4f46e5', '#0ea5e9', '#2563eb', '#1d4ed8', '#38bdf8'];
export const COLORS = {
  last: '#dc2626',
  perfect: '#94a3b8',
  pack: '#d1d5db',
  perfectDot: '#16a34a',
};

export const LABEL_H = 12; // minimum vertical spacing between end labels
const PRIZE_RANKS = 5;
const TIE_SPREAD = 0.36; // ±0.18 of a row height
const DRAW_ORDER = { pack: 0, perfect: 1, last: 2, top: 3 };

const r2 = v => Math.round(v * 100) / 100;

export function plotHeight(chartH) {
  return chartH - MARGIN.top - MARGIN.bottom;
}

// weekIdx: 0-based. A single week is centered so its labels sit mid-plot.
export function xAt(weekIdx, weeks) {
  if (weeks <= 1) return MARGIN.left + PLOT_W / 2;
  return MARGIN.left + (weekIdx / (weeks - 1)) * PLOT_W;
}

// rank: 1-based, rank 1 at the top (the defining property of a bump chart).
export function yAt(rank, maxRank, chartH = CHART_H) {
  return MARGIN.top + ((rank - 1) / Math.max(1, maxRank - 1)) * plotHeight(chartH);
}

export function surname(name) {
  const parts = String(name || '').trim().split(/\s+/);
  return parts[parts.length - 1] || '';
}

// Rank delta versus the previous week: positive = climbed. null on week 1.
export function movement(ranks, weekIdx) {
  if (weekIdx <= 0 || !ranks || ranks.length <= weekIdx) return null;
  return ranks[weekIdx - 1] - ranks[weekIdx];
}

// Monotone cubic interpolation (Fritsch–Carlson): smooth, no overshoot, so a
// player is never drawn briefly holding a rank they never held.
export function curvePath(points) {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M ${r2(points[0].x)} ${r2(points[0].y)}`;
  if (n === 2) return `M ${r2(points[0].x)} ${r2(points[0].y)} L ${r2(points[1].x)} ${r2(points[1].y)}`;

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const dx = [];
  const m = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(xs[i + 1] - xs[i]);
    m.push((ys[i + 1] - ys[i]) / dx[i]);
  }

  const tangents = new Array(n);
  tangents[0] = m[0];
  tangents[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) {
      tangents[i] = 0; // local extremum — flatten to prevent overshoot
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      tangents[i] = (w1 + w2) / (w1 / m[i - 1] + w2 / m[i]);
    }
  }

  let d = `M ${r2(xs[0])} ${r2(ys[0])}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i];
    const c1x = xs[i] + h / 3;
    const c1y = ys[i] + (tangents[i] * h) / 3;
    const c2x = xs[i + 1] - h / 3;
    const c2y = ys[i + 1] - (tangents[i + 1] * h) / 3;
    d += ` C ${r2(c1x)} ${r2(c1y)}, ${r2(c2x)} ${r2(c2y)}, ${r2(xs[i + 1])} ${r2(ys[i + 1])}`;
  }
  return d;
}

// Players sharing a rank in a week are fanned out vertically (in row-height
// units) so their lines don't collapse into one stroke. `group` is the list of
// ids sharing that rank, sorted by id so the split is stable across renders.
export function tieOffset(group, playerId) {
  if (!group || group.length < 2) return 0;
  const idx = group.indexOf(playerId);
  if (idx < 0) return 0;
  const t = (idx - (group.length - 1) / 2) / Math.max(1, group.length - 1);
  return t * TIE_SPREAD;
}

// Category from the FINAL week's rank. Last place is the highest rank value
// actually present in the final week (ties can leave gaps), which is also how
// the backend decides who splits the last-place payout.
export function catOf(player, lastRank) {
  const final = player.ranks[player.ranks.length - 1];
  if (final === lastRank) return 'last';
  if (final <= PRIZE_RANKS) return 'top';
  if (player.perfect && player.perfect.length > 0) return 'perfect';
  return 'pack';
}

// Greedy collision resolution for the end-label column: push labels down to
// keep LABEL_H spacing, then push the stack back up from the bottom if it
// overflowed the plot. Mutates and returns the array (sorted by yIdeal).
export function resolveLabels(labels, maxY) {
  labels.sort((a, b) => a.yIdeal - b.yIdeal);
  let lastY = -Infinity;
  for (const label of labels) {
    label.y = Math.max(label.yIdeal, lastY + LABEL_H);
    lastY = label.y;
  }
  if (lastY > maxY) {
    let pushY = maxY;
    for (let i = labels.length - 1; i >= 0; i--) {
      labels[i].y = Math.min(labels[i].y, pushY);
      pushY = labels[i].y - LABEL_H;
    }
  }
  return labels;
}

// Everything the chart needs to render, derived once from the API response.
export function buildRaceModel(data, { chartH = CHART_H } = {}) {
  const weeks = Array.isArray(data?.weeks) ? data.weeks : [];
  const WEEKS = weeks.length;
  const plotH = plotHeight(chartH);
  const players = (Array.isArray(data?.players) ? data.players : [])
    .filter(p => p && p.id != null && Array.isArray(p.ranks) && p.ranks.length === WEEKS && WEEKS > 0);

  const empty = {
    WEEKS, chartH, plotH, MAX_RANK: 1, lastRank: 1, rowH: 0,
    weekTicks: [], rankTicks: [], cutoffY: null, bandY: null,
    players: [], labels: [], byId: {},
  };
  if (WEEKS === 0 || players.length === 0) return empty;

  const MAX_RANK = Math.max(1, ...players.flatMap(p => p.ranks));
  const lastRank = Math.max(...players.map(p => p.ranks[WEEKS - 1]));
  const rowH = MAX_RANK > 1 ? plotH / (MAX_RANK - 1) : 40;
  const y = rank => yAt(rank, MAX_RANK, chartH);

  // Tie groups per week: rank -> ids sharing it (sorted by id, stable).
  const tieGroups = weeks.map((_, w) => {
    const groups = {};
    players.forEach(p => {
      const rank = p.ranks[w];
      if (!groups[rank]) groups[rank] = [];
      groups[rank].push(p.id);
    });
    Object.values(groups).forEach(g => g.sort((a, b) => String(a).localeCompare(String(b))));
    return groups;
  });

  // Colors: top-5 by final rank (leader always TOP_COLORS[0]; tied players get
  // the next colors in the list), last place red, 3-0 achievers slate, rest gray.
  const withCat = players.map(p => ({ ...p, cat: catOf(p, lastRank), finalRank: p.ranks[WEEKS - 1] }));
  const topOrder = withCat
    .filter(p => p.cat === 'top')
    .sort((a, b) => a.finalRank - b.finalRank || String(a.name).localeCompare(String(b.name)))
    .map(p => p.id);
  const colorOf = p => {
    if (p.cat === 'last') return COLORS.last;
    if (p.cat === 'top') return TOP_COLORS[topOrder.indexOf(p.id) % TOP_COLORS.length];
    if (p.cat === 'perfect') return COLORS.perfect;
    return COLORS.pack;
  };

  const modelPlayers = withCat
    .map(p => {
      const points = p.ranks.map((rank, w) => ({
        x: r2(xAt(w, WEEKS)),
        y: r2(y(rank) + tieOffset(tieGroups[w][rank], p.id) * rowH),
        w,
        rank,
      }));
      return {
        id: p.id,
        name: p.name,
        surname: surname(p.name),
        ranks: p.ranks,
        rec: p.rec,
        perfect: Array.isArray(p.perfect) ? p.perfect : [],
        finalRank: p.finalRank,
        cat: p.cat,
        featured: p.cat === 'top' || p.cat === 'last',
        color: colorOf(p),
        points,
        path: curvePath(points),
      };
    })
    .sort((a, b) => DRAW_ORDER[a.cat] - DRAW_ORDER[b.cat] || b.finalRank - a.finalRank);

  const labelX = r2(xAt(WEEKS - 1, WEEKS) + 8);
  const labels = resolveLabels(
    modelPlayers.map(p => ({
      id: p.id,
      x: labelX,
      yIdeal: p.points[WEEKS - 1].y,
      rank: p.finalRank,
      name: p.surname,
      color: p.color,
      featured: p.featured,
    })),
    MARGIN.top + plotH + 8,
  ).map(l => ({ ...l, y: r2(l.y), leader: Math.abs(l.y - l.yIdeal) > 2 }));

  const step = WEEKS > 14 ? 2 : 1;
  const weekTicks = [];
  for (let w = 1; w <= WEEKS; w++) {
    if (w === 1 || w === WEEKS || w % step === 0) weekTicks.push({ week: w, x: r2(xAt(w - 1, WEEKS)) });
  }
  const rankTicks = [...new Set([1, 10, 20, 30, MAX_RANK].filter(r => r >= 1 && r <= MAX_RANK))]
    .map(rank => ({ rank, y: r2(y(rank)) }));

  const byId = {};
  modelPlayers.forEach(p => { byId[p.id] = p; });

  return {
    WEEKS,
    chartH,
    plotH,
    MAX_RANK,
    lastRank,
    rowH,
    weekTicks,
    rankTicks,
    cutoffY: MAX_RANK > PRIZE_RANKS ? r2(y(PRIZE_RANKS) + rowH / 2) : null,
    bandY: r2(y(lastRank)),
    players: modelPlayers,
    labels,
    byId,
  };
}
