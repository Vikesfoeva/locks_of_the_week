import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// PrivateRoute.jsx
export default function PrivateRoute({ children, adminOnly = false }) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return null; 
  }

  if (!currentUser) {

    return <Navigate to="/login" />;
  }



  if (adminOnly && currentUser.role !== 'admin') { // This check needs currentUser.role to be 'admin'
    return <Navigate to="/" />;
  }


  return children;
}