/**
 * Ensures a Venmo handle starts with an @ symbol
 * @param {string} venmoHandle - The Venmo handle to format
 * @returns {string} The formatted Venmo handle with @ prefix
 */
export function formatVenmoHandle(venmoHandle) {
  if (!venmoHandle || typeof venmoHandle !== 'string') {
    return '';
  }
  
  const trimmed = venmoHandle.trim();
  if (!trimmed) {
    return '';
  }
  
  // If it already starts with @, return as is
  if (trimmed.startsWith('@')) {
    return trimmed;
  }
  
  // Otherwise, add @ prefix
  return `@${trimmed}`;
}
