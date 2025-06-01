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
    setLoading(true); // Set loading true before initiating redirect
    try {

      await signInWithRedirect(auth, googleProvider);
      console.log('hi')
      // signInWithRedirect doesn't resolve with a user object directly here,
      // the redirect result is handled by getRedirectResult and onAuthStateChanged.
      // setLoading(false) will be handled by onAuthStateChanged or getRedirectResult logic.
    } catch (error) {
      setAuthError(error.message || 'Failed to initiate Google sign-in');
      console.error("[AuthContext] Error initiating Google sign-in:", error);
      setLoading(false); // Set loading false if redirect initiation fails
      // throw error // Optional: re-throw if Login page handles it
    }
  }

  async function loginWithGooglePopup() {
    setAuthError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // User is signed in. onAuthStateChanged will handle setting currentUser.
      // You can access the result.user here if needed for immediate post-popup actions,
      // but typically onAuthStateChanged is the central place to manage user state.
      console.log("[AuthContext] Google sign-in with popup successful:", result.user.email);
      // setLoading(false) will be handled by onAuthStateChanged's logic
    } catch (error) {
      setAuthError(error.message || 'Failed to sign in with Google popup');
      console.error("[AuthContext] Error with Google sign-in popup:", error);
      setLoading(false); // Set loading false if popup fails
    }
  }

  function logout() {
    setAuthError('')
    return signOut(auth)
  }

  // Call getRedirectResult once on component mount - REMOVED PROACTIVE CALL
  // useEffect(() => {
  //   console.log('[AuthContext] AuthProvider mounted. Calling getRedirectResult proactively.');
  //   setLoading(true); // Explicitly set loading true here
  //   getRedirectResult(auth)
  //     .then((result) => {
  //       console.log('[AuthContext] Proactive getRedirectResult.then() - Result:', result);
  //       if (result && result.user) {
  //         // If a user is found, onAuthStateChanged will handle them.
  //         // No need to setCurrentUser here directly, as onAuthStateChanged will fire.
  //         console.log('[AuthContext] User found by proactive getRedirectResult:', result.user.email);
  //       }
  //       // If no user from redirect, onAuthStateChanged will handle the null user state.
  //     })
  //     .catch((error) => {
  //       console.error("[AuthContext] Error from proactive getRedirectResult: ", error);
  //       setAuthError(error.message || 'Failed to process sign-in after redirect');
  //       setCurrentUser(null);
  //       setLoading(false); // Set loading false on error
  //     })
  //     .finally(() => {
  //       // setLoading(false) here might be too early if onAuthStateChanged still needs to run.
  //       // The onAuthStateChanged listener will manage the final loading state.
  //       console.log('[AuthContext] Proactive getRedirectResult.finally()');
  //     });
  // }, []); // Empty dependency array ensures this runs only once on mount

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
        // Fetch user profile from your backend to get 'role' and other app-specific data
        // Use email as the query parameter, as your backend /api/users supports it
        const response = await fetch(`${API_URL}/users?email=${encodeURIComponent(firebaseUser.email)}`);
        
        if (!response.ok) {
          // This could happen if the user is in Firebase Auth but not yet in your MongoDB users collection
          // Or if there's a general API error
          console.error(`[AuthContext] Failed to fetch user profile from DB: ${response.status} ${response.statusText}`);
          // Decide how to handle: sign out, show error, or proceed with a basic Firebase user object
          setCurrentUser({ ...firebaseUser, isAdmin: false }); // Default to not admin if profile fetch fails
          setAuthError('Failed to load user profile details.');
          // setLoading(false) will be handled in the finally block of the outer try/catch in useEffect
          return; // Exit early for this specific case within processUserAuthentication
        }
        
        const usersArray = await response.json();
        if (!usersArray || usersArray.length === 0) {
          console.warn('[AuthContext] User not found in application database for email:', firebaseUser.email);
          setCurrentUser({ ...firebaseUser, isAdmin: false }); // User exists in Firebase, not in app DB
          setAuthError('User profile not found in application database.');
          return;
        }

        const appUserProfile = usersArray[0]; // Your API returns an array, take the first element

        // Augment the Firebase user object with your application-specific data
        const augmentedUser = {
          ...firebaseUser,      // Spread Firebase properties (uid, email, etc.)
          ...appUserProfile,    // Spread your MongoDB user properties (firstName, lastName, role, _id etc.)
          isAdmin: appUserProfile.role === 'admin' // Explicitly set isAdmin based on the role
        };
        
        console.log('[AuthContext] Augmented user object:', JSON.stringify(augmentedUser, null, 2));
        setCurrentUser(augmentedUser);
        setAuthError(''); // Clear any previous auth errors

      } catch (profileError) {
        console.error('[AuthContext] Error fetching/augmenting user profile:', profileError);
        // Fallback to just the Firebase user object if there's an unexpected error during profile fetch/processing
        setCurrentUser({ ...firebaseUser, isAdmin: false }); // Default to not admin on error
        setAuthError('Could not load complete user profile.');
      }
    } else {
      // No Firebase user
      setCurrentUser(null);
    }
    // setLoading(false) will be handled by the main onAuthStateChanged effect's finally or direct call
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

  const value = {
    currentUser,
    loading, // Make sure to provide loading state from AuthContext if PrivateRoute or other components use it
    signup,
    login,
    loginWithGoogle,      // Assuming you still have this function defined
    loginWithGooglePopup, // Your popup function
    logout,
    authError,
    setAuthError
  };

  return (
    <AuthContext.Provider value={value}>
      {/* Render children only when initial auth check is complete OR always render and let PrivateRoute handle loading */}
      {/* The current !loading && children pattern is generally fine. */}
      {!loading && children}
    </AuthContext.Provider>
  );
}