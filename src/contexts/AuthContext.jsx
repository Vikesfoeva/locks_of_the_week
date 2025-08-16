import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
  // onLog // REMOVED direct import
} from 'firebase/auth'
import { initializeApp } from 'firebase/app'
import { API_URL } from '../config'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
}

console.log('[AuthContext] Initial firebaseConfig used for initializeApp:', firebaseConfig);

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const googleProvider = new GoogleAuthProvider()

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const processingUserRef = useRef(null); // Track which user we're currently processing
  const isSignupInProgressRef = useRef(false); // Track if we're in the middle of a signup

  // Function to create user in MongoDB
  async function createUserInDb(user) {
    try {
      const { email, uid, displayName } = user;
      
      // Parse displayName to get first and last names
      let firstName = '';
      let lastName = '';
      if (displayName) {
        const nameParts = displayName.split(' ');
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(' ');
      } else {
        // For email/password signup, check localStorage for pending name data
        const pendingFirstName = localStorage.getItem('pendingFirstName');
        const pendingLastName = localStorage.getItem('pendingLastName');
        if (pendingFirstName && pendingLastName) {
          firstName = pendingFirstName;
          lastName = pendingLastName;
          // Clear the pending data after using it
          localStorage.removeItem('pendingFirstName');
          localStorage.removeItem('pendingLastName');
        }
      }

      // Get Venmo ID from localStorage for email/password signup
      let venmoHandle = '';
      const pendingVenmoId = localStorage.getItem('pendingVenmoId');
      if (pendingVenmoId) {
        venmoHandle = pendingVenmoId;
        // Clear the pending data after using it
        localStorage.removeItem('pendingVenmoId');
      }
      // For Google users, venmoHandle will be empty initially
      // They will be redirected to setup profile page to add it

      // Get cell phone from localStorage for email/password signup
      let cellPhone = '';
      const pendingCellPhone = localStorage.getItem('pendingCellPhone');
      if (pendingCellPhone) {
        cellPhone = pendingCellPhone;
        // Clear the pending data after using it
        localStorage.removeItem('pendingCellPhone');
      }
      // For Google users, cellPhone will be empty initially
      // They will be redirected to setup profile page to add it

      const response = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          firebaseUid: uid,
          firstName,
          lastName,
          venmoHandle,
          cellPhone,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not create user in DB');
      }
      console.log('User created in DB:', data.message);
    } catch (error) {
      console.error('Error creating user in DB:', error);
      throw error;
    }
  }

  // Effect to handle auth state changes
  useEffect(() => {
    console.log('[AuthContext] Setting up onAuthStateChanged listener.');
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('[AuthContext] onAuthStateChanged triggered. User:', user ? user.uid : 'null');
      
      // Prevent duplicate processing of the same user
      if (user && processingUserRef.current === user.uid) {
        console.log('[AuthContext] Already processing user:', user.uid, '- skipping duplicate processing');
        return;
      }
      
      setLoading(true); // Set loading at the beginning
      
      if (user) {
        // Mark this user as being processed
        processingUserRef.current = user.uid;
        
        try {
          // 1. Check if user is in our DB
          // Note: 404 is expected for new users during signup - this will trigger user creation
          let response;
          try {
            response = await fetch(`${API_URL}/users?firebaseUid=${user.uid}`);
          } catch (fetchError) {
            console.error('Network error fetching user:', fetchError);
            throw new Error('Failed to connect to server');
          }
          
          if (response.ok) {
            const userData = await response.json();
            console.log('[AuthContext] User data from backend:', userData);
            const mergedUser = { ...user, ...userData };
            console.log('[AuthContext] Merged user data:', mergedUser);
            setCurrentUser(mergedUser);
          } else if (response.status === 404) {
            // Only log this as info if it's during signup, otherwise it might be a real issue
            if (isSignupInProgressRef.current) {
              console.log('User not found in DB (expected during signup), checking whitelist before creation.');
            } else {
              console.log('User not found in DB, checking whitelist before creation.');
            }
            
            // 2. If not in DB, check if they are whitelisted
            const whitelistCheckResponse = await fetch(`${API_URL}/whitelist/check?email=${user.email}`);
            const whitelistCheckData = await whitelistCheckResponse.json();

            if (whitelistCheckResponse.ok && whitelistCheckData.allowed) {
              console.log('User is whitelisted. Creating user in DB.');
              // 3. If whitelisted, create user
              await createUserInDb(user);
              
              // Add a small delay to ensure the database write is complete
              await new Promise(resolve => setTimeout(resolve, 500));
              
              const newUserResponse = await fetch(`${API_URL}/users?firebaseUid=${user.uid}`);
              console.log('[AuthContext] Fetching new user data, response status:', newUserResponse.status);
              
              if (newUserResponse.ok) {
                const newUserData = await newUserResponse.json();
                console.log('[AuthContext] New user data after creation:', newUserData);
                const mergedUser = { ...user, ...newUserData };
                console.log('[AuthContext] Merged new user data:', mergedUser);
                setCurrentUser(mergedUser);
              } else {
                console.error('[AuthContext] Failed to fetch user data after creation. Status:', newUserResponse.status);
                const errorData = await newUserResponse.text();
                console.error('[AuthContext] Error response:', errorData);
                
                // Fallback: try to fetch by email instead
                console.log('[AuthContext] Trying fallback fetch by email...');
                try {
                  const fallbackResponse = await fetch(`${API_URL}/users?email=${encodeURIComponent(user.email)}`);
                  console.log('[AuthContext] Fallback response status:', fallbackResponse.status);
                  
                  if (fallbackResponse.ok) {
                    const fallbackUserData = await fallbackResponse.json();
                    console.log('[AuthContext] Fallback user data:', fallbackUserData);
                    const mergedUser = { ...user, ...fallbackUserData };
                    console.log('[AuthContext] Merged user data from fallback:', mergedUser);
                    setCurrentUser(mergedUser);
                  } else {
                    console.error('[AuthContext] Fallback fetch also failed. Status:', fallbackResponse.status);
                    const fallbackErrorData = await fallbackResponse.text();
                    console.error('[AuthContext] Fallback error response:', fallbackErrorData);
                    throw new Error('Failed to fetch user data after creation.');
                  }
                } catch (fallbackError) {
                  console.error('[AuthContext] Fallback fetch error:', fallbackError);
                  throw new Error('Failed to fetch user data after creation.');
                }
              }
            } else {
              // 4. If not whitelisted, sign out and set error
              console.log('User is not whitelisted. Signing out.');
              setAuthError('Your email is not authorized to use this application.');
              await signOut(auth); // This will re-trigger onAuthStateChanged with user=null
              setCurrentUser(null);
            }
          } else {
            // Handle other non-404 errors
            throw new Error(`Failed to fetch user data (status: ${response.status})`);
          }
        } catch (error) {
          console.error('Error during auth state processing:', error);
          setAuthError(error.message || 'An error occurred during authentication.');
          setCurrentUser(user); // Fallback to firebase user to avoid logging out on transient backend errors
          processingUserRef.current = null; // Clear processing ref on error
          isSignupInProgressRef.current = false; // Clear signup flag on error
        } finally {
          processingUserRef.current = null; // Clear processing ref when complete
          isSignupInProgressRef.current = false; // Clear signup flag when complete
          setLoading(false);
          console.log('[AuthContext] Auth state processed. Loading set to false.');
        }
      } else {
        // User is signed out.
        processingUserRef.current = null; // Clear processing ref
        isSignupInProgressRef.current = false; // Clear signup flag
        setCurrentUser(null);
        setLoading(false);
        console.log('[AuthContext] Auth state processed (no user path). Loading set to false.');
      }
    });

    return () => {
      console.log('[AuthContext] Cleaning up onAuthStateChanged listener.');
      unsubscribe();
    };
  }, []);

  // Sign up with email and password
  async function signup(email, password) {
    setAuthError('');
    isSignupInProgressRef.current = true; // Mark signup as in progress
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log("[AuthContext] Firebase user created via email/pass:", userCredential.user.uid);
      // Don't call createUserInDb here - let onAuthStateChanged handle it
      // This prevents the race condition where onAuthStateChanged runs before createUserInDb completes
      return userCredential;
    } catch (error) {
      console.error("[AuthContext] Error during email/pass signup:", error);
      setAuthError(error.message);
      isSignupInProgressRef.current = false; // Clear flag on error
      throw error;
    }
  }

  // Sign in with email and password
  async function login(email, password) {
    setAuthError('');
    try {
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("[AuthContext] Error during email/pass login:", error);
      setAuthError(error.message);
      throw error;
    }
  }

  // Sign in with Google Popup
  async function loginWithGooglePopup() {
    setAuthError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      console.log("[AuthContext] Google sign-in successful. Checking whitelist for user:", user.email);

      // 1. Check if the user is whitelisted
      const whitelistCheckResponse = await fetch(`${API_URL}/whitelist/check?email=${user.email}`);
      const whitelistCheckData = await whitelistCheckResponse.json();
      
      if (!whitelistCheckResponse.ok || !whitelistCheckData.allowed) {
        console.error("Whitelist check failed or user not allowed.");
        // Sign the user out from Firebase as they are not authorized in our system
        await signOut(auth);
        const errorMessage = whitelistCheckData.error || 'This email is not authorized for account creation. Please contact an administrator.';
        setAuthError(errorMessage);
        throw new Error(errorMessage);
      }

      // 2. Check if user exists in your DB, if not, the onAuthStateChanged will handle creation
      // This logic can be simplified as onAuthStateChanged will run anyway.
      // We just need to ensure the user is logged in here. The effect will handle the DB check/creation.
      console.log("[AuthContext] User is whitelisted. Auth state change will handle DB sync.");

      return result;
    } catch (error) {
      console.error("[AuthContext] Error during Google popup sign-in:", error);
      // Ensure authError is set from caught errors.
      if (!authError) {
        setAuthError(error.message);
      }
      throw error;
    }
  }

  // Send password reset email
  async function resetPassword(email) {
    setAuthError('');
    try {
      console.log("[AuthContext] Attempting to send password reset email to:", email);
      console.log("[AuthContext] Firebase auth instance:", auth);
      console.log("[AuthContext] Current user:", auth.currentUser);
      
      await sendPasswordResetEmail(auth, email);
      console.log("[AuthContext] Password reset email sent successfully to:", email);
    } catch (error) {
      console.error("[AuthContext] Error sending password reset email:", error);
      console.error("[AuthContext] Error code:", error.code);
      console.error("[AuthContext] Error message:", error.message);
      setAuthError(error.message);
      throw error;
    }
  }

  // Logout
  function logout() {
    setAuthError('');
    return signOut(auth);
  }

  // Update the user's profile in the backend database
  async function updateUserProfile({ firstName, lastName, venmo, cellPhone }) {
    if (!auth.currentUser) {
      throw new Error('Not authenticated');
    }

    try {
      // Ensure we have the DB user id
      let userId = currentUser && currentUser._id ? currentUser._id : null;
      if (!userId) {
        const resp = await fetch(`${API_URL}/users?firebaseUid=${auth.currentUser.uid}`);
        if (!resp.ok) {
          throw new Error('Failed to locate user in DB');
        }
        const dbUser = await resp.json();
        userId = dbUser && dbUser._id ? dbUser._id : null;
      }

      if (!userId) {
        throw new Error('User id missing for profile update');
      }

      const updates = {};
      if (typeof firstName === 'string') updates.firstName = firstName;
      if (typeof lastName === 'string') updates.lastName = lastName;
      if (typeof venmo === 'string') updates.venmoHandle = venmo;
      if (typeof cellPhone === 'string') updates.cellPhone = cellPhone;

      const putResp = await fetch(`${API_URL}/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await putResp.json().catch(() => ({}));
      if (!putResp.ok) {
        throw new Error(data.error || 'Failed to update user');
      }
      return true;
    } catch (error) {
      console.error('[AuthContext] updateUserProfile error:', error);
      throw error;
    }
  }

  // Re-fetch the user's profile from the backend and merge with Firebase user
  async function refetchUserProfile() {
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) return null;
      const response = await fetch(`${API_URL}/users?firebaseUid=${firebaseUser.uid}`);
      if (!response.ok) return null;
      const userData = await response.json();
      const merged = { ...firebaseUser, ...userData };
      setCurrentUser(merged);
      return merged;
    } catch (error) {
      console.error('[AuthContext] refetchUserProfile error:', error);
      return null;
    }
  }

  // The value provided to the context consumers
  const value = {
    currentUser,
    loading,
    authError,
    setAuthError,
    signup,
    login,
    logout,
    resetPassword,
    loginWithGooglePopup,
    updateUserProfile,
    refetchUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}