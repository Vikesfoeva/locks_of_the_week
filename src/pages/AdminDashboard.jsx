import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

// Mock data for demonstration
const initialUsers = [
  {
    email: 'user1@example.com',
    name: 'John Doe',
    venmoHandle: '@johndoe',
    duesPaid: true,
    dateDuesPaid: '2024-08-01',
    picksSubmitted: true,
    picksMade: 3,
  },
  {
    email: 'user2@example.com',
    name: 'Jane Smith',
    venmoHandle: '@janesmith',
    duesPaid: false,
    dateDuesPaid: '',
    picksSubmitted: false,
    picksMade: 1,
  },
];

const initialWhitelist = ['user1@example.com', 'user2@example.com', 'newuser@example.com'];

export default function AdminDashboard() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState(initialUsers);
  const [whitelist, setWhitelist] = useState(initialWhitelist);
  const [newEmail, setNewEmail] = useState('');
  const [activeWeek, setActiveWeek] = useState(1);

  // Handlers for user management
  const handleUserChange = (index, field, value) => {
    const updated = [...users];
    updated[index][field] = value;
    setUsers(updated);
  };

  // Handler for pre-registering email
  const handleAddEmail = (e) => {
    e.preventDefault();
    if (newEmail && !whitelist.includes(newEmail)) {
      setWhitelist([...whitelist, newEmail]);
      setNewEmail('');
    }
  };

  // Handler for active week
  const handleActiveWeekChange = (e) => {
    setActiveWeek(Number(e.target.value));
  };

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
                <th className="px-2 py-1 border">Name</th>
                <th className="px-2 py-1 border">Venmo</th>
                <th className="px-2 py-1 border">Dues Paid</th>
                <th className="px-2 py-1 border">Date Paid</th>
                <th className="px-2 py-1 border">Picks Submitted</th>
                <th className="px-2 py-1 border">Picks Made</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, idx) => (
                <tr key={user.email} className="even:bg-gray-50">
                  <td className="border px-2 py-1 text-xs">{user.email}</td>
                  <td className="border px-2 py-1">
                    <input
                      className="input input-sm"
                      value={user.name}
                      onChange={e => handleUserChange(idx, 'name', e.target.value)}
                    />
                  </td>
                  <td className="border px-2 py-1">
                    <input
                      className="input input-sm"
                      value={user.venmoHandle}
                      onChange={e => handleUserChange(idx, 'venmoHandle', e.target.value)}
                    />
                  </td>
                  <td className="border px-2 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={user.duesPaid}
                      onChange={e => handleUserChange(idx, 'duesPaid', e.target.checked)}
                    />
                  </td>
                  <td className="border px-2 py-1">
                    <input
                      className="input input-sm"
                      type="date"
                      value={user.dateDuesPaid}
                      onChange={e => handleUserChange(idx, 'dateDuesPaid', e.target.value)}
                      disabled={!user.duesPaid}
                    />
                  </td>
                  <td className="border px-2 py-1 text-center">
                    {user.picksSubmitted ? 'Yes' : 'No'}
                  </td>
                  <td className="border px-2 py-1 text-center">
                    {user.picksMade}/3
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
        <div className="mt-2 text-xs text-gray-600">
          <span className="font-semibold">Whitelisted Emails:</span> {whitelist.join(', ')}
        </div>
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