import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function PrivateRoute({ children, adminOnly = false }) {
  const { currentUser, loading } = useAuth()

  if (loading) {
    return null // or a spinner if you want
  }

  if (!currentUser) {
    return <Navigate to="/login" />
  }

  // Add admin check here once we implement user roles
  if (adminOnly && !currentUser.isAdmin) {
    return <Navigate to="/" />
  }

  return children
} 