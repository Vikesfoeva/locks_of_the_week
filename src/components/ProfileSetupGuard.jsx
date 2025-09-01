import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProfileSetupGuard({ children }) {
  const { currentUser, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Only check after auth is loaded and user is authenticated
    if (!loading && currentUser) {
      
      // Check if user has a Venmo ID (check both possible field names)
      // Also handle edge cases like dashes, empty strings, or null values
      const venmoHandle = currentUser.venmoHandle ? currentUser.venmoHandle.trim() : '';
      const venmo = currentUser.venmo ? currentUser.venmo.trim() : '';
      
      const hasVenmoId = (venmoHandle !== '' && venmoHandle !== '-' && venmoHandle !== 'null') || 
                        (venmo !== '' && venmo !== '-' && venmo !== 'null');
      
      // Check if user has a cell phone number
      const cellPhone = currentUser.cellPhone ? currentUser.cellPhone.trim() : '';
      const hasCellPhone = (cellPhone !== '' && cellPhone !== '-' && cellPhone !== 'null');
      
      // Only redirect if user has a database ID (meaning they're fully loaded) and missing required fields
      // Also check that we're not already on the setup page to prevent infinite redirects
      if (currentUser._id && (!hasVenmoId || !hasCellPhone) && location.pathname !== '/setup-profile') {
        // Redirect to setup page if missing required fields
        navigate('/setup-profile');
      }
    }
  }, [currentUser, loading, navigate]);

  // Don't render children if we're redirecting to setup
  if (!loading && currentUser && currentUser._id) {
    const venmoHandle = currentUser.venmoHandle ? currentUser.venmoHandle.trim() : '';
    const venmo = currentUser.venmo ? currentUser.venmo.trim() : '';
    
    const hasVenmoId = (venmoHandle !== '' && venmoHandle !== '-' && venmoHandle !== 'null') || 
                      (venmo !== '' && venmo !== '-' && venmo !== 'null');
    
    const cellPhone = currentUser.cellPhone ? currentUser.cellPhone.trim() : '';
    const hasCellPhone = (cellPhone !== '' && cellPhone !== '-' && cellPhone !== 'null');
    
    if (!hasVenmoId || !hasCellPhone) {
      return null;
    }
  }

  return children;
}
