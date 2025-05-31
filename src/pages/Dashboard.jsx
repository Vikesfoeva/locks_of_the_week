import { useAuth } from '../contexts/AuthContext'

export default function Dashboard() {
  const { currentUser } = useAuth()

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900">Welcome to Locks of the Week</h2>
        <p className="mt-2 text-gray-600">
          Make your picks for this week's games and compete with your friends!
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900">Make Picks</h3>
          <p className="mt-2 text-sm text-gray-600">
            Select your three picks for this week's games.
          </p>
          <div className="mt-4">
            <a
              href="/picks"
              className="btn btn-primary"
            >
              Make Picks
            </a>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-medium text-gray-900">Weekly Picks</h3>
          <p className="mt-2 text-sm text-gray-600">
            View everyone's picks for the current week.
          </p>
          <div className="mt-4">
            <a
              href="/weekly"
              className="btn btn-primary"
            >
              View Picks
            </a>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-medium text-gray-900">Standings</h3>
          <p className="mt-2 text-sm text-gray-600">
            Check the current standings and your ranking.
          </p>
          <div className="mt-4">
            <a
              href="/standings"
              className="btn btn-primary"
            >
              View Standings
            </a>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-medium text-gray-900">Your Profile</h3>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <div className="mt-1 text-sm text-gray-900">{currentUser?.email}</div>
          </div>
        </div>
      </div>
    </div>
  )
} 