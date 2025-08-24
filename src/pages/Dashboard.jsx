import { useAuth } from '../contexts/AuthContext'
import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_URL } from '../config'

export default function Dashboard() {
  const { currentUser } = useAuth()

  // Helper functions for formatting pick data
  const formatScore = (awayScore, homeScore, awayTeam, homeTeam) => {
    if (typeof awayScore === 'number' && typeof homeScore === 'number') {
      return `${awayTeam} ${awayScore} - ${homeScore} ${homeTeam}`;
    }
    return '--';
  };

  const formatStatus = (status) => {
    if (!status) return '--';
    if (status === 'scheduled') return 'Scheduled';
    if (status === 'final') return 'Final';
    if (status === 'in-progress') return 'In Progress';
    return status;
  };

  const formatResult = (result) => {
    if (!result || result === 'Pending') return '--';
    return result;
  };

  const formatPickDisplay = (pick) => {
    if (pick.pickType === 'spread') {
      return pick.pickSide;
    } else if (pick.pickType === 'total') {
      return pick.pickSide === 'OVER' ? 'Over' : 'Under';
    }
    return '--';
  };

  const formatLineValue = (line, pickType) => {
    if (typeof line === 'number') {
      if (pickType === 'spread') {
        return line > 0 ? `+${line}` : `${line}`;
      } else if (pickType === 'total') {
        return `${line}`;
      }
    }
    return '--';
  };
  const [dashboardData, setDashboardData] = useState({
    projectedWinners: [],
    currentWeekPicks: [],
    currentWeekTotal: 3,
    currentWeek: null,
    loading: true,
    error: null
  })
  const [announcement, setAnnouncement] = useState({
    message: '',
    active: false,
    loading: true,
    error: null
  })

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!currentUser) return

      try {
        setDashboardData(prev => ({ ...prev, loading: true, error: null }))

        // Get active year
        const activeYearRes = await axios.get(`${API_URL}/active-year`)
        const activeYear = activeYearRes.data.year

        if (!activeYear) {
          throw new Error('No active year configured')
        }

        // Get available collections (weeks) to find the most recent
        const collectionsRes = await axios.get(`${API_URL}/collections`)
        const collections = collectionsRes.data || []
        
        // Filter and sort collections for current year
        const currentYearCollections = collections
          .filter(name => name.includes(`odds_${activeYear}_`))
          .sort((a, b) => {
            // Sort by date (most recent first)
            const dateA = new Date(a.replace('odds_', '').replace(/_/g, '-'))
            const dateB = new Date(b.replace('odds_', '').replace(/_/g, '-'))
            return dateB - dateA
          })

        const currentWeek = currentYearCollections[0] || null

        let currentWeekPicks = []
        if (currentWeek) {
          // Get user's picks for the current week with game details
          const picksRes = await axios.get(
            `${API_URL}/picks?userId=${currentUser.uid}&collectionName=${currentWeek}&year=${activeYear}`
          )
          currentWeekPicks = Array.isArray(picksRes.data) ? picksRes.data : []
        }

        // Get standings to find projected winners
        const standingsRes = await axios.get(`${API_URL}/standings?year=${activeYear}`)
        const standings = standingsRes.data.standings || []
        
        // Find users with positive payouts (projected to win money)
        const projectedWinners = standings
          .filter(user => user.payout > 0)
          .sort((a, b) => b.payout - a.payout) // Sort by payout amount

        setDashboardData({
          projectedWinners,
          currentWeekPicks,
          currentWeekTotal: 3,
          currentWeek,
          loading: false,
          error: null
        })

      } catch (error) {
        console.error('Error fetching dashboard data:', error)
        setDashboardData(prev => ({
          ...prev,
          loading: false,
          error: error.message || 'Failed to load dashboard data'
        }))
      }
    }

    fetchDashboardData()
  }, [currentUser])

  // Fetch announcement
  useEffect(() => {
    const fetchAnnouncement = async () => {
      try {
        setAnnouncement(prev => ({ ...prev, loading: true, error: null }))
        const response = await axios.get(`${API_URL}/announcements`)
        setAnnouncement({
          message: response.data.message || '',
          active: response.data.active || false,
          loading: false,
          error: null
        })
      } catch (error) {
        console.error('Error fetching announcement:', error)
        setAnnouncement(prev => ({
          ...prev,
          loading: false,
          error: error.message || 'Failed to load announcement'
        }))
      }
    }

    fetchAnnouncement()
  }, [])

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900">Welcome to Locks of the Week</h2>
        <p className="mt-2 text-gray-600">
          Make your locks for this week's games and compete with your friends!
        </p>
        
        {/* Announcement Section */}
        {announcement.active && announcement.message && !announcement.loading && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-4 w-4 text-blue-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-2 flex-1">
                <h3 className="text-sm font-medium text-blue-800">Announcement</h3>
                <div className="mt-1 text-sm text-blue-700">
                  <div dangerouslySetInnerHTML={{ __html: announcement.message.replace(/\n/g, '<br />') }} />
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Discord Link */}
        <div className="mt-4 flex items-center">
          <button
            onClick={() => window.open('https://discord.com/channels/1083347386824396850/1146259510923628654', '_blank')}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Open in Discord
          </button>
        </div>
      </div>



      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Current Week Picks Status - Order 3 on mobile, default on desktop */}
        <div className="card order-3 sm:order-none">
          <h3 className="text-lg font-medium text-gray-900">This Week's Picks</h3>
          {dashboardData.loading ? (
            <div className="mt-2 text-sm text-gray-600">Loading...</div>
          ) : dashboardData.error ? (
            <div className="mt-2 text-sm text-red-600">Error loading data</div>
          ) : (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600">Picks made:</span>
                <span className={`text-lg font-semibold ${
                  dashboardData.currentWeekPicks.length === dashboardData.currentWeekTotal 
                    ? 'text-green-600' 
                    : 'text-orange-600'
                }`}>
                  {dashboardData.currentWeekPicks.length}/{dashboardData.currentWeekTotal}
                </span>
              </div>
              
              {dashboardData.currentWeekPicks.length === 0 ? (
                <p className="text-sm text-orange-600">
                  You haven't made any picks this week yet. <a href="/locks" className="underline">Pick your locks!</a>
                </p>
              ) : (
                <div className="space-y-2">
                  {dashboardData.currentWeekPicks.map((pick, index) => {
                    const game = pick.gameDetails;
                    return (
                      <div key={pick._id || index} className="bg-gray-50 rounded-md p-2 text-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">
                              {game?.away_team_abbrev || '--'} @ {game?.home_team_abbrev || '--'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {game?.league || '--'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600">
                            {formatScore(pick.awayScore, pick.homeScore, game?.away_team_abbrev, game?.home_team_abbrev)}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="font-medium text-blue-600">
                            {formatPickDisplay(pick)} {formatLineValue(pick.line, pick.pickType)}
                          </span>
                          <div className="text-xs">
                            <span className={`font-medium ${
                              pick.result === 'W' ? 'text-green-600' : 
                              pick.result === 'L' ? 'text-red-600' : 
                              'text-gray-500'
                            }`}>
                              {formatResult(pick.result)}
                            </span>
                            {pick.result && pick.result !== 'Pending' && (
                              <span className="text-gray-400 ml-1">• {formatStatus(pick.status)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {dashboardData.currentWeekPicks.length < dashboardData.currentWeekTotal && (
                    <p className="mt-3 text-sm text-orange-600">
                      You need to make {dashboardData.currentWeekTotal - dashboardData.currentWeekPicks.length} more pick{dashboardData.currentWeekTotal - dashboardData.currentWeekPicks.length !== 1 ? 's' : ''} this week!
                    </p>
                  )}
                  {dashboardData.currentWeekPicks.length === dashboardData.currentWeekTotal && (
                    <p className="mt-3 text-sm text-green-600">
                      All picks submitted for this week! 🎉
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Projected Season Winners - Order 4 on mobile, default on desktop */}
        <div className="card order-4 sm:order-none">
          <div className="flex items-center space-x-2 mb-2">
            <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900">Season Leaders</h3>
          </div>
          <p className="text-sm text-gray-600 mb-3">Current standings for the entire season</p>
          {dashboardData.loading ? (
            <div className="mt-2 text-sm text-gray-600">Loading...</div>
          ) : dashboardData.error ? (
            <div className="mt-2 text-sm text-red-600">Error loading data</div>
          ) : dashboardData.projectedWinners.length === 0 ? (
            <div className="mt-2 text-sm text-gray-600">No projected winners yet</div>
          ) : (
            <div className="mt-2 space-y-2">
              {(() => {
                // Find users in top 5 ranks, including ties
                const topUsers = [];
                const uniqueRanks = new Set();
                
                for (const winner of dashboardData.projectedWinners) {
                  if (winner.rank <= 5) {
                    topUsers.push(winner);
                    uniqueRanks.add(winner.rank);
                  }
                  // Stop if we have 5 unique ranks
                  if (uniqueRanks.size >= 5) break;
                }
                
                return topUsers.map((winner, index) => (
                  <div key={winner._id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">
                        #{winner.rank} {winner.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({winner.wins}-{winner.losses}-{winner.ties})
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-xs text-gray-500">
                        WB: {winner.gamesBack || '-'}
                      </span>
                      <span className="text-sm font-semibold text-green-600">
                        ${winner.payout}
                      </span>
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>

        {/* Quick Actions - Order 2 on mobile, default on desktop */}
        <div className="card order-2 sm:order-none">
          <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
          <div className="mt-4 space-y-3">
            <a
              href="/locks"
              className="block w-full btn btn-primary text-center"
            >
              Pick Locks
            </a>
            <a
              href="/weekly"
              className="block w-full btn btn-secondary text-center"
            >
              View Weekly Locks
            </a>
            <a
              href="/standings"
              className="block w-full btn btn-secondary text-center"
            >
              View Standings
            </a>
          </div>
        </div>
      </div>

      {/* Score Update Schedule */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Score Update Schedule</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div>
                <span className="font-semibold text-gray-800">Weekdays (Monday-Friday):</span>
                <p className="ml-3 mt-1">3 updates daily at 9:00 PM, 11:00 PM, and 2:00 AM (next day)</p>
              </div>
              <div>
                <span className="font-semibold text-gray-800">Weekends (Saturday-Sunday):</span>
                <p className="ml-3 mt-1">Hourly updates from 1:00 PM to 2:00 AM (next day) - 14 updates total</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
                <div className="flex items-center">
                  <svg className="w-4 h-4 text-blue-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-xs text-blue-700">
                    <span className="font-medium">Timezone:</span> America/New_York (Eastern Time)
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="text-xs text-gray-500 ml-4 flex-shrink-0 text-center">
            <svg className="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="space-y-1">
              <span className="block font-medium">3x Weekdays</span>
              <span className="block font-medium">14x Weekends</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 