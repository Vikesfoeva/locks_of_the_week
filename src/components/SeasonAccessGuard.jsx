import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { formatSeasonLabel, isActiveSeasonParticipant } from '../utils/seasonFormatter';

// Full-page block for users who are Inactive or have no membership entry
// ("Not set") for the active season. Fails open in every ambiguous state —
// profile not loaded, admins, no active season — so a backend hiccup or an
// unset active_year never locks the league out.
export default function SeasonAccessGuard({ children }) {
  const { currentUser, loading, activeSeason } = useAuth();

  if (loading) return null;
  if (!currentUser || !currentUser._id) return children;
  if (currentUser.role === 'admin') return children;
  if (activeSeason === null || activeSeason === undefined) return children;

  if (!isActiveSeasonParticipant(currentUser, activeSeason)) {
    return <SeasonBlocked seasonKey={activeSeason} />;
  }

  return children;
}

function SeasonBlocked({ seasonKey }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  // fixed + z-50 so it covers the Layout nav bar (its menus are z-10) and
  // works the same on /setup-profile, which renders outside Layout.
  return (
    <div className="fixed inset-0 z-50 bg-gray-100 flex items-center justify-center px-4">
      <div className="card max-w-md w-full text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          You&apos;re not active for the {formatSeasonLabel(seasonKey)} season
        </h1>
        <p className="text-gray-600 mb-6">
          Contact an admin to be re-activated, then refresh this page.
        </p>
        <button type="button" className="btn btn-primary" onClick={handleSignOut}>
          Sign Out
        </button>
      </div>
    </div>
  );
}
