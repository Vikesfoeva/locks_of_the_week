import { useState, useEffect } from 'react'; // Import useEffect
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [locLoading, setLocLoading] = useState(false); // Renamed to avoid conflict if you destructure 'loading' from useAuth
  const { login, loginWithGooglePopup, authError, setAuthError, currentUser, loading: authLoading } = useAuth(); // Destructure currentUser and authLoading
  const navigate = useNavigate();

  useEffect(() => {
    // Only redirect if auth is not loading and currentUser is set.
    // This prevents redirecting if initial auth state is still being determined.
    if (!authLoading && currentUser) {
      console.log('[Login.jsx] currentUser exists and auth is not loading, navigating to /');
      navigate('/');
    }
  }, [currentUser, authLoading, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setAuthError(''); // Clear context authError
    try {
      setLocLoading(true);
      await login(email, password);
      // navigate('/'); // useEffect will handle this for consistency, or keep if preferred for email/pass
    } catch (err) { // Catch specific error from login
      setError(err.message || 'Failed to sign in');
    }
    setLocLoading(false);
  }

  async function handleGoogleSignIn() {
    setError('');
    setAuthError(''); // Clear context authError
    try {
      setLocLoading(true);
      await loginWithGooglePopup(); // This will trigger onAuthStateChanged, then currentUser update, then useEffect
      console.log("[Login.jsx] Google sign-in popup flow completed.");
      // Navigation is now handled by the useEffect.
    } catch (err) {
      // loginWithGooglePopup in AuthContext already sets authError and logs.
      // You might still want to set local error or re-log if needed.
      console.error("[Login.jsx] Error during Google sign-in attempt:", err);
      setError(err.message || 'Failed to sign in with Google');
    }
    setLocLoading(false);
  }

  function handleInputChange(setter) {
    return (e) => {
      setter(e.target.value);
      setError('');
      setAuthError(''); // Clear context authError on input change
    };
  }

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
          Sign in to your account
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        {/* Display local error OR context's authError */}
        {(error || authError) && (
          <div className="rounded-md bg-red-50 p-4 mb-4">
            <div className="text-sm text-red-700">{error || authError}</div>
          </div>
        )}
        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* Email input */}
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
                onChange={handleInputChange(setEmail)}
                className="input"
              />
            </div>
          </div>

          {/* Password input */}
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium leading-6 text-gray-900">
                Password
              </label>
            </div>
            <div className="mt-2">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={handleInputChange(setPassword)}
                className="input"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={locLoading || authLoading} // Disable if local or auth loading
              className="btn btn-primary w-full"
            >
              Sign in
            </button>
          </div>
        </form>

        {/* Or continue with */}
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-gray-500">Or continue with</span>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleGoogleSignIn}
              disabled={locLoading || authLoading} // Disable if local or auth loading
              className="btn btn-secondary w-full"
            >
              {/* SVG for Google icon */}
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Sign in with Google
            </button>
          </div>
        </div>

        <p className="mt-10 text-center text-sm text-gray-500">
          Not a member?{' '}
          <Link to="/register" className="font-semibold leading-6 text-primary-600 hover:text-primary-500">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}