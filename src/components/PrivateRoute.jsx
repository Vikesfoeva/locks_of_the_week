import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// PrivateRoute.jsx
export default function PrivateRoute({ children, adminOnly = false }) {
  const { currentUser, loading } = useAuth();

  console.log('[PrivateRoute] Checking route. Loading:', loading, 'CurrentUser:', currentUser);

  if (loading) {
    console.log('[PrivateRoute] Still loading, returning null.');
    return null; 
  }

  if (!currentUser) {
    console.log('[PrivateRoute] No currentUser, redirecting to /login.');
    return <Navigate to="/login" />;
  }

  console.log('[PrivateRoute] User found:', currentUser?.email, 'Role property:', currentUser?.role);

  if (adminOnly && currentUser.role !== 'admin') { // This check needs currentUser.role to be 'admin'
    console.log('[PrivateRoute] Admin only route, but user is not admin. Redirecting to /.');
    return <Navigate to="/" />;
  }

  console.log('[PrivateRoute] Access granted.');
  return children;
}