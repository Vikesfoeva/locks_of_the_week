import React, { useState, useEffect, useRef } from 'react';
import { QuestionMarkCircleIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';

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
  const isInitialMount = useRef(true);

  // Award definitions for reference
  const awardDefinitions = {
    'Flop of the Week': 'An incorrect pick that resulted in the most losses for the group',
    'Lone Wolf': 'A correct pick by one person that was countered incorrectly by two or more others',
    'Lock of the Week': 'A correct pick that was furthest from being incorrect',
    'Close Call': 'A correct pick that was closest to being incorrect',
    'Sore Loser': 'An incorrect pick that was closest to being correct',
    'Biggest Loser': 'An incorrect pick that was furthest from being correct',
    'Boldest Favorite': 'A correct pick with the largest spread by a favorite',
    'Big Dawg': 'A correct pick with the largest spread by an underdog',
    'Big Kahuna': 'A correct pick with the highest over total',
    'Tinkerbell': 'A correct pick with the smallest under total'
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
        setSelectedWeek(standingsData.selectedWeek);

        // 3. Fetch awards for the latest week
        if (standingsData.selectedWeek) {
          await fetchAwards(year, standingsData.selectedWeek);
        }
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

  const exportToExcel = () => {
    // Prepare data for Excel export
    const excelData = [];
    
    // Add header row
    excelData.push([
      'Award',
      'Winner',
      'Game',
      'Pick',
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
              gameGroup.margin !== undefined ? (gameGroup.margin > 0 ? '+' : '') + gameGroup.margin.toFixed(1) : '',
              // Additional info based on award type
              gameGroup.count !== undefined ? `${gameGroup.count} people made this pick` :
              gameGroup.againstCount !== undefined ? `Against ${gameGroup.againstCount} others` :
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

  if (loading) return <div className="text-center p-8">Loading awards...</div>;
  if (error) return <div className="text-center p-8 text-red-500">Error: {error}</div>;

  return (
    <div className="max-w-7xl mx-auto px-2 py-2 md:px-4 md:py-3">
      {/* Title and Description */}
      <div className="text-center mb-3 md:mb-4">
        <h1 className="text-xl md:text-3xl font-bold text-gray-800 mb-1">
          Weekly Awards - {activeYear}
        </h1>
        <p className="text-sm md:text-base text-gray-600">
          Recognition for standout picks and performances
        </p>
      </div>

      {/* Controls Row */}
      <div className="flex flex-row items-center justify-between mb-3 md:mb-4 gap-2 md:gap-4">
        {/* Left side - Info and Export */}
        <div className="flex items-center gap-2 md:gap-4">
          <span className="text-sm md:text-base text-gray-700 font-medium">
            Admin Only
          </span>
          {Object.keys(awards).length > 0 && weekComplete && (
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1 md:gap-2 bg-green-600 hover:bg-green-700 text-white px-2 py-1 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors duration-200"
            >
              <ArrowDownTrayIcon className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden md:inline">Export to Excel</span>
              <span className="md:hidden">Export</span>
            </button>
          )}
        </div>

        {/* Right side - Week Selector */}
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
      </div>

      {/* Awards Table */}
      {Object.keys(awards).length === 0 ? (
        <div className="text-center p-6">
          <div className="text-gray-500 mb-3">
            {error ? error : weekMessage || 'No awards data available for this week.'}
          </div>
          <div className="text-sm text-gray-400">
            {!weekComplete ? (
              <>
                Awards will be calculated after all games in the week have concluded.<br/>
                The week ends at midnight Monday Eastern Time.
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
            {Object.entries(awardDefinitions).map(([awardName, definition], index) => {
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
                          {gameGroup.margin !== undefined && (
                            <div className="text-xs text-blue-600 mt-1">
                              Margin: {gameGroup.margin > 0 ? '+' : ''}{gameGroup.margin.toFixed(1)}
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
                              {gameGroup.count} people made this pick
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
                              {gameGroup.winners.map((winner, winnerIndex) => (
                                <span key={winnerIndex} className="inline-block bg-white px-1.5 py-0.5 rounded text-xs text-purple-700 border border-purple-300">
                                  {winner.userName}
                                </span>
                              ))}
                            </div>
                          </div>
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
      )}
    </div>
  );
};

export default Awards;
