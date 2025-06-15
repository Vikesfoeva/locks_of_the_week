import { createContext, useContext, useState, useEffect } from 'react'
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
  // onLog // REMOVED direct import
} from 'firebase/auth'
import { initializeApp } from 'firebase/app'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

console.log('[AuthContext] Initial firebaseConfig used for initializeApp:', firebaseConfig);

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)

console.log('[AuthContext] Initial auth object created:', auth);

const googleProvider = new GoogleAuthProvider()

const AuthContext = createContext()

const API_URL = 'http://localhost:5001/api'

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  function signup(email, password) {
    return createUserWithEmailAndPassword(auth, email, password)
  }

  function login(email, password) {
    setAuthError('')
    return signInWithEmailAndPassword(auth, email, password)
  }

  async function loginWithGoogle() {
    setAuthError('')
    setLoading(true);
    try {
      // First check if the user is whitelisted
      const checkResponse = await fetch(`${API_URL}/users/check-whitelist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: auth.currentUser?.email })
      });
      
      const checkData = await checkResponse.json();
      if (!checkData.allowed) {
        setAuthError('Your email is not authorized to access this application. Please contact an administrator.');
        setLoading(false);
        return;
      }

      await signInWithRedirect(auth, googleProvider);
    } catch (error) {
      setAuthError(error.message || 'Failed to initiate Google sign-in');
      console.error("[AuthContext] Error initiating Google sign-in:", error);
      setLoading(false);
    }
  }

  async function loginWithGooglePopup() {
    setAuthError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      
      // Check whitelist status after successful Google sign-in
      const checkResponse = await fetch(`${API_URL}/users/check-whitelist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: result.user.email })
      });
      
      const checkData = await checkResponse.json();
      if (!checkData.allowed) {
        // Sign out the user if not whitelisted
        await signOut(auth);
        setAuthError('Your email is not authorized to access this application. Please contact an administrator.');
        setLoading(false);
        return;
      }

      console.log("[AuthContext] Google sign-in with popup successful:", result.user.email);
    } catch (error) {
      setAuthError(error.message || 'Failed to sign in with Google popup');
      console.error("[AuthContext] Error with Google sign-in popup:", error);
      setLoading(false);
    }
  }

  function logout() {
    setAuthError('')
    return signOut(auth)
  }

  const handleUserAuth = async (firebaseUser) => {
    if (firebaseUser) {
      console.log('[AuthContext] Firebase user authenticated:', firebaseUser.email);
      try {
        // HERE: Fetch your user profile from your backend to get 'isAdmin' and other app-specific data
        // Example:
        // const response = await fetch(`<span class="math-inline">\{API\_URL\}/users/profile?firebaseUid\=</span>{firebaseUser.uid}`); // Or by email
        // if (!response.ok) throw new Error('Failed to fetch user profile');
        // const appUserProfile = await response.json();
  
        // For now, let's assume you'll add this later and mock it for dashboard access
        const augmentedUser = {
          ...firebaseUser, // Keep all original Firebase user properties
          // email: firebaseUser.email, // Already part of firebaseUser
          // uid: firebaseUser.uid, // Already part of firebaseUser
          // ... other properties from your DB like firstName, lastName
          isAdmin: false, // <<-- Replace with actual isAdmin from your appUserProfile.admin
        };
        // If you had appUserProfile:
        // const augmentedUser = { ...firebaseUser, ...appUserProfile };
  
        setCurrentUser(augmentedUser);
        console.log('[AuthContext] setCurrentUser with augmented user:', augmentedUser);
      } catch (profileError) {
        console.error('[AuthContext] Error fetching/augmenting user profile:', profileError);
        // Decide how to handle this: sign out the user, show an error, or proceed with a basic user object?
        // For now, if profile fetch fails, we might still set Firebase user but log error
        setCurrentUser(firebaseUser); // Fallback to just Firebase user if profile fetch fails
        setAuthError('Could not load user profile.');
      } finally {
        setLoading(false);
        console.log('[AuthContext] Finished processing user. Loading set to false.');
      }
    } else {
      console.log('[AuthContext] No Firebase user.');
      setCurrentUser(null);
      setLoading(false);
    }
  };
  
  const processUserAuthentication = async (firebaseUser) => {
    if (firebaseUser) {
      console.log('[AuthContext] Firebase user authenticated:', firebaseUser.email);
      try {
        // Check whitelist status first
        const checkResponse = await fetch(`${API_URL}/users/check-whitelist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: firebaseUser.email })
        });
        
        const checkData = await checkResponse.json();
        if (!checkData.allowed) {
          // Sign out the user if not whitelisted
          await signOut(auth);
          setAuthError('Your email is not authorized to access this application. Please contact an administrator.');
          setCurrentUser(null);
          setLoading(false);
          return;
        }

        // If user doesn't exist in our database yet, create them
        if (!checkData.userExists) {
          const firstName = localStorage.getItem('pendingFirstName') || firebaseUser.displayName?.split(' ')[0] || '';
          const lastName = localStorage.getItem('pendingLastName') || firebaseUser.displayName?.split(' ').slice(1).join(' ') || '';
          const userDoc = {
            email: firebaseUser.email,
            firebaseUid: firebaseUser.uid,
            firstName,
            lastName,
            role: 'user',
            createdAt: new Date(),
            updatedAt: new Date()
          };

          const createRes = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userDoc)
          });

          if (!createRes.ok) {
            const errData = await createRes.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to create user in application database.');
          }

          // Remove pending names from localStorage after successful creation
          localStorage.removeItem('pendingFirstName');
          localStorage.removeItem('pendingLastName');
        }

        // Fetch the user profile
        const response = await fetch(`${API_URL}/users?email=${encodeURIComponent(firebaseUser.email)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch user profile');
        }

        const usersArray = await response.json();
        if (!usersArray || usersArray.length === 0) {
          throw new Error('User profile not found in application database');
        }

        const appUserProfile = usersArray[0];
        const augmentedUser = {
          ...firebaseUser,
          ...appUserProfile,
          venmo: appUserProfile.venmoHandle || '',
          isAdmin: appUserProfile.role === 'admin'
        };
        
        console.log('[AuthContext] Augmented user object:', JSON.stringify(augmentedUser, null, 2));
        setCurrentUser(augmentedUser);
        setAuthError('');

      } catch (error) {
        console.error('[AuthContext] Error in user authentication process:', error);
        setAuthError(error.message || 'Failed to process user authentication');
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    } else {
      setCurrentUser(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('[AuthContext] useEffect for onAuthStateChanged mounting. Initializing loading to true.');
    setLoading(true);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('[AuthContext] onAuthStateChanged triggered. Firebase User from onAuthStateChanged:', firebaseUser?.email || null);
      
      if (firebaseUser) {
        await processUserAuthentication(firebaseUser);
        setLoading(false); // Set loading false after processing user
        console.log('[AuthContext] Finished processing direct user in onAuthStateChanged. Loading set to false.');
      } else {
        // No user from onAuthStateChanged, try getRedirectResult (for redirect sign-ins)
        console.log('[AuthContext] No user from onAuthStateChanged. Attempting getRedirectResult...');
        try {
          const result = await getRedirectResult(auth);
          console.log('[AuthContext] getRedirectResult.then() inside onAuthStateChanged - Result:', result);
          if (result && result.user) {
            await processUserAuthentication(result.user);
          } else {
            setCurrentUser(null); // No user from redirect either
            console.log('[AuthContext] No user from getRedirectResult. User remains null.');
          }
        } catch (error) {
          console.error("[AuthContext] Error from getRedirectResult in onAuthStateChanged: ", error);
          setAuthError(error.message || 'Failed to process sign-in after redirect');
          setCurrentUser(null);
        } finally {
          setLoading(false); // Always set loading false after getRedirectResult attempt
          console.log('[AuthContext] getRedirectResult.finally() in onAuthStateChanged. Loading set to false.');
        }
      }
    });

    return unsubscribe;
  }, []); // Empty dependency array: runs once on mount and cleans up on unmount.

  async function updateUserProfile({ firstName, lastName, venmo }) {
    if (!currentUser) throw new Error('No user logged in');
    const res = await fetch(`${API_URL}/users/${currentUser._id || currentUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, venmoHandle: venmo })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to update user profile');
    }
    const updatedUser = await res.json();
    setCurrentUser(prev => ({ ...prev, ...updatedUser, venmo: updatedUser.venmoHandle || '' }));
    return updatedUser;
  }

  async function refetchUserProfile() {
    if (!currentUser) throw new Error('No user logged in');
    const response = await fetch(`${API_URL}/users?email=${encodeURIComponent(currentUser.email)}`);
    if (!response.ok) throw new Error('Failed to fetch user profile');
    const usersArray = await response.json();
    if (!usersArray || usersArray.length === 0) throw new Error('User profile not found');
    const appUserProfile = usersArray[0];
    const augmentedUser = {
      ...currentUser,
      ...appUserProfile,
      venmo: appUserProfile.venmoHandle || '',
      isAdmin: appUserProfile.role === 'admin'
    };
    setCurrentUser(augmentedUser);
    return augmentedUser;
  }

  const value = {
    currentUser,
    loading, // Make sure to provide loading state from AuthContext if PrivateRoute or other components use it
    signup,
    login,
    loginWithGoogle,      // Assuming you still have this function defined
    loginWithGooglePopup, // Your popup function
    logout,
    authError,
    setAuthError,
    updateUserProfile,
    refetchUserProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {/* Render children only when initial auth check is complete OR always render and let PrivateRoute handle loading */}
      {/* The current !loading && children pattern is generally fine. */}
      {!loading && children}
    </AuthContext.Provider>
  );
}