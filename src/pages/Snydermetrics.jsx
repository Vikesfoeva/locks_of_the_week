import React, { useState, useEffect } from 'react';
import { ChartBarIcon } from '@heroicons/react/24/outline';

const Snydermetrics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState('ytd');
  const [availableWeeks, setAvailableWeeks] = useState([]);

  useEffect(() => {
    fetchSnydermetrics();
  }, [selectedWeek]);

  const fetchSnydermetrics = async () => {
    try {
      setLoading(true);
      const url = selectedWeek === 'ytd' 
        ? '/api/snydermetrics' 
        : `/api/snydermetrics?week=${encodeURIComponent(selectedWeek)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch Snydermetrics');
      const result = await response.json();
      setData(result);
      if (result.availableWeeks) {
        setAvailableWeeks(result.availableWeeks);
      }
    } catch (err) {
      console.error('Error fetching Snydermetrics:', err);
      setError('Failed to load Snydermetrics data');
    } finally {
      setLoading(false);
    }
  };

  const formatWeekName = (weekName) => {
    if (weekName === 'ytd') return 'Year to Date';
    // Convert odds_2024_09_14 to "Week of Sep 14, 2024"
    const match = weekName.match(/odds_(\d{4})_(\d{2})_(\d{2})/);
    if (match) {
      const [, year, month, day] = match;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return `Week of ${date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      })}`;
    }
    return weekName;
  };

  const renderWeekSelector = () => {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Filter by Week</h3>
          <div className="flex items-center space-x-4">
            <label htmlFor="week-select" className="text-sm font-medium text-gray-700">
              Select Week:
            </label>
            <select
              id="week-select"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="ytd">Year to Date</option>
              {availableWeeks.map(week => (
                <option key={week} value={week}>
                  {formatWeekName(week)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {selectedWeek !== 'ytd' && (
          <div className="mt-2 text-sm text-gray-600">
            Showing statistics for: <span className="font-medium">{formatWeekName(selectedWeek)}</span>
          </div>
        )}
      </div>
    );
  };

  const renderConsolidatedTable = () => {
    if (!data || !data.data) return null;

    const categories = ['O', 'U', 'Line (H)', 'Line (A)', 'Fav', 'Dog', 'Fav (H)', 'Dog (H)', 'Fav (A)', 'Dog (A)'];

    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
          SNYDERMETRICS - {selectedWeek === 'ytd' ? 'YEAR TO DATE' : formatWeekName(selectedWeek).toUpperCase()}
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead className="bg-blue-50">
              <tr>
                <th className="border border-gray-300 px-2 py-2 text-left text-sm font-semibold text-gray-900"></th>
                <th colSpan="4" className="border border-gray-300 px-2 py-2 text-center text-sm font-semibold text-gray-900">CFB</th>
                <th colSpan="4" className="border border-gray-300 px-2 py-2 text-center text-sm font-semibold text-gray-900">NFL</th>
                <th colSpan="4" className="border border-gray-300 px-2 py-2 text-center text-sm font-semibold text-gray-900">TOTALS</th>
              </tr>
              <tr>
                <th className="border border-gray-300 px-2 py-2 text-left text-sm font-semibold text-gray-900"></th>
                <th className="border border-gray-300 px-2 py-2 text-center text-sm font-semibold text-gray-900">W</th>
                <th className="border border-gray-300 px-2 py-2 text-center text-sm font-semibold text-gray-900">L</th>
                <th className="border border-gray-300 px-2 py-2 text-center text-sm font-semibold text-gray-900">T</th>
                <th className="border border-gray-300 px-2 py-2 text-center text-sm font-semibold text-gray-900">%</th>
                <th className="border border-gray-300 px-2 py-2 text-center text-sm font-semibold text-gray-900">W</th>
                <th className="border border-gray-300 px-2 py-2 text-center text-sm font-semibold text-gray-900">L</th>
                <th className="border border-gray-300 px-2 py-2 text-center text-sm font-semibold text-gray-900">T</th>
                <th className="border border-gray-300 px-2 py-2 text-center text-sm font-semibold text-gray-900">%</th>
                <th className="border border-gray-300 px-2 py-2 text-center text-sm font-semibold text-gray-900">W</th>
                <th className="border border-gray-300 px-2 py-2 text-center text-sm font-semibold text-gray-900">L</th>
                <th className="border border-gray-300 px-2 py-2 text-center text-sm font-semibold text-gray-900">T</th>
                <th className="border border-gray-300 px-2 py-2 text-center text-sm font-semibold text-gray-900">%</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(category => {
                const categoryData = data.data[category];
                if (!categoryData) return null;

                const getPercentageColor = (percentage) => {
                  return percentage >= 60 ? 'text-green-600' : 
                         percentage >= 50 ? 'text-yellow-600' : 'text-red-600';
                };

                return (
                  <tr key={category} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-2 py-2 text-sm font-medium text-gray-900">
                      {category}
                    </td>
                    {/* CFB */}
                    <td className="border border-gray-300 px-2 py-2 text-center text-sm text-gray-900">
                      {categoryData.cfb.W}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center text-sm text-gray-900">
                      {categoryData.cfb.L}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center text-sm text-gray-900">
                      {categoryData.cfb.T}
                    </td>
                    <td className={`border border-gray-300 px-2 py-2 text-center text-sm font-semibold ${getPercentageColor(categoryData.cfb.percentage)}`}>
                      {categoryData.cfb.total > 0 ? `${categoryData.cfb.percentage}%` : '#DIV/0'}
                    </td>
                    {/* NFL */}
                    <td className="border border-gray-300 px-2 py-2 text-center text-sm text-gray-900">
                      {categoryData.nfl.W}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center text-sm text-gray-900">
                      {categoryData.nfl.L}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center text-sm text-gray-900">
                      {categoryData.nfl.T}
                    </td>
                    <td className={`border border-gray-300 px-2 py-2 text-center text-sm font-semibold ${getPercentageColor(categoryData.nfl.percentage)}`}>
                      {categoryData.nfl.total > 0 ? `${categoryData.nfl.percentage}%` : '#DIV/0'}
                    </td>
                    {/* TOTALS */}
                    <td className="border border-gray-300 px-2 py-2 text-center text-sm text-gray-900">
                      {categoryData.totals.W}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center text-sm text-gray-900">
                      {categoryData.totals.L}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center text-sm text-gray-900">
                      {categoryData.totals.T}
                    </td>
                    <td className={`border border-gray-300 px-2 py-2 text-center text-sm font-semibold ${getPercentageColor(categoryData.totals.percentage)}`}>
                      {categoryData.totals.total > 0 ? `${categoryData.totals.percentage}%` : '#DIV/0'}
                    </td>
                  </tr>
                );
              })}
              {/* Total row */}
              <tr className="bg-gray-100 font-semibold">
                <td className="border border-gray-300 px-2 py-2 text-sm text-gray-900">Total</td>
                {/* CFB True Totals */}
                <td className="border border-gray-300 px-2 py-2 text-center text-sm text-gray-900">
                  {data.trueTotals?.cfb?.W || 0}
                </td>
                <td className="border border-gray-300 px-2 py-2 text-center text-sm text-gray-900">
                  {data.trueTotals?.cfb?.L || 0}
                </td>
                <td className="border border-gray-300 px-2 py-2 text-center text-sm text-gray-900">
                  {data.trueTotals?.cfb?.T || 0}
                </td>
                <td className="border border-gray-300 px-2 py-2 text-center text-sm font-semibold text-gray-900">
                  {data.trueTotals?.cfb?.total > 0 ? `${data.trueTotals.cfb.percentage}%` : '#DIV/0'}
                </td>
                {/* NFL True Totals */}
                <td className="border border-gray-300 px-2 py-2 text-center text-sm text-gray-900">
                  {data.trueTotals?.nfl?.W || 0}
                </td>
                <td className="border border-gray-300 px-2 py-2 text-center text-sm text-gray-900">
                  {data.trueTotals?.nfl?.L || 0}
                </td>
                <td className="border border-gray-300 px-2 py-2 text-center text-sm text-gray-900">
                  {data.trueTotals?.nfl?.T || 0}
                </td>
                <td className="border border-gray-300 px-2 py-2 text-center text-sm font-semibold text-gray-900">
                  {data.trueTotals?.nfl?.total > 0 ? `${data.trueTotals.nfl.percentage}%` : '#DIV/0'}
                </td>
                {/* Overall True Totals */}
                <td className="border border-gray-300 px-2 py-2 text-center text-sm text-gray-900">
                  {data.trueTotals?.totals?.W || 0}
                </td>
                <td className="border border-gray-300 px-2 py-2 text-center text-sm text-gray-900">
                  {data.trueTotals?.totals?.L || 0}
                </td>
                <td className="border border-gray-300 px-2 py-2 text-center text-sm text-gray-900">
                  {data.trueTotals?.totals?.T || 0}
                </td>
                <td className="border border-gray-300 px-2 py-2 text-center text-sm font-semibold text-gray-900">
                  {data.trueTotals?.totals?.total > 0 ? `${data.trueTotals.totals.percentage}%` : '#DIV/0'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400 animate-spin" />
          <h2 className="mt-4 text-lg font-medium text-gray-900">Loading Snydermetrics...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ChartBarIcon className="mx-auto h-12 w-12 text-red-400" />
          <h2 className="mt-4 text-lg font-medium text-red-900">{error}</h2>
          <button
            onClick={fetchSnydermetrics}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center">
              <ChartBarIcon className="h-8 w-8 text-blue-600 mr-3" />
              Snydermetrics
            </h1>
            <p className="mt-2 text-gray-600">
              Advanced betting analytics and performance metrics
            </p>
          </div>
        </div>

        {/* Week Selector */}
        {renderWeekSelector()}

        {/* Legend */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Legend</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div className="space-y-2">
              <p><span className="font-semibold">O:</span> Over picks</p>
              <p><span className="font-semibold">U:</span> Under picks</p>
              <p><span className="font-semibold">Line (H):</span> Home team spread picks</p>
              <p><span className="font-semibold">Line (A):</span> Away team spread picks</p>
            </div>
            <div className="space-y-2">
              <p><span className="font-semibold">Fav:</span> Favorite picks (negative spread)</p>
              <p><span className="font-semibold">Dog:</span> Underdog picks (positive spread)</p>
              <p><span className="font-semibold">Fav (H):</span> Home favorite picks</p>
              <p><span className="font-semibold">Dog (H):</span> Home underdog picks</p>
            </div>
            <div className="space-y-2">
              <p><span className="font-semibold">Fav (A):</span> Away favorite picks</p>
              <p><span className="font-semibold">Dog (A):</span> Away underdog picks</p>
              <p className="text-gray-600 italic">Note: Some games may count in multiple categories</p>
            </div>
          </div>
        </div>

        {/* Consolidated Stats Table */}
        {data && renderConsolidatedTable()}

        {/* Footer Info */}
        <div className="bg-blue-50 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">About Snydermetrics</h3>
          <p className="text-blue-800 text-sm">
            Snydermetrics provides comprehensive analysis of locking patterns and success rates.
            The data is calculated based on all user picks.
            {data && (
              <span className="block mt-2">
                {selectedWeek === 'ytd' ? (
                  <>Data includes {data.availableWeeks?.length || 0} weeks of picks for the current season.</>
                ) : (
                  <>Showing data for {formatWeekName(selectedWeek)} only.</>
                )}
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Snydermetrics;
