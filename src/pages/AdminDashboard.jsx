import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config';

export default function AdminDashboard() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [whitelist, setWhitelist] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteWhitelistModalOpen, setDeleteWhitelistModalOpen] = useState(false);
  const [whitelistEmailToDelete, setWhitelistEmailToDelete] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [saveStatus, setSaveStatus] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active year state
  const [years, setYears] = useState([]);
  const [activeYear, setActiveYear] = useState('');
  const [yearsLoading, setYearsLoading] = useState(true);
  const [yearsError, setYearsError] = useState(null);

  // Fetch available years and active year on mount
  useEffect(() => {
    const fetchYearsAndActive = async () => {
      setYearsLoading(true);
      setYearsError(null);
      try {
        const [yearsRes, activeRes] = await Promise.all([
          fetch(`${API_URL}/years`),
          fetch(`${API_URL}/active-year`)
        ]);
        if (!yearsRes.ok) throw new Error('Failed to fetch years');
        if (!activeRes.ok) throw new Error('Failed to fetch active year');
        const yearsData = await yearsRes.json();
        const activeData = await activeRes.json();
        setYears(yearsData);
        if (activeData.year && yearsData.includes(activeData.year)) {
          setActiveYear(activeData.year);
        } else if (yearsData.length > 0) {
          setActiveYear(yearsData[0]);
        }
      } catch (err) {
        setYearsError(err.message);
      } finally {
        setYearsLoading(false);
      }
    };
    fetchYearsAndActive();
  }, []);

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

  // Handler for initiating user deletion
  const initiateDeleteUser = (user) => {
    if (user.role === 'admin') {
      return;
    }
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  // Handler for confirming user deletion
  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    
    try {
      // Delete from users collection
      const userResponse = await fetch(`${API_URL}/users/${userToDelete._id}`, {
        method: 'DELETE'
      });
      
      if (!userResponse.ok) {
        throw new Error('Failed to delete user');
      }

      // Delete from whitelist collection
      const whitelistResponse = await fetch(`${API_URL}/whitelist/${userToDelete.email}`, {
        method: 'DELETE'
      });

      if (!whitelistResponse.ok && whitelistResponse.status !== 404) {
        throw new Error('Failed to delete user from whitelist');
      }
      
      // Update local state after successful deletion
      setUsers(users.filter(user => user._id !== userToDelete._id));
      setWhitelist(whitelist.filter(e => e !== userToDelete.email));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleteModalOpen(false);
      setUserToDelete(null);
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

  // Handler for initiating whitelist email deletion
  const initiateDeleteWhitelistEmail = (email) => {
    setWhitelistEmailToDelete(email);
    setDeleteWhitelistModalOpen(true);
  };

  // Handler for confirming whitelist email deletion
  const confirmDeleteWhitelistEmail = async () => {
    if (!whitelistEmailToDelete) return;
    
    try {
      const response = await fetch(`${API_URL}/whitelist/${encodeURIComponent(whitelistEmailToDelete)}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete email from whitelist');
      }
      
      // Update local state after successful deletion
      setWhitelist(whitelist.filter(email => email !== whitelistEmailToDelete));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleteWhitelistModalOpen(false);
      setWhitelistEmailToDelete(null);
    }
  };

  // Get whitelisted users who haven't registered yet
  const getUnregisteredWhitelistedUsers = () => {
    const registeredEmails = users.map(user => user.email);
    return whitelist.filter(email => !registeredEmails.includes(email));
  };

  // Handler for starting edit mode
  const startEditing = (user) => {
    setEditingUser(user._id);
    setEditFormData({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      venmoHandle: user.venmoHandle || '',
      duesPaid: user.duesPaid || false,
      dateDuesPaid: user.dateDuesPaid || ''
    });
    setSaveStatus({});
  };

  // Handler for canceling edit mode
  const cancelEditing = () => {
    setIsSubmitting(true);
    setEditingUser(null);
    setEditFormData({});
    setSaveStatus({});
    setTimeout(() => setIsSubmitting(false), 300);
  };

  // Handler for saving user changes
  const saveUserChanges = async () => {
    setIsSubmitting(true);
    try {
      setSaveStatus({ loading: true });
      const user = users.find(u => u._id === editingUser);
      const updates = {
        ...editFormData,
        updatedAt: new Date()
      };
      
      const response = await fetch(`${API_URL}/users/${editingUser}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update user');
      }
      
      // Update local state
      setUsers(users.map(u => 
        u._id === editingUser 
          ? { ...u, ...updates }
          : u
      ));
      
      setSaveStatus({ success: true });
      setTimeout(() => {
        setEditingUser(null);
        setEditFormData({});
        setSaveStatus({});
        setIsSubmitting(false);
      }, 1500);
    } catch (err) {
      setSaveStatus({ error: err.message });
      setIsSubmitting(false);
    }
  };

  // Handler to set active year in backend
  const [savingYear, setSavingYear] = useState(false);
  const [saveYearError, setSaveYearError] = useState(null);
  const handleSetActiveYear = async (e) => {
    const newYear = parseInt(e.target.value, 10);
    setActiveYear(newYear);
    setSavingYear(true);
    setSaveYearError(null);
    try {
      const res = await fetch(`${API_URL}/active-year`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: newYear })
      });
      if (!res.ok) throw new Error('Failed to set active year');
    } catch (err) {
      setSaveYearError(err.message);
    } finally {
      setSavingYear(false);
    }
  };

  if (loading) {
    return <div className="text-center">Loading...</div>;
  }

  if (error) {
    return <div className="text-center text-red-600">Error: {error}</div>;
  }

  return (
    <div className="space-y-8">
      {/* Delete User Confirmation Modal */}
      {deleteModalOpen && userToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm User Deletion</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete the user <span className="font-medium">{userToDelete.email}</span>? 
              This action will:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-6">
              <li>Remove the user from the system</li>
              <li>Remove their email from the whitelist</li>
              <li>Delete all associated data</li>
            </ul>
            <p className="text-red-600 mb-6">This action cannot be undone.</p>
            <div className="flex justify-end space-x-4">
              <button
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setUserToDelete(null);
                }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                onClick={confirmDeleteUser}
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Whitelist Email Confirmation Modal */}
      {deleteWhitelistModalOpen && whitelistEmailToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Whitelist Email Deletion</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to remove <span className="font-medium">{whitelistEmailToDelete}</span> from the whitelist? 
              This action will:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-6">
              <li>Remove the email from the whitelist</li>
              <li>Prevent future registration with this email</li>
            </ul>
            <p className="text-red-600 mb-6">This action cannot be undone.</p>
            <div className="flex justify-end space-x-4">
              <button
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                onClick={() => {
                  setDeleteWhitelistModalOpen(false);
                  setWhitelistEmailToDelete(null);
                }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                onClick={confirmDeleteWhitelistEmail}
              >
                Remove from Whitelist
              </button>
            </div>
          </div>
        </div>
      )}

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
                <th className="px-2 py-1 border">Locks Submitted</th>
                <th className="px-2 py-1 border">Locks Made</th>
                <th className="px-2 py-1 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id} className="even:bg-gray-50">
                  <td className="border px-2 py-1 text-xs">{user.email}</td>
                  <td className="border px-2 py-1">
                    {editingUser === user._id ? (
                      <input
                        className="input input-sm w-full"
                        value={editFormData.firstName}
                        onChange={e => setEditFormData(prev => ({ ...prev, firstName: e.target.value }))}
                        placeholder="First Name"
                      />
                    ) : (
                      <span>{user.firstName || '-'}</span>
                    )}
                  </td>
                  <td className="border px-2 py-1">
                    {editingUser === user._id ? (
                      <input
                        className="input input-sm w-full"
                        value={editFormData.lastName}
                        onChange={e => setEditFormData(prev => ({ ...prev, lastName: e.target.value }))}
                        placeholder="Last Name"
                      />
                    ) : (
                      <span>{user.lastName || '-'}</span>
                    )}
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
                    {editingUser === user._id ? (
                      <input
                        className="input input-sm w-full"
                        value={editFormData.venmoHandle}
                        onChange={e => setEditFormData(prev => ({ ...prev, venmoHandle: e.target.value }))}
                        placeholder="Venmo Handle"
                      />
                    ) : (
                      <span>{user.venmoHandle || '-'}</span>
                    )}
                  </td>
                  <td className="border px-2 py-1 text-center">
                    {editingUser === user._id ? (
                      <input
                        type="checkbox"
                        checked={editFormData.duesPaid}
                        onChange={e => setEditFormData(prev => ({ ...prev, duesPaid: e.target.checked }))}
                        className="h-4 w-4"
                      />
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        user.duesPaid 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.duesPaid ? 'Paid' : 'Unpaid'}
                      </span>
                    )}
                  </td>
                  <td className="border px-2 py-1">
                    {editingUser === user._id ? (
                      <input
                        className="input input-sm w-full"
                        type="date"
                        value={editFormData.dateDuesPaid}
                        onChange={e => setEditFormData(prev => ({ ...prev, dateDuesPaid: e.target.value }))}
                        disabled={!editFormData.duesPaid}
                      />
                    ) : (
                      <span>{user.dateDuesPaid || '-'}</span>
                    )}
                  </td>
                  <td className="border px-2 py-1 text-center">
                    {user.picksSubmitted ? 'Yes' : 'No'}
                  </td>
                  <td className="border px-2 py-1 text-center">
                    {user.picksMade || 0}/3
                  </td>
                  <td className="border px-2 py-1 text-center space-x-2">
                    {editingUser === user._id ? (
                      <div className="flex flex-col items-center space-y-2">
                        <div className="flex flex-row space-x-2">
                          <button
                            className="px-3 py-1 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700"
                            onClick={saveUserChanges}
                            disabled={saveStatus.loading || isSubmitting}
                          >
                            {saveStatus.loading ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            className="px-3 py-1 rounded text-sm font-medium bg-gray-600 text-white hover:bg-gray-700"
                            onClick={cancelEditing}
                            disabled={saveStatus.loading || isSubmitting}
                          >
                            Cancel
                          </button>
                        </div>
                        <div>
                          {saveStatus.success && (
                            <span className="text-green-600">✓ Saved</span>
                          )}
                          {saveStatus.error && (
                            <span className="text-red-600">✗ Error</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-center space-x-2">
                        <button
                          className="p-1"
                          onClick={() => startEditing(user)}
                          title="Edit user details"
                          style={{ lineHeight: 0 }}
                        >
                          {/* Larger Pencil SVG */}
                          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-blue-600 hover:text-blue-800">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 5.487a2.25 2.25 0 1 1 3.182 3.182l-9.75 9.75a2 2 0 0 1-.708.464l-4.25 1.5a.5.5 0 0 1-.637-.637l1.5-4.25a2 2 0 0 1 .464-.708l9.75-9.75z" />
                          </svg>
                        </button>
                        <button
                          className={`p-1 rounded transition-colors ${
                            user.role === 'admin'
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-red-600 hover:text-red-800'
                          }`}
                          onClick={() => initiateDeleteUser(user)}
                          disabled={user.role === 'admin'}
                          title={user.role === 'admin' ? 'Cannot delete admin users' : 'Delete user'}
                          style={{ lineHeight: 0 }}
                        >
                          {/* Trash Can SVG */}
                          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className={user.role === 'admin' ? 'text-gray-400' : 'text-red-600 group-hover:text-red-800'}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7h12z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Whitelisted Users Table */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Whitelisted Users (Not Yet Registered)</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-2 py-1 border">Email</th>
                <th className="px-2 py-1 border">Status</th>
                <th className="px-2 py-1 border">Actions</th>
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
                  <td className="border px-2 py-1 text-center">
                    <button
                      className="p-1 rounded transition-colors text-red-600 hover:text-red-800"
                      onClick={() => initiateDeleteWhitelistEmail(email)}
                      title="Remove from whitelist"
                      style={{ lineHeight: 0 }}
                    >
                      {/* Trash Can SVG */}
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-red-600 hover:text-red-800">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7h12z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
              {getUnregisteredWhitelistedUsers().length === 0 && (
                <tr>
                  <td colSpan="3" className="border px-2 py-4 text-center text-gray-500">
                    No whitelisted users pending registration
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pre-register Email Form (Whitelist) - restored */}
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

      {/* Active Year Selection - at bottom */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Active Year</h3>
        {yearsLoading ? (
          <div className="text-gray-500">Loading years...</div>
        ) : yearsError ? (
          <div className="text-red-600">Error: {yearsError}</div>
        ) : (
          <div className="flex items-center gap-2">
            <label htmlFor="active-year-select" className="font-medium">Set Active Year:</label>
            <select
              id="active-year-select"
              value={activeYear}
              onChange={handleSetActiveYear}
              className="border rounded px-2 py-1"
              disabled={savingYear}
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            {savingYear && <span className="text-xs text-gray-500 ml-2">Saving...</span>}
            {saveYearError && <span className="text-xs text-red-600 ml-2">Error: {saveYearError}</span>}
          </div>
        )}
      </div>
    </div>
  );
} 