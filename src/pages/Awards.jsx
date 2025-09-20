import React, { useState, useEffect, useRef, useMemo } from 'react';
import { QuestionMarkCircleIcon, ArrowDownTrayIcon, ChevronUpIcon, ChevronDownIcon, FunnelIcon as FunnelIconOutline } from '@heroicons/react/24/outline';
import { FunnelIcon as FunnelIconSolid } from '@heroicons/react/24/solid';
import * as XLSX from 'xlsx';
import { useFilterModal, createFilterButtonProps, createFilterModalProps } from '../hooks/useFilterModal';
import FilterModal from '../components/FilterModal';

const Awards = () => {
  const [awards, setAwards] = useState([]);
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [activeYear, setActiveYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedAwards, setExpandedAwards] = useState(new Set());
  const [weekComplete, setWeekComplete] = useState(true);
  const [weekMessage, setWeekMessage] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [awardsSummary, setAwardsSummary] = useState({});
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const isInitialMount = useRef(true);

  // Sorting state - using established pattern
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Filter modals - using established pattern
  const playerModal = useFilterModal();
  const flopsModal = useFilterModal();
  const loneWolfModal = useFilterModal();
  const packModal = useFilterModal();
  const lockModal = useFilterModal();
  const closeCallModal = useFilterModal();
  const soreLoserModal = useFilterModal();
  const biggestLoserModal = useFilterModal();
  const boldestFavoriteModal = useFilterModal();
  const bigDawgModal = useFilterModal();
  const bigKahunaModal = useFilterModal();
  const tinkerbellModal = useFilterModal();
  const unusualLockModal = useFilterModal();
  const totalGoodModal = useFilterModal();
  const totalBadModal = useFilterModal();
  const diffModal = useFilterModal();
  const totalModal = useFilterModal();

  // Award modal mapping
  const awardModals = {
    'Flop of the Week': flopsModal,
    'Lone Wolf': loneWolfModal,
    'Pack': packModal,
    'Lock of the Week': lockModal,
    'Close Call': closeCallModal,
    'Sore Loser': soreLoserModal,
    'Biggest Loser': biggestLoserModal,
    'Boldest Favorite': boldestFavoriteModal,
    'Big Dawg': bigDawgModal,
    'Big Kahuna': bigKahunaModal,
    'Tinkerbell': tinkerbellModal,
    'Unusual Lock': unusualLockModal,
    'Total Good': totalGoodModal,
    'Total Bad': totalBadModal,
    'Diff': diffModal,
    'Total': totalModal,
  };

  // Manual award selection state
  const [showManualAwardSelector, setShowManualAwardSelector] = useState(false);
  const [winningPicks, setWinningPicks] = useState([]);
  const [selectedPickId, setSelectedPickId] = useState('');
  const [existingManualAward, setExistingManualAward] = useState(null);
  const [manualAwardLoading, setManualAwardLoading] = useState(false);
  const [manualAwardError, setManualAwardError] = useState(null);

  // Award definitions for reference
  const awardDefinitions = {
    'Flop of the Week': 'An incorrect lock that resulted in the most losses for the group',
    'Lone Wolf': 'A correct lock by one person that was countered incorrectly by two or more others',
    'Pack': 'An incorrect lock made by multiple people that was countered correctly by a Lone Wolf',
    'Lock of the Week': 'A correct lock that was furthest from being incorrect',
    'Close Call': 'A correct lock that was closest to being incorrect',
    'Sore Loser': 'An incorrect lock that was closest to being correct',
    'Biggest Loser': 'An incorrect lock that was furthest from being correct',
    'Boldest Favorite': 'A correct lock with the largest spread by a favorite',
    'Big Dawg': 'A correct lock with the largest spread by an underdog',
    'Big Kahuna': 'A correct lock with the highest over total',
    'Tinkerbell': 'A correct lock with the smallest under total',
    'Unusual Lock': 'A correct lock with some originality and creativity',
    'Total Good': 'Total count of positive awards (Lone Wolf, Lock of the Week, Close Call, Boldest Favorite, Big Dawg, Big Kahuna, Tinkerbell, Unusual Lock)',
    'Total Bad': 'Total count of negative awards (Flop of the Week, Pack, Sore Loser, Biggest Loser)',
    'Diff': 'Difference between Total Good and Total Bad awards (Good - Bad)',
    'Total': 'Total count of all awards received'
  };

  // Award abbreviations for compact table display
  const awardAbbreviations = {
    'Flop of the Week': 'Flop',
    'Lone Wolf': 'Wolf',
    'Pack': 'Pack',
    'Lock of the Week': 'Lock',
    'Close Call': 'Close',
    'Sore Loser': 'Sore L',
    'Biggest Loser': 'Big L',
    'Boldest Favorite': 'Fav',
    'Big Dawg': 'Dawg',
    'Big Kahuna': 'Kahuna',
    'Tinkerbell': 'Tinkerbell',
    'Unusual Lock': 'Unusual',
    'Total Good': 'Good',
    'Total Bad': 'Bad',
    'Diff': 'Diff',
    'Total': 'Total'
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch active year
        const yearResponse = await fetch('/api/active-year');
        if (!yearResponse.ok) throw new Error('Failed to fetch active year');
        const yearData = await yearResponse.json();
        const year = yearData.year || new Date().getFullYear();
        setActiveYear(year);

        // 2. Fetch available weeks (reuse standings logic)
        const standingsResponse = await fetch(`/api/standings?year=${year}`);
        if (!standingsResponse.ok) throw new Error('Failed to fetch standings');
        const standingsData = await standingsResponse.json();
        
        setAvailableWeeks(standingsData.availableWeeks);

        // 3. Find the most recently completed week (has awards calculated)
        let mostRecentCompletedWeek = null;
        if (standingsData.availableWeeks && standingsData.availableWeeks.length > 0) {
          // Check weeks from most recent to oldest
          for (let i = standingsData.availableWeeks.length - 1; i >= 0; i--) {
            const weekToCheck = standingsData.availableWeeks[i];
            try {
              const awardsResponse = await fetch(`/api/awards?year=${year}&week=${weekToCheck}`);
              if (awardsResponse.ok) {
                const awardsData = await awardsResponse.json();
                // If week is complete and has awards, use this week
                if (awardsData.weekComplete !== false && Object.keys(awardsData.awards || {}).length > 0) {
                  mostRecentCompletedWeek = weekToCheck;
                  setAwards(awardsData.awards || {});
                  setWeekComplete(awardsData.weekComplete !== false);
                  setWeekMessage(awardsData.message || '');
                  break;
                }
              }
            } catch (weekErr) {
              // Continue to next week if this one fails
              console.warn(`Failed to check awards for week ${weekToCheck}:`, weekErr);
              continue;
            }
          }
          
          // If no completed weeks found, default to most recent week
          if (!mostRecentCompletedWeek) {
            mostRecentCompletedWeek = standingsData.availableWeeks[standingsData.availableWeeks.length - 1];
            // Still try to fetch awards for UI feedback
            await fetchAwards(year, mostRecentCompletedWeek);
          }
        }

        setSelectedWeek(mostRecentCompletedWeek);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []); // Empty dependency array means this runs only once on mount

  // This effect handles updates when the user selects a new week
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return; // Skip the first run to avoid double-fetching
    }
    if (!selectedWeek || !activeYear) return;

    fetchAwards(activeYear, selectedWeek);
  }, [selectedWeek]); // Re-run only when selectedWeek changes

  const fetchAwards = async (year, week) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/awards?year=${year}&week=${week}`);
      if (!response.ok) {
        throw new Error('Failed to fetch awards');
      }
      const data = await response.json();
      setAwards(data.awards || {});
      setWeekComplete(data.weekComplete !== false); // Default to true if not specified
      setWeekMessage(data.message || '');
      // Reset expanded state when new data loads
      setExpandedAwards(new Set());
    } catch (err) {
      console.error('Error fetching awards:', err);
      setAwards({});
      setWeekComplete(true);
      setWeekMessage('');
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAwardsSummary = async (year) => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const response = await fetch(`/api/awards-summary?year=${year}`);
      if (!response.ok) {
        throw new Error('Failed to fetch awards summary');
      }
      const data = await response.json();
      setAwardsSummary(data.awardsSummary || {});
    } catch (err) {
      console.error('Error fetching awards summary:', err);
      setAwardsSummary({});
      setSummaryError(err.message);
    } finally {
      setSummaryLoading(false);
    }
  };

  const toggleExpanded = (awardName) => {
    setExpandedAwards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(awardName)) {
        newSet.delete(awardName);
      } else {
        newSet.add(awardName);
      }
      return newSet;
    });
  };

  const toggleSummaryView = () => {
    if (!showSummary && activeYear) {
      fetchAwardsSummary(activeYear);
    }
    setShowSummary(!showSummary);
  };

  const exportToExcel = () => {
    // Prepare data for Excel export
    const excelData = [];
    
    // Add header row
    excelData.push([
      'Award',
      'Winner',
      'Game',
      'Lock',
      'Final Score',
      'Margin',
      'Additional Info'
    ]);
    
    // Add data for each award
    Object.entries(awards).forEach(([awardName, gameGroups]) => {
      if (gameGroups.length > 0) {
        gameGroups.forEach(gameGroup => {
          gameGroup.winners.forEach(winner => {
            const row = [
              awardName,
              winner.userName,
              gameGroup.gameDetails, // Game (e.g., "UTAH @ UCLA")
              gameGroup.pickDetails, // Pick (e.g., "UTAH -6.5")
              gameGroup.score || '',
              gameGroup.margin !== undefined && awardName !== 'Unusual Lock' ? gameGroup.margin.toFixed(1) : '',
              // Additional info based on award type
              gameGroup.count !== undefined ? `${gameGroup.count} people made this lock` :
              gameGroup.againstCount !== undefined ? `Against ${gameGroup.againstCount} others${gameGroup.packMembers ? ` (Pack: ${gameGroup.packMembers.map(p => p.userName).join(', ')})` : ''}` :
              gameGroup.spread !== undefined ? `Spread: ${gameGroup.spread > 0 ? '+' : ''}${gameGroup.spread}` :
              gameGroup.total !== undefined ? `Total: ${gameGroup.total}` : ''
            ];
            excelData.push(row);
          });
        });
      } else {
        // Add row for awards with no winners
        excelData.push([awardName, 'No winners this week', '', '', '', '', '']);
      }
    });
    
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(excelData);
    
    // Set column widths
    worksheet['!cols'] = [
      { width: 20 }, // Award
      { width: 20 }, // Winner
      { width: 25 }, // Game
      { width: 15 }, // Pick
      { width: 25 }, // Final Score
      { width: 10 }, // Margin
      { width: 30 }  // Additional Info
    ];
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Awards');
    
    // Generate filename with week and year
    const weekParts = selectedWeek.split('_');
    const date = new Date(weekParts[1], weekParts[2] - 1, weekParts[3]);
    const formattedDate = `${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear()}`;
    const filename = `Awards_Week_${formattedDate}.xlsx`;
    
    // Download file
    XLSX.writeFile(workbook, filename);
  };

  // Manual award functions
  const fetchWinningPicks = async () => {
    if (!activeYear || !selectedWeek) return;
    
    setManualAwardLoading(true);
    setManualAwardError(null);
    try {
      const response = await fetch(`/api/manual-awards/winning-picks?year=${activeYear}&week=${selectedWeek}`);
      if (!response.ok) throw new Error('Failed to fetch winning picks');
      
      const data = await response.json();
      setWinningPicks(data.picks || []);
      setExistingManualAward(data.existingAward);
      setSelectedPickId(data.existingAward?.pickId || '');
    } catch (err) {
      console.error('Error fetching winning locks:', err);
      setManualAwardError(err.message);
    } finally {
      setManualAwardLoading(false);
    }
  };

  const handleManualAwardToggle = () => {
    if (!showManualAwardSelector) {
      fetchWinningPicks();
    }
    setShowManualAwardSelector(!showManualAwardSelector);
  };

  const handleManualAwardSubmit = async () => {
    if (!selectedPickId || !activeYear || !selectedWeek) return;
    
    setManualAwardLoading(true);
    setManualAwardError(null);
    try {
      const response = await fetch('/api/manual-awards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: activeYear,
          week: selectedWeek,
          pickId: selectedPickId
        })
      });
      
      if (!response.ok) throw new Error('Failed to set manual award');
      
      // Refresh awards data
      await fetchAwards(activeYear, selectedWeek);
      setShowManualAwardSelector(false);
    } catch (err) {
      console.error('Error setting manual award:', err);
      setManualAwardError(err.message);
    } finally {
      setManualAwardLoading(false);
    }
  };

  const handleManualAwardDelete = async () => {
    if (!activeYear || !selectedWeek) return;
    
    setManualAwardLoading(true);
    setManualAwardError(null);
    try {
      const response = await fetch(`/api/manual-awards?year=${activeYear}&week=${selectedWeek}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to delete manual award');
      
      // Refresh awards data
      await fetchAwards(activeYear, selectedWeek);
      setExistingManualAward(null);
      setSelectedPickId('');
    } catch (err) {
      console.error('Error deleting manual award:', err);
      setManualAwardError(err.message);
    } finally {
      setManualAwardLoading(false);
    }
  };

  // Sorting is now handled directly via setSortConfig calls in the UI components

  // Reset filters function - following established pattern
  const handleResetFilters = () => {
    // Reset all modal system filters
    playerModal.resetFilter();
    Object.values(awardModals).forEach(modal => modal.resetFilter());
    // Reset sort configuration to default
    setSortConfig({ key: null, direction: 'asc' });
  };

  // Helper to get unique values for filters
  const getUniqueValues = (key) => {
    if (Object.keys(awardsSummary).length === 0) return [];
    
    if (key === 'player') {
      return Object.keys(Object.values(awardsSummary)[0] || {}).sort();
    } else if (awardsSummary[key]) {
      // For award columns, return available counts (including 0)
      const counts = Object.values(awardsSummary[key] || {});
      const uniqueCounts = Array.from(new Set(counts)).sort((a, b) => a - b);
      return uniqueCounts.map(String);
    }
    return [];
  };

  // Get filtered data using modal filters
  const getFilteredData = useMemo(() => {
    if (Object.keys(awardsSummary).length === 0) return [];
    
    let users = Object.keys(Object.values(awardsSummary)[0] || {});
    
    // Apply player filter
    if (playerModal.appliedItems.length > 0) {
      users = users.filter(userName => playerModal.appliedItems.includes(userName));
    }
    
    // Apply award filters
    Object.entries(awardModals).forEach(([awardName, modal]) => {
      if (modal.appliedItems.length > 0 && awardsSummary[awardName]) {
        users = users.filter(userName => {
          const count = awardsSummary[awardName][userName] || 0;
          return modal.appliedItems.includes(String(count));
        });
      }
    });
    
    return users;
  }, [awardsSummary, playerModal.appliedItems, ...Object.values(awardModals).map(m => m.appliedItems)]);

  // Get sorted data
  const getSortedData = useMemo(() => {
    let users = [...getFilteredData];
    
    if (sortConfig.key) {
      users.sort((a, b) => {
        let aVal, bVal;
        
        if (sortConfig.key === 'player') {
          aVal = a.toLowerCase();
          bVal = b.toLowerCase();
        } else {
          // Award column
          aVal = awardsSummary[sortConfig.key]?.[a] || 0;
          bVal = awardsSummary[sortConfig.key]?.[b] || 0;
        }
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      // Default alphabetical sort by player name
      users.sort();
    }
    
    return users;
  }, [getFilteredData, sortConfig, awardsSummary]);

  if (loading) return <div className="text-center p-8">Loading awards...</div>;
  if (error) return <div className="text-center p-8 text-red-500">Error: {error}</div>;

  return (
    <div className="mx-auto px-1 py-2 md:px-2 md:py-3">
      {/* Title and Description */}
      <div className="text-center mb-3 md:mb-4">
        <h1 className="text-xl md:text-3xl font-bold text-gray-800 mb-1">
          Weekly Awards - {activeYear}
        </h1>
        <p className="text-sm md:text-base text-gray-600">
          Recognition for standout locks and performances
        </p>
      </div>

      {/* Controls Row */}
      <div className="flex flex-row items-center justify-between mb-3 md:mb-4 gap-2 md:gap-4">
        {/* Left side - Info, Toggle, and Export */}
        <div className="flex items-center gap-2 md:gap-4">
          <span className="text-sm md:text-base text-gray-700 font-medium">
            Admin Only
          </span>
          <button
            onClick={toggleSummaryView}
            className={`flex items-center gap-1 md:gap-2 px-2 py-1 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors duration-200 ${
              showSummary 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            <span className="hidden md:inline">{showSummary ? 'Show Weekly View' : 'Show Summary Table'}</span>
            <span className="md:hidden">{showSummary ? 'Weekly' : 'Summary'}</span>
          </button>
          {Object.keys(awards).length > 0 && weekComplete && !showSummary && (
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1 md:gap-2 bg-green-600 hover:bg-green-700 text-white px-2 py-1 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors duration-200"
            >
              <ArrowDownTrayIcon className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden md:inline">Export to Excel</span>
              <span className="md:hidden">Export</span>
            </button>
          )}
          {weekComplete && !showSummary && (
            <button
              onClick={handleManualAwardToggle}
              className={`flex items-center gap-1 md:gap-2 px-2 py-1 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors duration-200 ${
                showManualAwardSelector 
                  ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                  : 'bg-purple-100 hover:bg-purple-200 text-purple-700'
              }`}
            >
              <span className="hidden md:inline">{showManualAwardSelector ? 'Hide' : 'Select'} Unusual Lock</span>
              <span className="md:hidden">{showManualAwardSelector ? 'Hide' : 'Select'}</span>
            </button>
          )}
        </div>

        {/* Right side - Week Selector */}
        {!showSummary && (
          <div className="flex items-center gap-1 md:gap-3 flex-shrink-0">
            <div className="flex items-center gap-1">
              <label htmlFor="week-select" className="text-xs md:text-sm font-medium text-gray-700 whitespace-nowrap">Week:</label>
            <select
              id="week-select"
              value={selectedWeek || ''}
              onChange={e => setSelectedWeek(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1 md:px-3 md:py-2 text-xs md:text-sm bg-white hover:border-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors duration-200 min-w-0"
              disabled={availableWeeks.length === 0}
            >
              {(() => {
                const reversedWeeks = availableWeeks.slice().reverse();
                return reversedWeeks.map((week, reversedIndex) => {
                  const parts = week.split('_');
                  // parts[1] is year, parts[2] is month, parts[3] is day
                  const date = new Date(parts[1], parts[2] - 1, parts[3]);
                  const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(2)}`;
                  const originalIndex = availableWeeks.length - 1 - reversedIndex;
                  const isCurrentWeek = reversedIndex === 0; // First item after reverse is most recent
                  
                  return [
                    // Add separator after current week
                    reversedIndex === 1 && <option key="separator" disabled style={{ borderTop: '1px solid #d1d5db', color: '#6b7280', fontStyle: 'italic' }}>— Previous Weeks —</option>,
                    <option 
                      key={week} 
                      value={week}
                      style={{
                        color: isCurrentWeek ? '#111827' : '#6b7280',
                        fontWeight: isCurrentWeek ? '600' : '400'
                      }}
                    >
                      Week {originalIndex + 1} - {formattedDate}
                    </option>
                  ].filter(Boolean);
                }).flat();
              })()}
            </select>
          </div>
        </div>
        )}
      </div>

      {/* Manual Award Selector */}
      {showManualAwardSelector && !showSummary && (
        <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h3 className="text-lg font-bold text-purple-800 mb-3">Select Unusual Lock Winner</h3>
          
          {manualAwardError && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {manualAwardError}
            </div>
          )}
          
          {manualAwardLoading ? (
            <div className="text-center p-4">Loading winning locks...</div>
          ) : winningPicks.length === 0 ? (
            <div className="text-center p-4 text-gray-500">No winning locks available for manual award selection.</div>
          ) : (
            <div className="space-y-3">
              {existingManualAward && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="text-green-800">
                      <strong>Current Selection:</strong> {existingManualAward.winnerName}
                    </div>
                    <button
                      onClick={handleManualAwardDelete}
                      disabled={manualAwardLoading}
                      className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded transition-colors duration-200 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 gap-2">
                <label className="text-sm font-medium text-purple-700">
                  Select a winning lock for the Unusual Lock award:
                </label>
                <select
                  value={selectedPickId}
                  onChange={(e) => setSelectedPickId(e.target.value)}
                  className="border border-purple-300 rounded-lg px-3 py-2 text-sm bg-white hover:border-purple-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-colors duration-200"
                  disabled={manualAwardLoading}
                >
                  <option value="">Choose a winning lock...</option>
                  {winningPicks
                    .sort((a, b) => a.userName.localeCompare(b.userName))
                    .map((pick) => (
                      <option key={pick.pickId} value={pick.pickId}>
                        {pick.userName} - {pick.gameDetails} - {pick.pickDetails}
                      </option>
                    ))}
                </select>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={handleManualAwardSubmit}
                  disabled={!selectedPickId || manualAwardLoading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {existingManualAward ? 'Update Selection' : 'Set Unusual Lock'}
                </button>
                <button
                  onClick={() => setShowManualAwardSelector(false)}
                  className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 text-sm font-medium rounded-lg transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      {showSummary ? (
        /* Awards Summary Table */
        <div className="shadow-lg rounded-xl border border-gray-200 overflow-hidden w-full">
          {summaryLoading ? (
            <div className="text-center p-8">Loading awards summary...</div>
          ) : summaryError ? (
            <div className="text-center p-8 text-red-500">Error: {summaryError}</div>
          ) : Object.keys(awardsSummary).length === 0 ? (
            <div className="text-center p-6">
              <div className="text-gray-500 mb-3">No awards summary data available.</div>
            </div>
          ) : (
            <>
              <div className="p-3 pb-0 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-800">Awards Summary - Total Wins by Player</h3>
                <button
                  onClick={handleResetFilters}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-lg transition-colors duration-200 flex items-center gap-1"
                >
                  Reset Filters
                </button>
              </div>
              <div className="w-full max-h-[70vh] overflow-y-auto overflow-x-hidden">
                <table className="w-full table-fixed border-collapse">
                  <thead className="sticky top-0 z-20">
                    <tr className="bg-gray-50">
                      <th className="px-2 py-2 text-left text-sm font-semibold text-gray-700 border-b border-gray-200 sticky left-0 bg-gray-50 z-30 w-auto">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-gray-800 text-xs md:text-sm uppercase tracking-wide">Player</span>
                          <div className="flex flex-col ml-1">
                            <ChevronUpIcon
                              className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'player' && sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}
                              onClick={e => { e.stopPropagation(); setSortConfig({ key: 'player', direction: 'asc' }); }}
                            />
                            <ChevronDownIcon
                              className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'player' && sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}
                              onClick={e => { e.stopPropagation(); setSortConfig({ key: 'player', direction: 'desc' }); }}
                            />
                          </div>
                          <button
                            {...createFilterButtonProps(playerModal, getUniqueValues('player'), () => {
                              // No callback needed - modal handles everything
                            }, {
                              IconComponent: FunnelIconOutline,
                              IconComponentSolid: FunnelIconSolid,
                              className: "ml-1 p-1 rounded hover:bg-gray-200 transition-colors"
                            })}
                          />
                        </div>
                      </th>
                      {/* Individual Awards as columns */}
                      {Object.keys(awardsSummary).filter(awardName => 
                        !['Total Good', 'Total Bad', 'Diff', 'Total'].includes(awardName)
                      ).map(awardName => (
                        <th key={awardName} className="px-1 py-2 text-center text-sm font-semibold text-gray-700 border-b border-gray-200 w-auto min-w-[55px]">
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <div className="flex items-center gap-1">
                              <span className="font-bold text-gray-800 text-xs leading-tight text-center">{awardAbbreviations[awardName] || awardName}</span>
                              <div className="flex flex-col">
                                <ChevronUpIcon
                                  className={`h-3 w-3 cursor-pointer ${sortConfig.key === awardName && sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}
                                  onClick={e => { e.stopPropagation(); setSortConfig({ key: awardName, direction: 'asc' }); }}
                                />
                                <ChevronDownIcon
                                  className={`h-3 w-3 cursor-pointer ${sortConfig.key === awardName && sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}
                                  onClick={e => { e.stopPropagation(); setSortConfig({ key: awardName, direction: 'desc' }); }}
                                />
                              </div>
                              <button
                                {...createFilterButtonProps(awardModals[awardName], getUniqueValues(awardName), () => {
                                  // No callback needed - modal handles everything
                                }, {
                                  IconComponent: FunnelIconOutline,
                                  IconComponentSolid: FunnelIconSolid,
                                  className: "p-1 rounded hover:bg-gray-200 transition-colors"
                                })}
                              />
                            </div>
                            {awardDefinitions[awardName] && (
                              <div className="group relative">
                                <QuestionMarkCircleIcon className="h-3 w-3 text-gray-400 hover:text-gray-600 cursor-help flex-shrink-0" />
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-4 py-3 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-normal w-72 z-[9999] pointer-events-none">
                                  <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                                  <div className="font-semibold mb-2">{awardName}</div>
                                  <div>{awardDefinitions[awardName]}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        </th>
                      ))}
                      {/* Summary columns with different styling */}
                      {['Total Good', 'Total Bad', 'Diff', 'Total'].map(awardName => (
                        <th key={awardName} className={`px-1 py-2 text-center text-sm font-semibold border-b border-gray-200 w-auto min-w-[55px] ${
                          awardName === 'Diff' ? 'text-purple-700 bg-purple-50' : 
                          awardName === 'Total' ? 'text-indigo-700 bg-indigo-50' :
                          awardName === 'Total Good' ? 'text-green-700 bg-green-50' :
                          'text-red-700 bg-red-50'
                        }`}>
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <div className="flex items-center gap-1">
                              <span className="font-bold text-xs leading-tight text-center">{awardAbbreviations[awardName] || awardName}</span>
                              <div className="flex flex-col">
                                <ChevronUpIcon
                                  className={`h-3 w-3 cursor-pointer ${sortConfig.key === awardName && sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}
                                  onClick={e => { e.stopPropagation(); setSortConfig({ key: awardName, direction: 'asc' }); }}
                                />
                                <ChevronDownIcon
                                  className={`h-3 w-3 cursor-pointer ${sortConfig.key === awardName && sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}
                                  onClick={e => { e.stopPropagation(); setSortConfig({ key: awardName, direction: 'desc' }); }}
                                />
                              </div>
                              <button
                                {...createFilterButtonProps(awardModals[awardName], getUniqueValues(awardName), () => {
                                  // No callback needed - modal handles everything
                                }, {
                                  IconComponent: FunnelIconOutline,
                                  IconComponentSolid: FunnelIconSolid,
                                  className: "p-1 rounded hover:bg-gray-200 transition-colors"
                                })}
                              />
                            </div>
                            {awardDefinitions[awardName] && (
                              <div className="group relative">
                                <QuestionMarkCircleIcon className="h-3 w-3 text-gray-400 hover:text-gray-600 cursor-help flex-shrink-0" />
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-4 py-3 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-normal w-72 z-[9999] pointer-events-none">
                                  <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                                  <div className="font-semibold mb-2">{awardName}</div>
                                  <div>{awardDefinitions[awardName]}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Get all unique user names and create rows */}
                    {Object.keys(awardsSummary).length > 0 && 
                      getSortedData.map((userName, userIndex) => (
                        <tr key={userName} className={userIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-2 py-2 text-sm font-medium text-gray-900 border-b border-gray-200 sticky left-0 bg-inherit z-10">
                            {userName}
                          </td>
                          {/* Individual award cells */}
                          {Object.keys(awardsSummary).filter(awardName => 
                            !['Total Good', 'Total Bad', 'Diff', 'Total'].includes(awardName)
                          ).map(awardName => (
                            <td key={awardName} className="px-1 py-2 text-center text-sm text-gray-700 border-b border-gray-200">
                              <span className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-medium ${
                                (awardsSummary[awardName][userName] || 0) > 0 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-gray-100 text-gray-500'
                              }`}>
                                {awardsSummary[awardName][userName] || 0}
                              </span>
                            </td>
                          ))}
                          {/* Summary columns with special styling */}
                          {['Total Good', 'Total Bad', 'Diff', 'Total'].map(awardName => {
                            const value = awardsSummary[awardName][userName] || 0;
                            return (
                              <td key={awardName} className={`px-1 py-2 text-center text-sm border-b border-gray-200 ${
                                awardName === 'Diff' ? 'bg-purple-50' : 
                                awardName === 'Total' ? 'bg-indigo-50' :
                                awardName === 'Total Good' ? 'bg-green-50' :
                                'bg-red-50'
                              }`}>
                                <span className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-bold ${
                                  awardName === 'Diff' 
                                    ? value > 0 ? 'bg-green-100 text-green-800' : value < 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-500'
                                    : awardName === 'Total Good'
                                    ? value > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                                    : awardName === 'Total Bad'
                                    ? value > 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-500'
                                    : value > 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  {awardName === 'Diff' && value > 0 ? `+${value}` : value}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      ) : (
        /* Weekly Awards View */
        Object.keys(awards).length === 0 ? (
          <div className="text-center p-6">
            <div className="text-gray-500 mb-3">
              {error ? error : weekMessage || 'No awards data available for this week.'}
            </div>
            <div className="text-sm text-gray-400">
              {!weekComplete ? (
                <>
                  Awards will be calculated after all games in the week have concluded.<br/>
                  The week ends at 4am Tuesday Eastern Time.
                </>
              ) : (
                'Awards are calculated after games are completed and results are processed.'
              )}
            </div>
          </div>
        ) : (
        <div className="shadow-lg rounded-xl border border-gray-200 overflow-x-auto">
          {/* Awards Cards Layout - Better for mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
            {Object.entries(awardDefinitions)
              .filter(([awardName]) => awardName !== 'Pack' && !['Total Good', 'Total Bad', 'Diff', 'Total'].includes(awardName)) // Remove Pack and summary columns from cards
              .sort(([awardNameA], [awardNameB]) => {
                // Define the order - Unusual Lock towards the end
                const order = [
                  'Flop of the Week',
                  'Lone Wolf',
                  'Lock of the Week',
                  'Close Call',
                  'Sore Loser',
                  'Biggest Loser',
                  'Boldest Favorite',
                  'Big Dawg',
                  'Big Kahuna',
                  'Tinkerbell',
                  'Unusual Lock'
                ];
                const indexA = order.indexOf(awardNameA);
                const indexB = order.indexOf(awardNameB);
                return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
              })
              .map(([awardName, definition], index) => {
              const awardWinners = awards[awardName] || [];
              const isExpanded = expandedAwards.has(awardName);
              const displayedWinners = isExpanded ? awardWinners : awardWinners.slice(0, 3);
              const hasMore = awardWinners.length > 3;
              
              // Determine tooltip positioning based on grid position
              const totalAwards = Object.keys(awardDefinitions).length;
              const isLeftColumn = index % 3 === 0; // First column in 3-column grid
              const isRightColumn = index % 3 === 2; // Third column in 3-column grid
              
              return (
                <div key={awardName} className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-gray-800 text-sm">{awardName}</h3>
                    <div className="group relative">
                      <QuestionMarkCircleIcon className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" />
                      <div className={`absolute top-full mt-2 px-4 py-3 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-normal w-72 z-[9999] pointer-events-none ${
                        isLeftColumn ? 'left-0' : isRightColumn ? 'right-0' : 'left-1/2 transform -translate-x-1/2'
                      }`}>
                        <div className={`absolute -top-1 w-2 h-2 bg-gray-900 rotate-45 ${
                          isLeftColumn ? 'left-6' : isRightColumn ? 'right-6' : 'left-1/2 transform -translate-x-1/2'
                        }`}></div>
                        {definition}
                      </div>
                    </div>
                  </div>
                  
                  {awardWinners.length === 0 ? (
                    <div className="text-gray-400 text-sm italic">No winners this week</div>
                  ) : (
                    <div className="space-y-1.5">
                      {displayedWinners.map((gameGroup, index) => (
                        <div key={index} className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-md p-2.5 border border-purple-200">
                          <div className="font-semibold text-purple-800 text-sm mb-1.5">
                            {gameGroup.gameDetails} - {gameGroup.pickDetails}
                          </div>
                          {gameGroup.score && (
                            <div className="text-xs text-gray-700 mt-1 font-medium">
                              Final Score: {gameGroup.score}
                            </div>
                          )}
                          {gameGroup.margin !== undefined && awardName !== 'Unusual Lock' && (
                            <div className="text-xs text-blue-600 mt-1">
                              Margin: {gameGroup.margin.toFixed(1)}
                            </div>
                          )}
                          {gameGroup.spread !== undefined && (
                            <div className="text-xs text-blue-600 mt-1">
                              Spread: {gameGroup.spread > 0 ? '+' : ''}{gameGroup.spread}
                            </div>
                          )}
                          {gameGroup.total !== undefined && (
                            <div className="text-xs text-blue-600 mt-1">
                              Total: {gameGroup.total}
                            </div>
                          )}
                          {gameGroup.count !== undefined && (
                            <div className="text-xs text-red-600 mt-1">
                              {gameGroup.count} people made this lock
                            </div>
                          )}
                          {gameGroup.againstCount !== undefined && (
                            <div className="text-xs text-green-600 mt-1">
                              Against {gameGroup.againstCount} others
                            </div>
                          )}
                          
                          {/* Winners List */}
                          <div className="mt-1.5 pt-1.5 border-t border-purple-200">
                            <div className="text-xs text-gray-600 mb-1">Winners:</div>
                            <div className="flex flex-wrap gap-1">
                              {gameGroup.winners
                                .sort((a, b) => a.userName.localeCompare(b.userName))
                                .map((winner, winnerIndex) => (
                                  <span key={winnerIndex} className="inline-block bg-white px-1.5 py-0.5 rounded text-xs text-purple-700 border border-purple-300">
                                    {winner.userName}
                                  </span>
                                ))}
                            </div>
                          </div>

                          {/* Pack Members - Show after winners */}
                          {gameGroup.packMembers && gameGroup.packMembers.length > 0 && (
                            <div className="mt-1.5 pt-1.5 border-t border-red-200">
                              <div className="text-xs text-gray-600 mb-1">Pack:</div>
                              <div className="flex flex-wrap gap-1">
                                {gameGroup.packMembers
                                  .sort((a, b) => a.userName.localeCompare(b.userName))
                                  .map((packMember, packIndex) => (
                                    <span key={packIndex} className="inline-block bg-red-50 px-1.5 py-0.5 rounded text-xs text-red-700 border border-red-200" title={packMember.pickDetails}>
                                      {packMember.userName}
                                    </span>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {hasMore && (
                        <button
                          onClick={() => toggleExpanded(awardName)}
                          className="w-full mt-1.5 px-2 py-1.5 text-xs text-gray-600 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 rounded-md border border-gray-200 transition-colors duration-200 flex items-center justify-center gap-1"
                        >
                          {isExpanded ? (
                            <>
                              Show Less
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            </>
                          ) : (
                            <>
                              Show {awardWinners.length - 3} More
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        )
      )}

      {/* Filter Modals */}
      <FilterModal
        {...createFilterModalProps(playerModal, getUniqueValues('player'), (appliedItems) => {
          // appliedItems are already set by the modal, no additional action needed
        }, {
          title: 'Filter Players',
          placement: 'bottom-start',
        })}
      />
      
      {Object.entries(awardModals).map(([awardName, modal]) => (
        <FilterModal
          key={awardName}
          {...createFilterModalProps(modal, getUniqueValues(awardName), (appliedItems) => {
            // appliedItems are already set by the modal, no additional action needed
          }, {
            title: `Filter ${awardName}`,
            placement: 'bottom-start',
          })}
        />
      ))}
    </div>
  );
};

export default Awards;
