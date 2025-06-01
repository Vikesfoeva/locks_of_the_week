import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = 'http://localhost:5001/api';

export default function AdminDashboard() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [whitelist, setWhitelist] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [activeWeek, setActiveWeek] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch users and whitelist on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [usersRes, whitelistRes] = await Promise.all([
          fetch(`${API_URL}/users`),
          fetch(`${API_URL}/whitelist`)
        ]);
        
        if (!usersRes.ok || !whitelistRes.ok) {
          throw new Error('Failed to fetch data');
        }
        
        const usersData = await usersRes.json();
        const whitelistData = await whitelistRes.json();
        
        setUsers(usersData);
        setWhitelist(whitelistData.map(item => item.email));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Handlers for user management
  const handleUserChange = async (index, field, value) => {
    try {
      const user = users[index];
      const updates = { ...user, [field]: value };
      
      const response = await fetch(`${API_URL}/users/${user._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update user');
      }
      
      // Update local state after successful API call
      const updated = [...users];
      updated[index] = { ...updated[index], [field]: value };
      setUsers(updated);
    } catch (err) {
      setError(err.message);
    }
  };

  // Handler for deleting a user
  const handleDeleteUser = async (userId, isAdmin) => {
    if (isAdmin) {
      alert('Cannot delete admin users');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/users/${userId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete user');
      }
      
      // Update local state after successful deletion
      setUsers(users.filter(user => user._id !== userId));
    } catch (err) {
      setError(err.message);
    }
  };

  // Handler for pre-registering email
  const handleAddEmail = async (e) => {
    e.preventDefault();
    if (!newEmail || whitelist.includes(newEmail)) {
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/whitelist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail })
      });
      
      if (!response.ok) {
        throw new Error('Failed to add email to whitelist');
      }
      
      setWhitelist([...whitelist, newEmail]);
      setNewEmail('');
    } catch (err) {
      setError(err.message);
    }
  };

  // Handler for active week
  const handleActiveWeekChange = (e) => {
    setActiveWeek(Number(e.target.value));
  };

  // Get whitelisted users who haven't registered yet
  const getUnregisteredWhitelistedUsers = () => {
    const registeredEmails = users.map(user => user.email);
    return whitelist.filter(email => !registeredEmails.includes(email));
  };

  if (loading) {
    return <div className="text-center">Loading...</div>;
  }

  if (error) {
    return <div className="text-center text-red-600">Error: {error}</div>;
  }

  return (
    <div className="space-y-8">
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2>
        <p className="mt-2 text-gray-600">Manage users, whitelist, and league settings.</p>
      </div>

      {/* User Management Table */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">User Management</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-2 py-1 border">Email</th>
                <th className="px-2 py-1 border">First Name</th>
                <th className="px-2 py-1 border">Last Name</th>
                <th className="px-2 py-1 border">Role</th>
                <th className="px-2 py-1 border">Venmo</th>
                <th className="px-2 py-1 border">Dues Paid</th>
                <th className="px-2 py-1 border">Date Paid</th>
                <th className="px-2 py-1 border">Picks Submitted</th>
                <th className="px-2 py-1 border">Picks Made</th>
                <th className="px-2 py-1 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, idx) => (
                <tr key={user._id} className="even:bg-gray-50">
                  <td className="border px-2 py-1 text-xs">{user.email}</td>
                  <td className="border px-2 py-1">
                    <input
                      className="input input-sm"
                      value={user.firstName || ''}
                      onChange={e => handleUserChange(idx, 'firstName', e.target.value)}
                    />
                  </td>
                  <td className="border px-2 py-1">
                    <input
                      className="input input-sm"
                      value={user.lastName || ''}
                      onChange={e => handleUserChange(idx, 'lastName', e.target.value)}
                    />
                  </td>
                  <td className="border px-2 py-1 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      user.role === 'admin' 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {user.role || 'user'}
                    </span>
                  </td>
                  <td className="border px-2 py-1">
                    <input
                      className="input input-sm"
                      value={user.venmoHandle || ''}
                      onChange={e => handleUserChange(idx, 'venmoHandle', e.target.value)}
                    />
                  </td>
                  <td className="border px-2 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={user.duesPaid || false}
                      onChange={e => handleUserChange(idx, 'duesPaid', e.target.checked)}
                    />
                  </td>
                  <td className="border px-2 py-1">
                    <input
                      className="input input-sm"
                      type="date"
                      value={user.dateDuesPaid || ''}
                      onChange={e => handleUserChange(idx, 'dateDuesPaid', e.target.value)}
                      disabled={!user.duesPaid}
                    />
                  </td>
                  <td className="border px-2 py-1 text-center">
                    {user.picksSubmitted ? 'Yes' : 'No'}
                  </td>
                  <td className="border px-2 py-1 text-center">
                    {user.picksMade || 0}/3
                  </td>
                  <td className="border px-2 py-1 text-center">
                    <button
                      className={`btn btn-sm ${
                        user.role === 'admin' 
                          ? 'btn-disabled' 
                          : 'btn-error'
                      }`}
                      onClick={() => handleDeleteUser(user._id, user.role === 'admin')}
                      disabled={user.role === 'admin'}
                      title={user.role === 'admin' ? 'Cannot delete admin users' : 'Delete user'}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Whitelisted Users Section */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Whitelisted Users (Not Yet Registered)</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-2 py-1 border">Email</th>
                <th className="px-2 py-1 border">Status</th>
              </tr>
            </thead>
            <tbody>
              {getUnregisteredWhitelistedUsers().map(email => (
                <tr key={email} className="even:bg-gray-50">
                  <td className="border px-2 py-1 text-xs">{email}</td>
                  <td className="border px-2 py-1 text-center">
                    <span className="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
                      Pending Registration
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pre-register Email Form */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Pre-register User Email</h3>
        <form className="flex flex-col sm:flex-row gap-2 items-start sm:items-end" onSubmit={handleAddEmail}>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              className="input"
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary" type="submit">Add to Whitelist</button>
        </form>
      </div>

      {/* League Settings */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-2">League Settings</h3>
        <label className="block text-sm font-medium text-gray-700 mb-1">Current Active Week</label>
        <select
          className="input"
          value={activeWeek}
          onChange={handleActiveWeekChange}
        >
          {[...Array(20)].map((_, i) => (
            <option key={i + 1} value={i + 1}>Week {i + 1}</option>
          ))}
        </select>
      </div>

      {/* Admin Profile */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900">Admin Profile</h3>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <div className="mt-1 text-sm text-gray-900">{currentUser?.email}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Role</label>
            <div className="mt-1 text-sm text-gray-900">Administrator</div>
          </div>
        </div>
      </div>
    </div>
  );
} 