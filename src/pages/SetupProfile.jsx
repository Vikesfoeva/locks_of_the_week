import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function SetupProfile() {
  const { currentUser, updateUserProfile, refetchUserProfile } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [venmoId, setVenmoId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      setFirstName(currentUser.firstName || '');
      setLastName(currentUser.lastName || '');
      setVenmoId(currentUser.venmoHandle || '');
    }
  }, [currentUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!firstName.trim() || !lastName.trim() || !venmoId.trim()) {
      setError('All fields are required.');
      return;
    }

    setLoading(true);
    try {
      await updateUserProfile({ 
        firstName: firstName.trim(), 
        lastName: lastName.trim(), 
        venmo: venmoId.trim() 
      });
      await refetchUserProfile();
      navigate('/');
    } catch (err) {
      setError('Failed to update profile. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
          Complete Your Profile
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Please provide your Venmo ID to complete your account setup
        </p>
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
              Venmo ID *
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
            <p className="mt-1 text-sm text-gray-500">
              This is required to participate in the league
            </p>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? 'Setting up...' : 'Complete Setup'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
