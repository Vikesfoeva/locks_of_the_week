// A season key is either a plain year (2025) or 'YYYY_suffix' ('2026_preseason').

// '2026_preseason' -> '2026 Preseason'; plain years render as-is.
export function formatSeasonLabel(seasonKey) {
  if (seasonKey === null || seasonKey === undefined || seasonKey === '') return '';
  const s = String(seasonKey);
  const match = s.match(/^(\d{4})_(.+)$/);
  if (!match) return s;
  const suffix = match[2]
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return `${match[1]} ${suffix}`;
}

// 2025 -> 2025, '2026_preseason' -> 2026 (parseInt stops at the first non-digit)
export function seasonBaseYear(seasonKey) {
  return parseInt(seasonKey, 10);
}
