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

// Mirrors seasonMembersQuery() in backend/server.js: only an explicit
// active: false for the season excludes a user; a missing entry counts as a
// member so past seasons (2024 has no entries at all) never change.
export function isSeasonMember(user, seasonKey) {
  const entry = user?.seasons?.[String(seasonKey)];
  return !(entry && entry.active === false);
}

// Stricter than isSeasonMember(): requires an explicit active: true entry.
// Gates app access for the ACTIVE season only (SeasonAccessGuard) — do NOT
// use it for standings/awards history, which keeps the missing-entry-counts-
// as-member rule above. Mirrored server-side by the POST /api/picks
// membership gate in backend/server.js.
export function isActiveSeasonParticipant(user, seasonKey) {
  return user?.seasons?.[String(seasonKey)]?.active === true;
}
