import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config';
import { formatPhoneNumber, getCleanPhoneNumber } from '../utils/phoneFormatter';
import { formatVenmoHandle } from '../utils/venmoFormatter';

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

  // Most recent week state for locks made calculation
  const [mostRecentWeek, setMostRecentWeek] = useState(null);
  const [userPicksForRecentWeek, setUserPicksForRecentWeek] = useState({});

  // Payout settings state
  const [payoutSettings, setPayoutSettings] = useState({
    first: 0,
    second: 0,
    third: 0,
    fourth: 0,
    fifth: 0,
    last: 0
  });
  const [payoutLoading, setPayoutLoading] = useState(true);
  const [payoutError, setPayoutError] = useState(null);
  const [savingPayout, setSavingPayout] = useState(false);
  const [showPayoutConfirmModal, setShowPayoutConfirmModal] = useState(false);

  // Announcement state
  const [announcement, setAnnouncement] = useState({
    message: '',
    active: false
  });
  const [announcementLoading, setAnnouncementLoading] = useState(true);
  const [announcementError, setAnnouncementError] = useState(null);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [showAnnouncementConfirmModal, setShowAnnouncementConfirmModal] = useState(false);

  // 3-0 Week Prize Pool state
  const [threeZeroPrizePool, setThreeZeroPrizePool] = useState(0);
  const [threeZeroPrizePoolLoading, setThreeZeroPrizePoolLoading] = useState(true);
  const [threeZeroPrizePoolError, setThreeZeroPrizePoolError] = useState(null);
  const [savingThreeZeroPrizePool, setSavingThreeZeroPrizePool] = useState(false);
  const [showThreeZeroPrizePoolConfirmModal, setShowThreeZeroPrizePoolConfirmModal] = useState(false);

  // Helper function to parse collection name to a Date object for sorting
  const parseCollectionNameToDate = (collectionName) => {
    if (!collectionName || typeof collectionName !== 'string') return null;
    const parts = collectionName.split('_'); // Expected format: "odds_YYYY_MM_DD"
    if (parts.length === 4 && parts[0] === 'odds') {
      const year = parseInt(parts[1], 10);
      const month = parseInt(parts[2], 10) - 1; // Month is 0-indexed in JS Date
      const day = parseInt(parts[3], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        return new Date(year, month, day);
      }
    }
    return null;
  };

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

  // Fetch most recent week when active year changes
  useEffect(() => {
    const fetchMostRecentWeek = async () => {
      if (!activeYear) return;
      
      try {
        const collectionsRes = await fetch(`${API_URL}/collections`);
        if (!collectionsRes.ok) throw new Error('Failed to fetch collections');
        const collections = await collectionsRes.json();
        
        // Filter collections for the active year and sort by date (most recent first)
        const currentYearCollections = collections
          .filter(name => name.includes(`odds_${activeYear}_`))
          .filter(name => parseCollectionNameToDate(name) !== null)
          .sort((a, b) => {
            const dateA = parseCollectionNameToDate(a);
            const dateB = parseCollectionNameToDate(b);
            return dateB - dateA;
          });

        const mostRecent = currentYearCollections[0] || null;
        setMostRecentWeek(mostRecent);
      } catch (err) {
        console.error('Error fetching most recent week:', err);
      }
    };

    fetchMostRecentWeek();
  }, [activeYear]);

  // Fetch picks for the most recent week for all users
  useEffect(() => {
    const fetchUserPicksForRecentWeek = async () => {
      if (!mostRecentWeek || !activeYear) return;
      
      try {
        const picksRes = await fetch(`${API_URL}/picks?collectionName=${mostRecentWeek}&year=${activeYear}`);
        if (!picksRes.ok) throw new Error('Failed to fetch picks');
        const allPicks = await picksRes.json();
        
        // Group picks by userId
        const picksByUser = {};
        allPicks.forEach(pick => {
          if (!picksByUser[pick.userId]) {
            picksByUser[pick.userId] = [];
          }
          picksByUser[pick.userId].push(pick);
        });
        
        setUserPicksForRecentWeek(picksByUser);
      } catch (err) {
        console.error('Error fetching user picks for recent week:', err);
      }
    };

    fetchUserPicksForRecentWeek();
  }, [mostRecentWeek, activeYear]);

  // Fetch payout settings on mount
  useEffect(() => {
    const fetchPayoutSettings = async () => {
      setPayoutLoading(true);
      setPayoutError(null);
      try {
        const response = await fetch(`${API_URL}/payout-settings`);
        if (!response.ok) throw new Error('Failed to fetch payout settings');
        const settings = await response.json();
        setPayoutSettings(settings);
      } catch (err) {
        setPayoutError(err.message);
      } finally {
        setPayoutLoading(false);
      }
    };
    fetchPayoutSettings();
  }, []);

  // Fetch announcement on mount
  useEffect(() => {
    const fetchAnnouncement = async () => {
      setAnnouncementLoading(true);
      setAnnouncementError(null);
      try {
        const response = await fetch(`${API_URL}/announcements`);
        if (!response.ok) throw new Error('Failed to fetch announcement');
        const data = await response.json();
        setAnnouncement({
          message: data.message || '',
          active: data.active || false
        });
      } catch (err) {
        setAnnouncementError(err.message);
      } finally {
        setAnnouncementLoading(false);
      }
    };
    fetchAnnouncement();
  }, []);

  // Fetch 3-0 week prize pool on mount
  useEffect(() => {
    const fetchThreeZeroPrizePool = async () => {
      setThreeZeroPrizePoolLoading(true);
      setThreeZeroPrizePoolError(null);
      try {
        const response = await fetch(`${API_URL}/three-zero-prize-pool`);
        if (!response.ok) throw new Error('Failed to fetch 3-0 week prize pool');
        const data = await response.json();
        setThreeZeroPrizePool(data.prizePool);
      } catch (err) {
        console.error('Error fetching 3-0 week prize pool:', err);
        setThreeZeroPrizePoolError(err.message);
      } finally {
        setThreeZeroPrizePoolLoading(false);
      }
    };
    fetchThreeZeroPrizePool();
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
      const whitelistResponse = await fetch(`${API_URL}/whitelist/${encodeURIComponent(userToDelete.email)}`, {
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
      cellPhone: user.cellPhone ? formatPhoneNumber(user.cellPhone) : '',
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
      
      // Clean phone number if it's being updated
      if (updates.cellPhone) {
        updates.cellPhone = getCleanPhoneNumber(updates.cellPhone);
      }
      
      // Format Venmo handle if it's being updated
      if (updates.venmoHandle !== undefined) {
        updates.venmoHandle = formatVenmoHandle(updates.venmoHandle);
      }
      
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

  // Handler for payout settings changes
  const handlePayoutChange = (place, value) => {
    const numValue = parseFloat(value) || 0;
    setPayoutSettings(prev => ({
      ...prev,
      [place]: numValue
    }));
  };

  // Handler to show confirmation modal
  const handleSavePayoutSettings = () => {
    setShowPayoutConfirmModal(true);
  };

  // Handler to actually save payout settings after confirmation
  const confirmSavePayoutSettings = async () => {
    setSavingPayout(true);
    setPayoutError(null);
    setShowPayoutConfirmModal(false);
    try {
      const response = await fetch(`${API_URL}/payout-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payoutSettings)
      });
      if (!response.ok) throw new Error('Failed to save payout settings');
      // Success message could be added here
    } catch (err) {
      setPayoutError(err.message);
    } finally {
      setSavingPayout(false);
    }
  };

  // Handler for announcement changes
  const handleAnnouncementChange = (field, value) => {
    setAnnouncement(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handler to show announcement confirmation modal
  const handleSaveAnnouncement = () => {
    setShowAnnouncementConfirmModal(true);
  };

  // Handler to actually save announcement after confirmation
  const confirmSaveAnnouncement = async () => {
    setSavingAnnouncement(true);
    setAnnouncementError(null);
    setShowAnnouncementConfirmModal(false);
    try {
      const response = await fetch(`${API_URL}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(announcement)
      });
      if (!response.ok) throw new Error('Failed to save announcement');
      // Success message could be added here
    } catch (err) {
      setAnnouncementError(err.message);
    } finally {
      setSavingAnnouncement(false);
    }
  };

  // Handler for 3-0 week prize pool changes
  const handleThreeZeroPrizePoolChange = (value) => {
    setThreeZeroPrizePool(parseFloat(value) || 0);
  };

  // Handler to show 3-0 prize pool confirmation modal
  const handleSaveThreeZeroPrizePool = () => {
    setShowThreeZeroPrizePoolConfirmModal(true);
  };

  // Handler to actually save 3-0 prize pool after confirmation
  const confirmSaveThreeZeroPrizePool = async () => {
    setSavingThreeZeroPrizePool(true);
    setThreeZeroPrizePoolError(null);
    setShowThreeZeroPrizePoolConfirmModal(false);
    try {
      const response = await fetch(`${API_URL}/three-zero-prize-pool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prizePool: threeZeroPrizePool })
      });
      if (!response.ok) throw new Error('Failed to save 3-0 week prize pool');
      console.log('3-0 week prize pool saved successfully');
    } catch (err) {
      setThreeZeroPrizePoolError(err.message);
    } finally {
      setSavingThreeZeroPrizePool(false);
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

      {/* Payout Settings Confirmation Modal */}
      {showPayoutConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Payout Settings</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to save these payout settings? This will affect how prizes are distributed to users.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-gray-900 mb-2">Current Settings:</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>1st Place:</span>
                  <span className="font-medium">${payoutSettings.first.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>2nd Place:</span>
                  <span className="font-medium">${payoutSettings.second.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>3rd Place:</span>
                  <span className="font-medium">${payoutSettings.third.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>4th Place:</span>
                  <span className="font-medium">${payoutSettings.fourth.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>5th Place:</span>
                  <span className="font-medium">${payoutSettings.fifth.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Place:</span>
                  <span className="font-medium">${payoutSettings.last.toFixed(2)}</span>
                </div>
                <div className="border-t pt-1 mt-2">
                  <div className="flex justify-between font-semibold">
                    <span>Total Pool:</span>
                    <span>${Object.values(payoutSettings).reduce((sum, val) => sum + val, 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-4">
              <button
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                onClick={() => setShowPayoutConfirmModal(false)}
                disabled={savingPayout}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                onClick={confirmSavePayoutSettings}
                disabled={savingPayout}
              >
                {savingPayout ? 'Saving...' : 'Confirm & Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Announcement Confirmation Modal */}
      {showAnnouncementConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Announcement</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to save this announcement? This will be displayed prominently on the main dashboard for all users.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-gray-900 mb-2">Announcement Preview:</h4>
              <div className="text-sm">
                <div className="mb-2">
                  <span className="font-medium">Message:</span>
                  <p className="text-gray-700 mt-1">{announcement.message || '(No message)'}</p>
                </div>
                <div>
                  <span className="font-medium">Status:</span>
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                    announcement.active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {announcement.active ? 'Active (Will be shown)' : 'Inactive (Hidden)'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-4">
              <button
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                onClick={() => setShowAnnouncementConfirmModal(false)}
                disabled={savingAnnouncement}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                onClick={confirmSaveAnnouncement}
                disabled={savingAnnouncement}
              >
                {savingAnnouncement ? 'Saving...' : 'Confirm & Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3-0 Week Prize Pool Confirmation Modal */}
      {showThreeZeroPrizePoolConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm 3-0 Week Prize Pool</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to set the 3-0 week prize pool to this amount? This will affect how prizes are distributed to users who achieve perfect weeks.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-gray-900 mb-2">Prize Pool Setting:</h4>
              <div className="text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Prize Pool:</span>
                  <span className="font-medium">${threeZeroPrizePool.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50"
                onClick={() => setShowThreeZeroPrizePoolConfirmModal(false)}
                disabled={savingThreeZeroPrizePool}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                onClick={confirmSaveThreeZeroPrizePool}
                disabled={savingThreeZeroPrizePool}
              >
                {savingThreeZeroPrizePool ? 'Saving...' : 'Confirm & Save'}
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
                <th className="px-2 py-1 border">Cell Phone</th>
                <th className="px-2 py-1 border">Dues Paid</th>
                <th className="px-2 py-1 border">Date Paid</th>
                <th className="px-2 py-1 border">
                  Locks Made
                  {mostRecentWeek && (
                    <div className="text-xs text-gray-500 font-normal">
                      {mostRecentWeek.replace('odds_', '').replace(/_/g, '/')}
                    </div>
                  )}
                </th>
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
                  <td className="border px-2 py-1">
                    {editingUser === user._id ? (
                      <input
                        className="input input-sm w-full"
                        value={editFormData.cellPhone}
                        onChange={e => setEditFormData(prev => ({ ...prev, cellPhone: formatPhoneNumber(e.target.value) }))}
                        placeholder="(555) 123-4567"
                      />
                    ) : (
                      <span>{user.cellPhone ? formatPhoneNumber(user.cellPhone) : '-'}</span>
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
                    {userPicksForRecentWeek[user.firebaseUid]?.length || 0}/3
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

      {/* Payout Settings */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Prizepool Payout Settings</h3>
        <p className="text-sm text-gray-600 mb-4">
          Set the payout amounts for 1st, 2nd, 3rd, 4th, 5th, and last place. Enter 0 to disable payout for any position.
        </p>
        {payoutLoading ? (
          <div className="text-gray-500">Loading payout settings...</div>
        ) : payoutError ? (
          <div className="text-red-600">Error: {payoutError}</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { key: 'first', label: '1st Place' },
                { key: 'second', label: '2nd Place' },
                { key: 'third', label: '3rd Place' },
                { key: 'fourth', label: '4th Place' },
                { key: 'fifth', label: '5th Place' },
                { key: 'last', label: 'Last Place' }
              ].map(({ key, label }) => (
                <div key={key}>
                  <label htmlFor={`payout-${key}`} className="block text-sm font-medium text-gray-700 mb-1">
                    {label}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                    <input
                      id={`payout-${key}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={payoutSettings[key]}
                      onChange={(e) => handlePayoutChange(key, e.target.value)}
                      onFocus={(e) => {
                        // Select all text when focusing, which will clear the 0 when user starts typing
                        e.target.select();
                      }}
                      className="input pl-8 w-full"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleSavePayoutSettings}
                disabled={savingPayout}
                className="btn btn-primary"
              >
                {savingPayout ? 'Saving...' : 'Save Payout Settings'}
              </button>
              <div className="text-sm text-gray-600">
                Total Pool: ${Object.values(payoutSettings).reduce((sum, val) => sum + val, 0).toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Announcement Management */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Dashboard Announcement</h3>
        <p className="text-sm text-gray-600 mb-4">
          Set an announcement message that will be displayed on the main dashboard. Users will see this message prominently displayed.
        </p>
        {announcementLoading ? (
          <div className="text-gray-500">Loading announcement...</div>
        ) : announcementError ? (
          <div className="text-red-600">Error: {announcementError}</div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="announcement-message" className="block text-sm font-medium text-gray-700 mb-2">
                Announcement Message
              </label>
              <textarea
                id="announcement-message"
                value={announcement.message}
                onChange={(e) => handleAnnouncementChange('message', e.target.value)}
                className="input w-full h-24 resize-none"
                placeholder="Enter announcement message here..."
                maxLength={2000}
              />
              <div className="text-xs text-gray-500 mt-1">
                {announcement.message.length}/2000 characters
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={announcement.active}
                  onChange={(e) => handleAnnouncementChange('active', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm font-medium text-gray-700">
                  Show announcement on dashboard
                </span>
              </label>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleSaveAnnouncement}
                disabled={savingAnnouncement}
                className="btn btn-primary"
              >
                {savingAnnouncement ? 'Saving...' : 'Save Announcement'}
              </button>
              {announcement.active && announcement.message && (
                <div className="text-sm text-green-600">
                  ✓ Announcement is active and will be shown to users
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3-0 Week Prize Pool Settings */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">3-0 Week Prize Pool</h3>
        <p className="text-sm text-gray-600 mb-4">
          Set the total prize pool for users who achieve perfect 3-0 weeks. Users earn a percentage of this pool based on their share of total 3-0 weeks.
        </p>
        {threeZeroPrizePoolLoading ? (
          <div className="text-gray-500">Loading 3-0 week prize pool...</div>
        ) : threeZeroPrizePoolError ? (
          <div className="text-red-600">Error: {threeZeroPrizePoolError}</div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="three-zero-prize-pool" className="block text-sm font-medium text-gray-700 mb-2">
                Total Prize Pool
              </label>
              <div className="relative max-w-xs">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                <input
                  id="three-zero-prize-pool"
                  type="number"
                  min="0"
                  step="0.01"
                  value={threeZeroPrizePool}
                  onChange={(e) => handleThreeZeroPrizePoolChange(e.target.value)}
                  onFocus={(e) => {
                    e.target.select();
                  }}
                  className="input pl-8 w-full"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleSaveThreeZeroPrizePool}
                disabled={savingThreeZeroPrizePool}
                className="btn btn-primary"
              >
                {savingThreeZeroPrizePool ? 'Saving...' : 'Save Prize Pool'}
              </button>
              <div className="text-sm text-gray-600">
                Current Pool: ${threeZeroPrizePool.toFixed(2)}
              </div>
            </div>
          </div>
        )}
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