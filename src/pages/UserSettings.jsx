import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function UserSettings() {
  const { currentUser, updateUserProfile, refetchUserProfile } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [venmo, setVenmo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (currentUser) {
      setFirstName(currentUser.firstName || '');
      setLastName(currentUser.lastName || '');
      setVenmo(currentUser.venmo || currentUser.venmoHandle || '');
    }
  }, [currentUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!firstName.trim() || !lastName.trim() || !venmo.trim()) {
      setError('All fields are required.');
      return;
    }
    setLoading(true);
    try {
      await updateUserProfile({ firstName, lastName, venmo });
      const refreshed = await refetchUserProfile();
      setSuccess('Profile updated successfully!');
      if (refreshed) {
        setFirstName(refreshed.firstName || '');
        setLastName(refreshed.lastName || '');
        setVenmo(refreshed.venmo || refreshed.venmoHandle || '');
      }
    } catch (err) {
      setError('Failed to update profile.');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded shadow">
      <h2 className="text-2xl font-bold mb-6">User Settings</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">First Name</label>
          <input
            type="text"
            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Last Name</label>
          <input
            type="text"
            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Venmo</label>
          <input
            type="text"
            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            value={venmo}
            onChange={e => setVenmo(e.target.value)}
            required
          />
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        {success && <div className="text-green-600 text-sm">{success}</div>}
        <button
          type="submit"
          className="w-full py-2 px-4 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
} 