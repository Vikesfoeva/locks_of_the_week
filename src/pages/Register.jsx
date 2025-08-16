import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { API_URL } from '../config'
import { formatPhoneNumber, getCleanPhoneNumber, isValidPhoneNumber } from '../utils/phoneFormatter'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [venmoId, setVenmoId] = useState('')
  const [cellPhone, setCellPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signup } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()

    if (password !== confirmPassword) {
      return setError('Passwords do not match')
    }
    if (!firstName.trim() || !lastName.trim()) {
      return setError('First name and last name are required')
    }
    if (!venmoId.trim()) {
      return setError('Venmo ID is required')
    }
    if (!cellPhone.trim()) {
      return setError('Cell phone number is required')
    }
    
    // Validate cell phone number format (10 digits)
    if (!isValidPhoneNumber(cellPhone)) {
      return setError('Cell phone number must be a valid 10-digit number')
    }

    try {
      setError('')
      setLoading(true)
      // Check if email is whitelisted
      const res = await fetch(`${API_URL}/whitelist/check?email=${encodeURIComponent(email)}`)
      const data = await res.json()
      if (data.allowed) {
        await signup(email, password)
        localStorage.setItem('pendingFirstName', firstName)
        localStorage.setItem('pendingLastName', lastName)
        localStorage.setItem('pendingVenmoId', venmoId)
        localStorage.setItem('pendingCellPhone', getCleanPhoneNumber(cellPhone))
        navigate('/')
      } else {
        setError('This email is not authorized for account creation. Please contact an administrator.')
      }
    } catch {
      setError('Failed to create an account')
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
          Create your account
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          <div>
            <label htmlFor="first-name" className="block text-sm font-medium leading-6 text-gray-900">
              First Name
            </label>
            <div className="mt-2">
              <input
                id="first-name"
                name="first-name"
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div>
            <label htmlFor="last-name" className="block text-sm font-medium leading-6 text-gray-900">
              Last Name
            </label>
            <div className="mt-2">
              <input
                id="last-name"
                name="last-name"
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div>
            <label htmlFor="venmo-id" className="block text-sm font-medium leading-6 text-gray-900">
              Venmo ID
            </label>
            <div className="mt-2">
              <input
                id="venmo-id"
                name="venmo-id"
                type="text"
                required
                value={venmoId}
                onChange={(e) => setVenmoId(e.target.value)}
                placeholder="@your-venmo-username"
                className="input"
              />
            </div>
          </div>

          <div>
            <label htmlFor="cell-phone" className="block text-sm font-medium leading-6 text-gray-900">
              Cell Phone Number
            </label>
            <div className="mt-2">
              <input
                id="cell-phone"
                name="cell-phone"
                type="tel"
                required
                value={cellPhone}
                onChange={(e) => setCellPhone(formatPhoneNumber(e.target.value))}
                placeholder="(555) 123-4567"
                className="input"
              />
              <p className="mt-1 text-sm text-gray-500">
                Format will be applied automatically as you type
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium leading-6 text-gray-900">
              Email address
            </label>
            <div className="mt-2">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium leading-6 text-gray-900">
              Password
            </label>
            <div className="mt-2">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium leading-6 text-gray-900">
              Confirm Password
            </label>
            <div className="mt-2">
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              Register
            </button>
          </div>
        </form>

        <p className="mt-10 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold leading-6 text-primary-600 hover:text-primary-500">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  )
} 