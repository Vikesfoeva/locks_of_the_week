import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProfileSetupGuard({ children }) {
  const { currentUser, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  console.log('[ProfileSetupGuard] Component rendered with:', { 
    loading, 
    hasCurrentUser: !!currentUser,
    currentUserId: currentUser?._id,
    venmoHandle: currentUser?.venmoHandle,
    venmo: currentUser?.venmo,
    pathname: location.pathname
  });

  useEffect(() => {
    // Only check after auth is loaded and user is authenticated
    if (!loading && currentUser) {
      console.log('[ProfileSetupGuard] Current user:', currentUser);
      console.log('[ProfileSetupGuard] venmoHandle:', currentUser.venmoHandle);
      console.log('[ProfileSetupGuard] venmo:', currentUser.venmo);
      console.log('[ProfileSetupGuard] _id:', currentUser._id);
      
      // Check if user has a Venmo ID (check both possible field names)
      // Also handle edge cases like dashes, empty strings, or null values
      const venmoHandle = currentUser.venmoHandle ? currentUser.venmoHandle.trim() : '';
      const venmo = currentUser.venmo ? currentUser.venmo.trim() : '';
      
      const hasVenmoId = (venmoHandle !== '' && venmoHandle !== '-' && venmoHandle !== 'null') || 
                        (venmo !== '' && venmo !== '-' && venmo !== 'null');
      
      console.log('[ProfileSetupGuard] Has Venmo ID:', hasVenmoId);
      
      // Only redirect if user has a database ID (meaning they're fully loaded) and no Venmo ID
      // Also check that we're not already on the setup page to prevent infinite redirects
      if (currentUser._id && !hasVenmoId && location.pathname !== '/setup-profile') {
        console.log('[ProfileSetupGuard] Redirecting to setup-profile');
        // Redirect to setup page if no Venmo ID
        navigate('/setup-profile');
      }
    }
  }, [currentUser, loading, navigate]);

  // Don't render children if we're redirecting to setup
  if (!loading && currentUser && currentUser._id && 
      (!currentUser.venmoHandle || currentUser.venmoHandle.trim() === '') &&
      (!currentUser.venmo || currentUser.venmo.trim() === '')) {
    console.log('[ProfileSetupGuard] Not rendering children - redirecting to setup');
    return null;
  }

  return children;
}
