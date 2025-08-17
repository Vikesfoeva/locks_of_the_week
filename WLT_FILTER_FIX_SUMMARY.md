# W/L/T Filter Fix Summary

## Problem Identified
The W/L/T (Win/Loss/Tie) filter was hiding rows for games that haven't finished yet (In Progress, Unstarted games) even when no filter was applied. Users would click the filter and see fewer rows than expected.

## Root Cause
The issue was in the `getUniqueValues` function:

1. **Games without results** had `pick.result` as `null` or `undefined`
2. **Filter logic expected** these to be represented as `'--'` 
3. **getUniqueValues function** was converting `null`/`undefined` to empty string (`''`)
4. **Empty strings were filtered out** with `.filter(Boolean)`
5. **Result**: Games without results weren't included in the filter options, so they were hidden when any filter was applied

## Solution Applied
Updated the `getUniqueValues` function to handle the `result` field specially:

### Before:
```javascript
const getUniqueValues = (picks, key, subKey = null) => {
  const values = picks.map(pick => {
    // ... other logic
    value = pick[key];  // This would be null/undefined for unfinished games
    return value || '';  // Converts to empty string
  });
  return Array.from(new Set(values)).filter(Boolean).sort();  // Filters out empty strings
};
```

### After:
```javascript
const getUniqueValues = (picks, key, subKey = null) => {
  const values = picks.map(pick => {
    // ... other logic
    if (key === 'result') {
      // Special handling for result field - include '--' for games without results
      value = pick.result || '--';
    } else {
      value = pick[key];
    }
    return value || '';
  });
  return Array.from(new Set(values)).filter(Boolean).sort();
};
```

## Result
- ✅ **Unfinished games now appear** in the W/L/T filter options as `'--'`
- ✅ **All rows remain visible** when opening the filter (before applying any selections)
- ✅ **Users can filter by result status** including "no result yet" (`--`)
- ✅ **Consistent behavior** with other filters that show all options by default

## Expected Filter Options
The W/L/T filter will now show:
- **W** - Win
- **L** - Loss  
- **T** - Tie
- **--** - No result yet (In Progress, Unstarted, etc.)

## Testing
To verify the fix:
1. Navigate to WeeklyLocks page
2. Click the W/L/T filter button
3. Confirm that all rows remain visible when the filter opens
4. Confirm that `'--'` appears as an option for games without results
5. Test filtering by each option to ensure proper behavior
