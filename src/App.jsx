import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import ProfileSetupGuard from './components/ProfileSetupGuard'
import Login from './pages/Login'
import Register from './pages/Register'
import SetupProfile from './pages/SetupProfile'
import Dashboard from './pages/Dashboard'
import AdminDashboard from './pages/AdminDashboard'
import Layout from './components/Layout'
import Locks from './pages/Locks'
import WeeklyLocks from './pages/WeeklyLocks'
import UserSettings from './pages/UserSettings'
import Standings from './pages/Standings'
import Awards from './pages/Awards'
import Snydermetrics from './pages/Snydermetrics'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/setup-profile" element={
          <PrivateRoute>
            <SetupProfile />
          </PrivateRoute>
        } />
        <Route element={<Layout />}>
          <Route path="/" element={
            <PrivateRoute>
              <ProfileSetupGuard>
                <Dashboard />
              </ProfileSetupGuard>
            </PrivateRoute>
          } />
          <Route path="/admin" element={
            <PrivateRoute adminOnly>
              <ProfileSetupGuard>
                <AdminDashboard />
              </ProfileSetupGuard>
            </PrivateRoute>
          } />
          <Route path="/locks" element={
            <PrivateRoute>
              <ProfileSetupGuard>
                <Locks />
              </ProfileSetupGuard>
            </PrivateRoute>
          } />
          <Route path="/weekly" element={
            <PrivateRoute>
              <ProfileSetupGuard>
                <WeeklyLocks />
              </ProfileSetupGuard>
            </PrivateRoute>
          } />
          <Route path="/settings" element={
            <PrivateRoute>
              <ProfileSetupGuard>
                <UserSettings />
              </ProfileSetupGuard>
            </PrivateRoute>
          } />
          <Route path="/standings" element={
            <PrivateRoute>
              <ProfileSetupGuard>
                <Standings />
              </ProfileSetupGuard>
            </PrivateRoute>
          } />
          <Route path="/awards" element={
            <PrivateRoute adminOnly>
              <ProfileSetupGuard>
                <Awards />
              </ProfileSetupGuard>
            </PrivateRoute>
          } />
          <Route path="/snydermetrics" element={
            <PrivateRoute adminOnly>
              <ProfileSetupGuard>
                <Snydermetrics />
              </ProfileSetupGuard>
            </PrivateRoute>
          } />
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App 