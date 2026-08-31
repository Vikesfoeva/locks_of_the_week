import { Routes, Route } from 'react-router'
import { AuthProvider } from './contexts/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import ProfileSetupGuard from './components/ProfileSetupGuard'
import SeasonAccessGuard from './components/SeasonAccessGuard'
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
            <SeasonAccessGuard>
              <SetupProfile />
            </SeasonAccessGuard>
          </PrivateRoute>
        } />
        <Route element={<Layout />}>
          <Route path="/" element={
            <PrivateRoute>
              <SeasonAccessGuard>
                <ProfileSetupGuard>
                  <Dashboard />
                </ProfileSetupGuard>
              </SeasonAccessGuard>
            </PrivateRoute>
          } />
          <Route path="/admin" element={
            <PrivateRoute adminOnly>
              <SeasonAccessGuard>
                <ProfileSetupGuard>
                  <AdminDashboard />
                </ProfileSetupGuard>
              </SeasonAccessGuard>
            </PrivateRoute>
          } />
          <Route path="/locks" element={
            <PrivateRoute>
              <SeasonAccessGuard>
                <ProfileSetupGuard>
                  <Locks />
                </ProfileSetupGuard>
              </SeasonAccessGuard>
            </PrivateRoute>
          } />
          <Route path="/weekly" element={
            <PrivateRoute>
              <SeasonAccessGuard>
                <ProfileSetupGuard>
                  <WeeklyLocks />
                </ProfileSetupGuard>
              </SeasonAccessGuard>
            </PrivateRoute>
          } />
          <Route path="/settings" element={
            <PrivateRoute>
              <SeasonAccessGuard>
                <ProfileSetupGuard>
                  <UserSettings />
                </ProfileSetupGuard>
              </SeasonAccessGuard>
            </PrivateRoute>
          } />
          <Route path="/standings" element={
            <PrivateRoute>
              <SeasonAccessGuard>
                <ProfileSetupGuard>
                  <Standings />
                </ProfileSetupGuard>
              </SeasonAccessGuard>
            </PrivateRoute>
          } />
          <Route path="/awards" element={
            <PrivateRoute>
              <SeasonAccessGuard>
                <ProfileSetupGuard>
                  <Awards />
                </ProfileSetupGuard>
              </SeasonAccessGuard>
            </PrivateRoute>
          } />
          <Route path="/snydermetrics" element={
            <PrivateRoute>
              <SeasonAccessGuard>
                <ProfileSetupGuard>
                  <Snydermetrics />
                </ProfileSetupGuard>
              </SeasonAccessGuard>
            </PrivateRoute>
          } />
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App
