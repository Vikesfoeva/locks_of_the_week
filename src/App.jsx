import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import AdminDashboard from './pages/AdminDashboard'
import Layout from './components/Layout'
import Picks from './pages/Picks'
import WeeklyPicks from './pages/WeeklyPicks'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<Layout />}>
          <Route path="/" element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } />
          <Route path="/admin" element={
            <PrivateRoute adminOnly>
              <AdminDashboard />
            </PrivateRoute>
          } />
          <Route path="/picks" element={<Picks />} />
          <Route path="/weekly" element={
            <PrivateRoute>
              <WeeklyPicks />
            </PrivateRoute>
          } />
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App 